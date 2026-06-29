# buckyball的指令规则

Buckyball 最后落到 CPU 看见的东西，其实就是一组 RISC-V custom 指令。软件发一条 custom 指令，Rocket 把它送到 RoCC，Buckyball 前端再根据 `funct7`、`rs1`、`rs2` 判断这条指令该去 frontend、memdomain 还是 balldomain。

所以看 Buckyball ISA 时不要先想“这是不是一套新的 CPU 指令集”。更准确地说，它是 Buckyball 和 CPU 之间的一层命令格式。CPU 负责把命令发进来，Buckyball 负责解释命令里的 bank、地址、迭代次数和具体操作。

这页只记录主线架构里所有芯片都要遵守的基础规则。具体 Ball 的计算指令，比如 `mul_warp16`、`transpose`、`fp2int`、`int2fp`，放到对应芯片或对应 Ball 的文档里讲。

## 指令长什么样

软件侧统一用 RISC-V `custom-3` opcode 发 Buckyball 指令：

```c
.insn r 0x7b, 3, funct7, x0, rs1, rs2
```

也就是：

| 字段 | 约定 |
| --- | --- |
| opcode | `0x7b`，也就是 RISC-V `custom-3` |
| `funct3` | 固定为 `3` |
| `rd` | 固定为 `x0` |
| `rs1` | 放 bank id 和 iter |
| `rs2` | 放地址、stride 或这条指令自己的参数 |
| `funct7` | 指令编号，同时带 bank 访问类型 |

这套宏在 `bb-tests/workloads/lib/bbhw/isa/isa.h` 里。比如 `bb_mvin`、`bb_mvout`、`bb_mset`、`bb_fence` 分别在同目录的 `33_mvin.c`、`16_mvout.c`、`32_mset.c`、`00_fence.c`。

先记住一件事：Buckyball 指令没有用 `rd` 返回值。它们是给加速器发命令，不是像普通 ALU 指令那样算完写回一个寄存器。

## `rs1` 是 bank 和 iter

`rs1` 的布局是全局统一的。无论是 mem 指令还是 ball 指令，前端都会先按下面这个格式拆：

| 字段 | bit | 含义 |
| --- | --- | --- |
| `BB_BANK0` | `[9:0]` | 第一个 bank id |
| `BB_BANK1` | `[19:10]` | 第二个 bank id |
| `BB_BANK2` | `[29:20]` | 第三个 bank id |
| `BB_ITER` | `[63:30]` | 迭代次数，或者搬运多少个 logical bank row |

软件宏里写成这样：

```c
#define BB_BANK0(id) FIELD(id, 0, 9)
#define BB_BANK1(id) FIELD(id, 10, 19)
#define BB_BANK2(id) FIELD(id, 20, 29)
#define BB_ITER(n)   FIELD(n, 30, 63)
```

这几个名字不要理解成“物理上一定有 bank0、bank1、bank2 三个端口”。它们只是 `rs1` 里的三个字段。具体哪条指令读哪个字段，由 `funct7[6:4]` 和执行域共同决定。

这里有一个很容易写错的点：mem 指令的写 bank 用 `BB_BANK0`，ball 指令的写 bank 通常用 `BB_BANK2`。前端的 `GlobalDecoder` 会把这个差异整理成统一的 `BankAccessInfo`，后面的 ROB 和 Scoreboard 不再关心原始字段来自哪里。

## `funct7` 不只是 opcode

Buckyball 把 `funct7` 拆成两段用：

```text
funct7[6:4] = bank access type
funct7[3:0] = opcode inside that group
```

高 3 bit 先告诉前端这条指令访问几个 bank：

| `funct7[6:4]` | 前端理解的 bank 访问 |
| --- | --- |
| `000` | 不访问 bank |
| `001` | 读 `bank0` |
| `010` | 写 bank |
| `011` | 读 `bank0`，写 bank |
| `100` | 读 `bank0`、`bank1`，写 bank |
| `101` / `110` / `111` | 扩展 opcode 空间，前端按无 bank 访问处理 |

