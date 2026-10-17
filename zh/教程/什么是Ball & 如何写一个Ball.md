# 什么是Ball & 如何写一个Ball

<div style="background:#f0f0f0;border-radius:8px;padding:16px;display:inline-block"><b>Thanks to</b><br><br><a href="https://github.com/Mikemy666" style="text-decoration:none;color:inherit;margin-right:20px"><img src="https://avatars.githubusercontent.com/u/140929282?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">Bohan Wang</span></a> <a href="https://github.com/shirohasuki" style="text-decoration:none;color:inherit"><img src="https://avatars.githubusercontent.com/u/68776527?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">shiroha</span></a></div>


## 什么是ball

在 Buckyball 中，Ball 是一个可以被系统统一集成和调度的 DSA 加速器模块。每个 Ball 负责实现某一类特定计算能力，例如向量计算、矩阵计算、数据搬运或格式转换等；但从系统角度看，它们都通过统一的 Blink 接口与外部交互。也就是说，Buckyball 并不需要理解每个 Ball 内部具体怎么计算，只需要知道它如何接收命令、访问存储、返回完成信息，以及暴露必要的状态。通过这种抽象，不同类型的 DSA 可以以相同的方式接入同一个系统，由框架负责指令分发、连接管理和调度协同，而 Ball 的开发者则可以把主要精力放在自己的加速器逻辑上。

## 先写一个ball

一个ball包含的内容很多，包括但不限于下面列举的这些。

不过我们这次只学习完成前三个，也就是跑通一个算子的最小单元。

- ==测试用例==
- ==模拟器 Golden Reference Model==
- ==RTL代码==
- 编译器Pass
- 验证测试代码
- …

### 以最简单的脉动阵列为例

这节给初学者补充下脉动阵列的基础知识，实现最简单的 OS 数据流。

#### OS 数据流是什么

脉动阵列常见三种数据流：WS（权重不动）、OS（输出不动）、IS（输入不动）。OS 就是每个 PE 守着一个输出元素，自己把乘积一拍一拍累加起来；$A$ 从左边一行行喂进来，$B$ 从上边一列列喂进来，每过一个周期往右、往下各传一格。

![OS 数据流：2×2 脉动阵列|560](os-systolic-2x2.png)

图里 PE 之间只有两种箭头：数据往右、往下传。数据不是一起进去的，第二行、第二列都比前一行、前一列晚一拍，所以在图里错着位置排。

拿图里这组数走一遍：

$$
A=\begin{bmatrix}1&2\\3&4\end{bmatrix},\quad
B=\begin{bmatrix}5&6\\7&8\end{bmatrix}
$$

数据是错开进去的：PE(i,j) 在第 t 个周期处理的是第 $k=t-i-j$ 项（$0\le k<2$），所以离左上角越远，开工越晚。

| 周期 | PE00 | PE01 | PE10 | PE11 |
|---|---|---|---|---|
| 0 | 1×5 = 5 | | | |
| 1 | +2×7 → **19** | 1×6 = 6 | 3×5 = 15 | |
| 2 | | +2×8 → **22** | +4×7 → **43** | 3×6 = 18 |
| 3 | | | | +4×8 → **50** |

4 个周期收工，每个 PE 里留下的就是结果矩阵的一个元素：

$$
C=\begin{bmatrix}19&22\\43&50\end{bmatrix}
$$

这张表就是后面“golden”的雏形：RTL 写完以后，周期对不对、每个 PE 里最后留的数对不对，都可以拿它来对。

#### 用仓库里最小的 ball 当骨架

仓库里最小的 ball 是 `ReluBall`（`examples/balls/relu`）：算的是 `max(x, 0)`，没有内部存储，只靠一个 128 bit 寄存器把一行数据从 bank 里读出来、算完再写回去。

下面讲“一个 ball 长什么样”，代码都摘自它。脉动阵列和它相比，**状态机骨架、Blink 接口、注册方式是一样的，不一样的是中间那一段计算和读写地址怎么走**，那部分要按自己的算子来写。

它的目录是这样的：

