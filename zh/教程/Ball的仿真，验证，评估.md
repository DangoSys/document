# Ball 的仿真、验证与评估

写完 RTL 只是完成了 Ball 的一部分。一个 Ball 是否可用，要同时回答三个问题：结果是否正确，接口是否符合协议，资源和性能是否达到目标。Buckyball 的工具链把这三个问题拆开处理，定位会更清楚。

## 从 spec 到证据

推荐的开发顺序是：

```text
spec → workload → BEMU → Verilator → UVM → PPA
```

每一步检查的对象不同：

| 阶段 | 检查什么 | 主要产物 |
| --- | --- | --- |
| spec | 指令字段、bank 布局、边界和完成语义 | Ball 规格说明 |
| workload | 输入、期望输出和软件调用是否正确 | CTest / MLIRTest |
| BEMU | 指令语义和功能模型 | `log/*-bemu-*` |
| Verilator | RTL 时序、握手、bank 读写和完成周期 | `log/*-verilator-*`、波形 |
| UVM | 独立的协议、随机输入和覆盖率 | scoreboard、coverage、报告 |
| PPA | 面积、功耗、频率和吞吐 | 综合与功耗报告 |

如果 workload 在 BEMU 里失败，先修测试或功能模型；如果 BEMU 通过而 Verilator 失败，优先检查 RTL 和接口；如果 RTL 通过而 UVM 失败，检查 testbench 的约束、复位和协议假设。这样可以避免把不同层的问题混在一起。

## 1. 先确认 workload 自己正确

以 `TransposeBall` 为例：

```bash
bbdev config --install
bbdev workload --build '--chip pebble'
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --disasm'
```

CTest 中的期望结果应由普通 C 代码计算，不能直接复用 Ball 的实现。否则 RTL 和测试可能同时错了，却仍然得到“通过”。

需要检查 workload 是否真的被编译，可以查看：

```bash
find bb-tests/output/pebble/workloads/src -name '*transpose*'
```

## 2. 用 BEMU 验证功能模型

BEMU 位于 `bebop/`，对每条指令执行功能语义。它不模拟 RTL 的 ready/valid，也不试图预测真实周期，因此适合快速迭代：

```bash
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --itrace --mtrace'
```

常用 trace 的含义是：

- `itrace`：记录取到和执行的指令；
- `mtrace`：记录 bank 读写和行使用；
- `pmctrace`：记录性能计数器；
- `ctrace`：记录控制流；
- `banktrace`：记录更细的 bank 访问信息。

仿真结束后，日志目录中应有 `bdb.ndjson`。可以用 analysis 把 trace 转成报告：

```bash
bbdev bebop-bemu --analysis '--chip pebble --log-dir /abs/path/to/log-dir --itrace --mtrace'
```

分析报告适合回答“访问了哪些 bank”“平均使用了多少行”这类问题，不替代 RTL 波形。

## 3. 用 Verilator 检查 RTL

第一次运行需要生成 Verilog、编译仿真器，再执行 workload：

```bash
bbdev bebop-verilator --run '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal'
```

反复修改 workload 时不必每次重建 RTL：

```bash
bbdev bebop-verilator --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --no-wave'
```

修改 RTL 或 Chip 配置后重新生成和编译：

```bash
bbdev bebop-verilator --verilog '--chip pebble'
bbdev bebop-verilator --build '--chip pebble --jobs 16'
```

需要波形时不要使用 `--no-wave`。波形在对应日志目录的 `waveform/` 下，结合 `itrace` 和 `mtrace` 可以把软件指令、bank 访问和 RTL 周期对齐。

常见失败可以按现象分：

| 现象 | 优先检查 |
| --- | --- |
| `binary not found` | workload 是否为同一个 chip 构建，文件是否在 `bb-tests/output/<chip>/workloads/src` |
| BEMU 通过、RTL 失败 | bank 地址、ready/valid、复位、完成响应和写掩码 |
| `VSRC_PATH does not exist` | 是否先执行 `verilog`，以及 build 是否使用同一 chip |
| build marker mismatch | 清理旧的 `arch/build/<config>` 后重新生成和编译 |
| 仿真超时 | Ball 是否丢失 `cmdResp`，SubROB/ROB ID 是否原样返回 |

## 4. 用 UVM 验证协议和覆盖率

Ball 的 UVM 环境位于 `examples/balls/<ball>/verify`。以 transpose 为例，环境由 sequence、scoreboard、coverage 和 testbench 组成：

```bash
bbdev uvm --build '--ball=transpose'
bbdev uvm --run '--ball=transpose' -- '+BID=0'
```

UVM 适合做两类检查：

1. scoreboard 比较 bank 的数据、地址、掩码和完成信息；
2. coverage 确认元素位宽、`iter`、边界长度和异常路径都被执行。

UVM 通过后，仍然需要在 Chip 级 workload 上跑 BEMU 和 Verilator。Ball 级验证不能覆盖 CPU、Frontend、MemDomain 和多核同步的连接问题。

## 5. 收集性能和 PPA

正确性稳定后再测性能。先固定 workload、Chip 配置和编译参数，再比较：

- 总周期数和每条 Ball 指令的周期；
- bank 读写量、bank 使用峰值和搬运占比；
- Ball 的吞吐、空闲周期和阻塞原因；
- 综合后的面积、时序和功耗。

性能计数器和 trace 用来解释“慢在哪里”，而不是只给出一个总分。修改前后应使用同一份输入和同一套配置，并保留日志目录，方便回溯。

## 回归入口

单个用例通过后，加入 Chip 的回归清单：

```text
examples/chips/<chip>/regression/batch/bemu/workloads-bare.toml
examples/chips/<chip>/regression/batch/verilator/workloads-bare.toml
```

运行回归：

```bash
bbdev bebop-bemu --batch '--chip pebble --test elf-tests --clean-before'
bbdev bebop-verilator --batch '--chip pebble --test elf-tests --clean-before'
```

回归清单是 Ball 进入主线前的最低保护。它应覆盖普通输入、边界输入、非法字段和至少一个多 Ball 或多核场景。