为什么要这么干？因为 Buckyball 前端要做乱序调度。它不可能等指令到了某个 Ball 里面才知道这条指令读写哪些 bank。`funct7[6:4]` 让前端在 decode 阶段就能建 Scoreboard 依赖。

低 4 bit 才是这个访问组里的具体 opcode。比如 `mset = 0x20`，高 3 bit 是 `010`，表示它是一个写 bank / 配置类指令；低 4 bit 是 `0`。

## 主线通用指令

主线架构里固定有四条基础指令：

| 指令 | `funct7` | 执行域 | 做什么 |
| --- | ---: | --- | --- |
| `bb_fence` | `0x00` | frontend | 等前面的 Buckyball 指令都退休 |
| `bb_mvout` | `0x10` | memdomain | bank 到 DRAM |
| `bb_mset` | `0x20` | memdomain | 配置或释放 bank 形状 |
| `bb_mvin` | `0x21` | memdomain | DRAM 到 bank |

这四条是基础设施，不属于某一个具体 Ball。你写新的 Ball 时，通常还是会靠 `mset` 分 bank、靠 `mvin` 把输入搬进来、靠 `mvout` 把结果搬出去，最后用 `fence` 等它们真的结束。

## `bb_fence`

```c
bb_fence()
```

编码很简单：

| 字段 | 值 |
| --- | --- |
| `funct7` | `0x00` |
| `rs1` | `0` |
| `rs2` | `0` |

`bb_fence` 走 frontend，不进入 ROB。前端看到它之后，会等当前 ROB 里已经进去的指令都提交完，再放后面的指令继续走。

它不是 RISC-V 标准 `fence` 的别名，也不是“把某个 bank 刷出去”。它只是 Buckyball 指令流里的同步点。最常见的用法是在 `mvout` 后面接一个 `bb_fence()`，然后 CPU 再去读输出内存。

```c
bb_mvout((uintptr_t)out, bank, depth, stride);
bb_fence();
// CPU can read out after this point.
```

如果少了这个 fence，CPU 可能在 `mvout` 还没真正完成时就去读结果，这类 bug 看起来会很随机。

## `bb_mset`

```c
bb_mset(bank_id, alloc, row, col)
bb_mem_alloc(bank_id, row, col)
bb_mem_release(bank_id)
```

字段如下：

| 字段 | bit | 含义 |
| --- | --- | --- |
| `funct7` | - | `0x20` |
| `rs1[9:0]` | `[9:0]` | `bank_id` |
| `rs2[4:0]` | `[4:0]` | `row` |
| `rs2[9:5]` | `[9:5]` | `col` |
| `rs2[10]` | `[10]` | `alloc`，`1` 是配置，`0` 是释放 |

`mset` 不是搬数据，而是告诉 memdomain：从这个 bank 开始，后面的数据应该按什么 logical shape 来看。

`row` 和 `col` 这两个字段会影响后面的 `mvin`、`mvout` 和 ball 指令。尤其是 `col`，前端在发射指令时会把已经提交的 `mset` 信息补进 `op1_col`、`op2_col`、`wr_col`。所以 `mset` 不能被后面的相关指令随便越过。

编译器里 Bank SSA 先用虚拟 bank handle 写程序，到了 physical bank assignment 才真正挑物理 bank，并插入 `mset`：

```mlir
buckyball.mset(bankId, alloc=true, row, col)
...
buckyball.mset(bankId, alloc=false, row=0, col=0)
```

如果物理 bank 不够，pass 会直接报错。这里不应该做默认值或静默复用，不然问题会被藏到 RTL 或结果校验阶段才爆出来。

## `bb_mvin`

```c
bb_mvin(mem_addr, bank_id, depth, stride)
```

字段如下：