```
examples/balls/relu/
├── arch/src/main/scala/
│   ├── ReluBall.scala      # Ball 层：接线
│   └── Relu.scala          # Unit 层：状态机 + 计算
├── configs/default.toml    # ball 自己的参数（relu 没有参数）
├── emu/src/                # bebop 里的模拟模型（Rust）
│   ├── lib.rs
│   ├── dispatch.rs         # 指令执行和延迟的分发入口
│   └── 50_relu.rs
└── workloads/
    ├── isa/relu.h          # C 里发指令用的宏
    └── ctests/
        ├── relu_i32_16x16_test.c
        └── CMakeLists.txt
```

对应最前面列的三项：

| 要写的 | 文件 |
|---|---|
| 测试用例 | `workloads/ctests/relu_i32_16x16_test.c` |
| Golden Reference Model | `emu/src/50_relu.rs` |
| RTL | `arch/src/main/scala/ReluBall.scala` + `Relu.scala` |

### 第一步：领号，注册到系统

新 ball 要先在 core 的 `configs/balldomains/default.toml` 里登记（toy 的是 `examples/cores/toy/configs/balldomains/default.toml`）。登记三样东西：

```toml
ballNum = 5

ballIdMappings = [
  { ballId = 4, ballName = "XxxBall", ballClass = "examples.balls.xxx.XxxBall", config = "../../../../balls/xxx/configs/default.toml", inBW = 1, outBW = 1 },
]

ballISA = [
  { mnemonic = "XXX", funct7 = 54, bid = 4 },
]
```

| 段 | 登记什么 |
|---|---|
| `ballNum` | 一共几个 ball，加一个就要 +1 |
| `ballIdMappings` | ball 的名字、类名、参数文件、读写口数量（`inBW` / `outBW`） |
| `ballISA` | 指令名、指令号 `funct7`、对应哪个 ball |

`ballId` 和 `funct7` 都是人工分配的（`funct7` 一共 128 个号），上面的数字只是示意。加之前先看一眼现在谁占了：

```bash
grep -n "ballId\|funct7" examples/cores/toy/configs/balldomains/default.toml
```

后面几步里有几个字符串要和这里对上，写错了找不到：

| 这里 | 出现在 |
|---|---|
| `ballName = "XxxBall"` | RTL 里的 `.find(_.ballName == "XxxBall")` |
| `mnemonic = "XXX"` | RTL 里的 `.find(_.mnemonic == "XXX")`、C 宏里的 `BB_FUNC7(XXX)`、模拟模型里的 `Some("XXX")` |

relu 没有自己的参数，所以它的 `configs/default.toml` 就两行：

```toml
# ReluBall has no implementation-specific parameters.
[ball]
```

### 第二步：ISA 宏和测试用例

#### ISA 宏

`workloads/isa/relu.h` 就这么长：

```c
#ifndef _BB_RELU_H_
#define _BB_RELU_H_

#include <bbhw/isa/bb_func7.h>
#include <bbhw/isa/isa.h>

#define bb_relu(bank_id, group, iter, stride)                                  \
  BUCKYBALL_INSTRUCTION_R_R(                                                   \
      (BB_BANK0(bank_id) | BB_BANK1(group) | BB_ITER(iter)), (stride),         \
      BB_FUNC7(RELU))

#endif // _BB_RELU_H_
```

一条 Buckyball 指令是 RISC-V 的一条自定义指令，带两个寄存器操作数：

- **rs1**：放 bank 号和迭代次数（`BB_BANK0/1/2`、`BB_ITER`）。三个 bank 字段用哪几个由 ball 自己定，relu 只用前两个，第三个必须是 0
- **rs2**：每个 ball 自己的额外参数，relu 放的是 `stride`
- **`BB_FUNC7(RELU)`**：展开成第一步里分配的 `funct7`

所以你的 ball 要发什么参数、怎么摆进 rs1/rs2，是自己定的。RTL 里再按同样的约定把它们读出来就行。

#### 测试用例

`relu_i32_16x16_test.c` 的主流程：

