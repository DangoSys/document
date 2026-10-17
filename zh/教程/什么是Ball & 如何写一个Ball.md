# 什么是 Ball，如何写一个 Ball

## 什么是 Ball

在 Buckyball 中，Ball 是一个可以被系统统一集成和调度的计算模块。向量计算、矩阵乘、转置、量化和数据搬运都可以实现为 Ball。框架不需要知道 Ball 内部使用了多少级流水线，只要求它遵守统一的命令、bank 和完成接口：

- 从 `cmdReq` 接收一条已经解码的命令；
- 通过 `BankRead` 和 `BankWrite` 访问 MemDomain 的 bank；
- 在结果可提交时通过 `cmdResp` 返回 `rob_id`；
- 用 `BallStatus` 报告空闲或忙状态。

Frontend 负责把 CPU 的 RoCC 指令送到 BallDomain。BallDomain 根据 Ball 的 ISA 映射选择具体模块，调度器负责处理依赖和完成顺序。Ball 只处理自己的数据和控制状态，因此可以和其他 Ball 共用同一个 Core。

## 一个 Ball 包含什么

一个可以使用的 Ball 通常有以下部分：

| 部分 | 作用 | TransposeBall 的位置 |
| --- | --- | --- |
| 参数 | 定义 bank 宽度、数据类型或阵列尺寸 | `configs/default.toml`、`configs/TransposeBallParam.scala` |
| RTL | 实现命令解析、状态机和 bank 读写 | `arch/src/main/scala/` |
| 功能模型 | 在 BEMU 中执行同样的语义 | `emu/src/` |
| ISA 封装 | 把 C 参数放入 `funct7`、`rs1`、`rs2` | `workloads/isa/` |
| workload | 验证输入、输出和边界条件 | `workloads/ctests/`、`workloads/mlir_tests/` |
| UVM 验证 | 独立于整芯片检查协议和结果 | `verify/` |

编译器 Pass 是可选的后续工作。先让 CTest、BEMU 和 RTL 通过，再把 Ball 接入 MLIR lowering，问题更容易定位。

## 以 TransposeBall 为例

`examples/balls/transpose` 是一个可以直接阅读的 Ball。它把 bank 中的矩阵转置后写入另一个 bank，支持 8 bit 和 32 bit 元素。一次命令的字段由 `workloads/isa/transpose.h` 定义：

```text
rs1[9:0]    输入 bank（bank0）
rs1[19:10]  备用 bank 字段
rs1[29:20]  输出 bank（bank2）
rs1[63:30]  iter，输入矩阵的行数
rs2[7:0]    元素位宽，只能是 8 或 32
```

输入和输出 bank 必须已经分配，列数必须相同，`iter` 必须大于零。这个约束在 RTL 和 BEMU 中都检查，避免两个实现对同一条非法指令给出不同结果。

### 第一步：写参数和顶层包装

`configs/default.toml` 给出 Ball 的基础参数：

```toml
[ball]
InputNum = 16
inputWidth = 8
```

`TransposeBallParam.scala` 用 `BallParamLoader` 读取这些值。`TransposeBall.scala` 是系统接入层，它实例化 `Transpose`，连接 `BlinkIO`、bank 通道和完成信号，并把当前 Ball 不使用的 MMIO、SubROB 接口 tie off。这样，真正的算法模块不需要处理系统级连接细节。

### 第二步：实现 RTL 状态机

`Transpose.scala` 的状态机只有四个主要阶段：

```text
idle → sRead → sWrite → complete
```

- `idle` 接收命令并锁存 bank、列数、`iter` 和元素位宽；
- `sRead` 按行从输入 bank 读取数据；
- `sWrite` 按转置后的顺序写入输出 bank；
- `complete` 等待完成响应被接受。

模块通过 `cmdReq.ready` 表示是否能接收新命令，通过 `bankRead`/`bankWrite` 发起访存。`cmdResp.bits` 必须带回原来的 `rob_id`、`is_sub` 和 `sub_rob_id`，否则 Frontend 无法把完成事件对应到正确的 ROB 项。

开发 RTL 时，把不变量写成 assertion。例如输入输出 bank 不能相同，列数不能为零，`rs2[63:8]` 必须为零。这些检查比在测试失败后猜测原因更直接。

### 第三步：同步实现 BEMU 功能模型

`emu/src/transpose.rs` 实现相同的语义，但不模拟每个 RTL 周期。它会：

1. 从 `rs1` 解码输入 bank、输出 bank 和 `iter`；
2. 按 bank 的物理分组读出连续矩阵；
3. 在内存中的临时数组完成转置；
4. 按输出 bank 的布局写回；
5. 对非法字段直接报错。

BEMU 不是另一个版本的算法。它的价值是先给出一个容易检查的结果模型，再把同一个 workload 交给 RTL。若 BEMU 和 RTL 结果不同，先比较字段解码和 bank 布局，再看时序。

### 第四步：写 ISA 封装和 CTest

`workloads/isa/transpose.h` 用公共宏生成 R 型自定义指令：

```c
bb_transpose(op1_bank_id, wr_bank_id, iter, elem_bits);
```

测试用例负责准备数据和期望值，而不是把转置算法隐藏在硬件调用里。`transpose_i8_16x16_test.c` 的核心流程是：

```c
bb_mem_alloc(src, 1, N_GROUPS);
bb_mem_alloc(dst, 1, N_GROUPS);
bb_mvin((uintptr_t)input_matrix, src, ROWS, 1);
bb_transpose(src, dst, ROWS, ELEM_BITS);
bb_mvout((uintptr_t)output_matrix, dst, ROWS, 1);
bb_mem_release(src);
bb_mem_release(dst);
```

最后用普通 C 代码比较输出矩阵。这样测试同时覆盖了 bank 分配、搬入、Ball 指令、搬出和释放，而不是只验证一个孤立的模块。

### 第五步：逐层运行

在仓库根目录执行：

```bash
bbdev config --install
bbdev workload --build '--chip pebble'
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal'
bbdev bebop-verilator --run '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --no-wave'
```

结果正确后，再运行 Ball 的 UVM 验证。TransposeBall 的验证目录包含 case generator、scoreboard、coverage 和 testbench：

```bash
bbdev uvm --build '--ball=transpose'
bbdev uvm --run '--ball=transpose' -- '+BID=0'
```

`BID` 必须和当前 Verilator 配置中的 Ball ID 一致。UVM 直接观察 bank 请求、写回数据和完成响应，可以在整芯片 workload 之外定位协议问题。

## 写新 Ball 时的检查表

- 先写清楚输入、输出、元素类型、bank 布局和非法条件。
- 让 ISA 头文件、BEMU、RTL 使用同一套字段定义。
- 先补一个小的 CTest，再补不同元素类型、不同 `iter` 和边界长度。
- BEMU 通过后再跑 Verilator；RTL 通过后再跑 UVM 和回归。
- 如果多个 Ball 都需要同一种 lowering，再添加编译器 Pass；不要把编译逻辑复制到每个测试里。