| 字段 | bit | 含义 |
| --- | --- | --- |
| `funct7` | - | `0x21` |
| `rs1[9:0]` | `[9:0]` | `bank_id` |
| `rs1[63:30]` | `[63:30]` | `depth` |
| `rs2[38:0]` | `[38:0]` | DRAM 起始地址 |
| `rs2[57:39]` | `[57:39]` | `stride` |

`mvin` 把 DRAM 里的数据搬进 bank。这里最容易误解的是 `depth` 和 `stride`。

`depth` 不是 byte 数，而是要搬多少个 logical bank row。`stride` 也不是 byte stride，它以 16-byte bank row 为单位。实际地址可以按下面这个式子理解：

```text
addr = base + row * col * 16 * stride + group * 16
```

其中 `col` 来自前面已经提交的 `mset`。比如一个 `16x16xf32` tile，一行是 64 bytes，也就是 4 个 16-byte group，所以通常会配置 `col = 4`。

编译器 lowering 时，`buckyball.mvin` 的 memref 操作数会被展开成真实字节地址。这里会处理 subview offset，所以不能只拿 memref 的 aligned base pointer 当地址。

## `bb_mvout`

```c
bb_mvout(mem_addr, bank_id, depth, stride)
```

字段和 `mvin` 一样，只是方向反过来：

| 字段 | bit | 含义 |
| --- | --- | --- |
| `funct7` | - | `0x10` |
| `rs1[9:0]` | `[9:0]` | `bank_id` |
| `rs1[63:30]` | `[63:30]` | `depth` |
| `rs2[38:0]` | `[38:0]` | DRAM 起始地址 |
| `rs2[57:39]` | `[57:39]` | `stride` |

`mvout` 把 bank 里的数据写回 DRAM。一般写完以后要接 `bb_fence()`，否则 CPU 侧不要假设结果已经能读。

`mvin` 和 `mvout` 的字段对称，这点对写手工测试很方便。很多 smoke test 都是：

```c
bb_mvin((uintptr_t)src, bank, depth, stride);
bb_mvout((uintptr_t)dst, bank, depth, stride);
bb_fence();
```

如果这都不对，先别看复杂 Ball，先查地址、`depth`、`stride` 和前面的 `mset`。

## 编译器里怎么走

从编译器角度看，Buckyball 指令不是一开始就手搓 `.insn`。典型路径是：

```text
tile / linalg
  -> buckyball.matmul
  -> bank SSA
  -> physical bank assignment
  -> buckyball.mset / mvin / mvout / fence
  -> buckyball.intr.*
  -> @llvm.riscv.bb.*
  -> RISC-V custom instruction
```

Bank SSA 这一层还没有物理 bank，只有虚拟 handle。`-assign-physical-banks` 会把虚拟 handle 分到真实 bank id 上，并插入 alloc/release 对应的 `mset`。

还有一个历史原因留下来的命名坑：`buckyball.mvin` / `buckyball.mvout` 里的 `addr` 操作数实际表示 bank id，不是 DRAM 地址。DRAM 地址来自 memref，lowering 时再从 memref metadata 算出来。

## 写新 Ball 时怎么用这页

写一个新 Ball 时，通常不需要重新设计这几条基础指令。你要做的是：

1. 复用 `rs1` 的 bank 字段。
2. 给自己的 Ball 指令选好 `funct7`。
3. 按 `funct7[6:4]` 正确声明它读写几个 bank。
4. 定义清楚自己的 `rs2` 怎么解释。
5. 在 RTL decoder、软件 wrapper、编译器 lowering 里保持同一套编码。

其中第 3 点最重要。前端靠它做依赖分析，如果这里写错，后面可能不是“跑不起来”，而是“偶尔读到旧数据”或者“乱序时才错”。这种 bug 最难查。

所以这页的作用很简单：主线基础指令和 bank 编码不要乱动。具体 Ball 想怎么计算可以扩展，但要接入 Buckyball 的前端调度，就得先遵守这套命令格式。