```c
for (int i = 0; i < ROWS * COLUMNS; ++i)
  input[i] = (i * 97 % 401) - 200;          // 造数据，正负都有

pack(input, packed_input);
bb_mem_alloc(bank, 1, 1);                   // 分一块 bank
bb_mvin((uintptr_t)packed_input, bank, ITER, 1);   // 内存 → bank
bb_relu(bank, 0, ITER, ITER);               // 发指令
bb_mvout((uintptr_t)packed_output, bank, ITER, 1); // bank → 内存
bb_mem_release(bank);                       // 还掉 bank
unpack(packed_output, output);

for (int i = 0; i < ROWS * COLUMNS; ++i) {
  result_t expected = input[i] < 0 ? 0 : input[i];
  if (output[i] != expected) {
    printf("relu mismatch at %d: got %d expected %d\n", i, output[i], expected);
    return 1;
  }
}
printf("relu i32 16x16 PASSED\n");
```

最后两段是这个测试的核心：**用 C 自己算一遍期望值，和硬件算出来的逐个比，一个不对就打印下标和两边的值。** 全对了才打印 `PASSED`。

`pack` / `unpack` 负责把 16×16 的二维数组摆成 bank 里“一行 128 bit”的样子：

```c
static void pack(const result_t *source, result_t *destination) {
  for (int row = 0; row < ROWS; ++row) {
    for (int column = 0; column < COLUMNS; ++column) {
      int line = row * 4 + column / 4;
      destination[line * 4 + column % 4] = source[row * COLUMNS + column];
    }
  }
}
```

一个 `int32` 占 32 bit，一行 128 bit 正好放 4 个，所以第 `row` 行的 16 个数分到 4 条 line 里。对 relu 这个 int32 的 16×16 来说，算下来摆出来的顺序和原数组一样，但保留这一步，是为了让“数据怎么摆进 bank”在代码里是明说的。换一种数据类型或者分块方式，这里就要跟着改。

测试写完要注册进 `workloads/ctests/CMakeLists.txt`，否则不会被编译：

```cmake
add_buckyball_ctests(
  relu_i32_16x16_test.c
)
```

### 第三步：Golden Reference Model

测试用例有了，但这时候 RTL 还没写。怎么知道这个测试本身写得对不对？先在 bebop（Buckyball 的软件模拟器） 的 BEMU 软件模拟器里跑一遍。BEMU 按指令语义做功能验证，可以先检查“指令的语义”和“测试用例”有没有问题。

每个 ball 要给 BEMU 提供一个模拟模型，放在 `emu/src/` 下。`lib.rs` 声明模块，并导出执行和延迟两个分发入口：

```rust
pub(crate) use crate::inst::{decode, instruction};

#[path = "50_relu.rs"]
mod f50_relu;

mod dispatch;

pub use dispatch::{cycles_after_issue, execute_known};
```

`dispatch.rs` 按 ball 类名和 `funct7` 分发：`execute_known` 调用 `exec` 执行指令，`cycles_after_issue` 调用 `latency` 返回延迟。配置生成的 BEMU 代码会调用这两个入口，新 ball 都要实现并导出：

```rust
use crate::inst::instruction::{BallInstruction, ExecContext};

use super::f50_relu;

const BALL_CLASS: &str = "examples.balls.relu.ReluBall";

pub fn execute_known(
    ball_class: &str,
    funct: u32,
    xs1: u64,
    xs2: u64,
    ctx: &mut ExecContext,
) -> Option<u64> {
    if ball_class != BALL_CLASS {
        return None;
    }
    match crate::config::ball_domain::mnemonic_for_funct(funct).as_deref() {
        Some("RELU") => Some(f50_relu::Relu::exec(xs1, xs2, ctx)),
        Some(_) | None => None,
    }
}

pub fn cycles_after_issue(ball_class: &str, funct: u32, xs1: u64, xs2: u64) -> Option<u64> {
    if ball_class != BALL_CLASS {
        return None;
    }
    match crate::config::ball_domain::mnemonic_for_funct(funct).as_deref() {
        Some("RELU") => Some(f50_relu::Relu::latency(xs1, xs2)),
        Some(_) | None => None,
    }
}
```

真正干活的是 `50_relu.rs` 里的 `exec`：从 `xs1` / `xs2`（就是 C 里的 rs1 / rs2）里把 bank、group、iter、stride 解出来，检查参数合不合法，然后直接在软件的 bank 数组上做 `max(x, 0)`：

```rust
let bank = rs1_b0(xs1);
let group = rs1_b1(xs1);
let iter = rs1_iter(xs1) as usize;
let stride = xs2 as usize;

// ... 参数检查，不合法就 panic ...

for segment in (0..lines).step_by(stride) {
    for line in 0..iter {
        let offset = (segment + line) * 16;
        for lane in 0..4 {
            let byte = offset + lane * 4;
            let value = i32::from_le_bytes(ctx.banks[physical][byte..byte + 4].try_into().unwrap());
            ctx.banks[physical][byte..byte + 4].copy_from_slice(&value.max(0).to_le_bytes());
        }
    }
}
```

`50_relu.rs` 里还要实现 `latency`，返回这条指令的估计周期数。relu 的公式是 `lines / stride * iter * 4`，由 `cycles_after_issue` 分发给模拟器，用来估计时间。

这样一来，同一个 `.c` 测试先在 bebop 里跑：在 bebop 里过、RTL 里不过，问题在 RTL；在 bebop 里就过不了，先看测试和指令定义。下一篇会讲怎么跑。

### 第四步：RTL

#### Ball 层：接线

`ReluBall.scala`，基本不用动，改名字就行：

```scala
@instantiable
class ReluBall(val b: GlobalConfig) extends Module with HasBlink with HasBallStatus {

  private val mapping = b.ballDomain.ballIdMappings
    .find(_.ballName == "ReluBall")
    .getOrElse(throw new IllegalArgumentException("ReluBall not found in config"))

  @public
  val io = IO(new BlinkIO(b, mapping.inBW, mapping.outBW))

  def blink: BlinkIO = io
  def status = io.status
  dontTouch(io)

  val unit: Instance[Relu] = Instantiate(new Relu(b))
  unit.io.cmdReq <> io.cmdReq
  unit.io.cmdResp <> io.cmdResp
  unit.io.channelReady := io.channelReady
  unit.io.bankRead(0) <> io.bankRead(0)
  unit.io.bankWrite(0) <> io.bankWrite(0)
  io.status <> unit.io.status
  io.subRobReq.valid   := false.B
  io.subRobReq.bits    := SubRobRow.tieOff(b)
  MmioRead.tieOff(io.mmioRead)
}
```

做的事情就是：从配置里按 `ballName` 找到自己、创建 Unit、把 Blink 的几根线接过去，用不到的接口（`subRobReq`、`mmioRead`）直接接死。relu 只有一个读口一个写口，所以 `bankRead(0)`、`bankWrite(0)` 直接写死；读写口多的 ball 要按 `inBW` / `outBW` 循环。

#### Unit 层：状态机和计算

`Relu.scala` 里先把自己对配置的要求写成 `require`，配错了编译期就报错：

```scala
require(mapping.inBW == 1, "ReluBall requires one SRAM read port")
require(mapping.outBW == 1, "ReluBall requires one SRAM write port")
require(b.memDomain.bankWidth == 128, "ReluBall requires 128-bit SRAM rows")
require(b.memDomain.bankMaskLen == 16, "ReluBall requires sixteen byte enables")
```

接口是固定的：

```scala
val io = IO(new Bundle {
  val cmdReq       = Flipped(Decoupled(new BallRsIssue(b)))
  val cmdResp      = Decoupled(new BallRsComplete(b))
  val channelReady = Input(Bool())
  val bankRead     = Vec(1, Flipped(new BankRead(b)))
  val bankWrite    = Vec(1, Flipped(new BankWrite(b)))
  val status       = new BallStatus
})
```

状态机是七个状态：

```scala
val Seq(idle, waitForChannels, readRequest, readResponse,
        writeRequest, writeResponse, complete) = Enum(7)
val state = RegInit(idle)
```

| 状态 | 做什么 |
|---|---|
| `idle` | 等 `cmdReq` 握手。握手时把 rs1/rs2 里的字段存进寄存器，并用 `assert` 检查参数 |
| `waitForChannels` | 等 `channelReady` |
| `readRequest` | 发 bank 读请求 |
| `readResponse` | 收到数据，存进 `word` 寄存器 |
| `writeRequest` | 发 bank 写请求，写的是计算结果 |
| `writeResponse` | 收到写完成，决定读下一行还是结束 |
| `complete` | 回复 `cmdResp`，回到 `idle` |

读和写都拆成“请求”和“响应”两个状态，因为 bank 是带握手的通道，发请求和收数据不在同一拍。

relu 的计算就是这三行，对 `word` 里的 4 个 32 bit 分别取 `max(x, 0)`：

```scala
val relu = Wire(Vec(4, UInt(32.W)))
for (lane <- 0 until 4) {
  val value = word(32 * lane + 31, 32 * lane).asSInt
  relu(lane) := Mux(value < 0.S, 0.U, value.asUInt)
}
```

读哪一行、写回哪一行，由 `segment + line` 决定，在 `writeResponse` 里一行一行往前走。这两处——**每一拍算什么**和**地址怎么走**——是每个 ball 自己的东西；脉动阵列要在这里换成 PE 阵列和它自己的喂数、取结果逻辑。

### 跑起来

先说一个容易漏的：**新 ball 是硬件改动，改完配置和 Scala 之后，要重新生成 Verilog、重新编译仿真器**，不是只编 C 就行。按改了什么，重建哪几步：

| 你改了 | 重新跑 |
|---|---|
| C 测试 | `bbdev workload --build "--chip toy --ctest"`，然后直接 `--sim` |
| Scala（RTL） | `bbdev verilator --verilog "--chip toy"` → `--build` → `--sim` |
| toml 配置 | `bbdev config --install`，后面全部重来 |

进入环境，编译测试，跑仿真：

```bash
cd ~/buckyball
nix develop

bbdev workload --build "--chip toy --ctest"
bbdev verilator --sim "--chip toy --binary <二进制名字> --batch"
```

`--binary` 传的是**名字**，不是路径。名字取决于仓库当时的命名规则，所以不要凭印象写，先去输出目录里找：

```bash
find bb-tests/output -name '*relu*'
```

挑出来的名字原样贴进 `--binary`。不加 `--batch` 会停在调试器里，不是卡死。

看到 `relu i32 16x16 PASSED` 就算跑通。

下面是 gemmini 的一个测试跑完以后终端的样子，各个 ball 的输出长得都差不多：

![image.png|697](sim-passed-gemmini.png)

从上往下依次是：bbdev 起服务、找到二进制并装进模拟的 DRAM（`Loaded ELF ... bytes`）、测试自己打印的几行、最后的 `PASSED`。中间那行 `WARNING: Output directory results not exists` 只是说输出目录不存在、改用当前目录，不影响结果。

> [!note] 二进制名字
> 这张截图是 9 月下旬跑的，当时的二进制叫 `toy-toy-ctest-gemmini_os_risc_atranspose_test-baremetal`。后来命名规则变过，现在你编出来的名字可能不一样，所以前面才说要用 `find` 去找。

判断标准就是测试自己打印的内容，最后有没有那行 `PASSED`。再看一个 `vsetvli` 的例子，它先打印了自己在测什么，再打印执行结果，最后才是 `Test PASSED`：

![image.png|697](sim-passed-vsetvli.png)

### 小结

写一个 ball，按顺序是这几件事：

1. 在 toml 里领 `ballId` 和 `funct7`
2. 写 C 宏和测试用例，测试里自己算一份期望值
3. 在 `emu/` 里写 bebop 的模拟模型，先把测试用例本身验证掉
4. 写 RTL：Ball 层照抄接线，Unit 层的状态机骨架照抄，换掉“每一拍算什么”和“地址怎么走”

下一篇讲怎么在 bebop 和 Verilator 里跑它，对不上的时候怎么找问题。
