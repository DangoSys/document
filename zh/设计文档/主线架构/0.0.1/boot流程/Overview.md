# Buckyball Boot 流程

## 概览

Buckyball 有两层互相独立的启动过程：系统启动负责让 CPU 进入 OpenSBI 和 Linux；Buckyball boot 负责让每个加速器实例的 MemDomain 与 BallDomain 进入可使用状态。本文的 boot 指 Buckyball boot，CPU BootROM 的实现位于 `arch/src/main/resources/bootrom/`。

```text
CPU reset
  -> BootROM @ 0x10000
  -> OpenSBI payload @ 0x80000000
  -> Linux / bare-metal workload

accelerator reset
  -> Buckyball boot: MemDomain init -> each Ball init -> MemDomain release
  -> Frontend accepts the first CPU RoCC command
```

CPU 不会等待 Buckyball boot 才执行普通指令。它在系统启动期间可以继续取指、访问内存和运行 Linux；但在 Buckyball boot 未完成时，RoCC 的 Buckyball 命令入口保持不可用：`cmd.ready=0`，`busy=1`。因此软件无法向一个尚未完成初始化的加速器提交命令。

## Buckyball Boot 顺序

每个 `BuckyballAccelerator` 独立实例化一个 Frontend boot sequencer。该 sequencer 独占 Frontend 的 decode 输入，并严格按下列顺序发送命令。每条命令均等待 GlobalScheduler 变为 idle 后才发送下一条；最后一次等待确认全部命令已完成后，才把输入切回 Rocket RoCC。

1. `MSET(alloc=1, clear=1)`：将 virtual bank 0 映射到该实例全部 private bank group，并清零。
2. 对当前 `ballIdMappings` 中每个 Ball 发送一条 `BALL_INIT`，按配置顺序执行。
3. `MSET(alloc=0, clear=0)`：释放 boot 临时使用的 virtual bank 0 映射。
4. Frontend 解除 boot gate，CPU 的第一条 Buckyball RoCC 命令才可以进入 GlobalROB。

boot sequencer 不直接编码 `rs1`、`rs2` 位域或 opcode。MemDomain 与 BallDomain 各自通过 ISA builder 形成 typed command；Frontend 只负责顺序发送和完成等待。这样 boot 策略与 ISA 位布局保持解耦。

## MSET Clear

`MSET` 的现有资源描述格式保持不变。`rs1` 始终使用统一的 bank/iter 格式；`MSET` 不重新解释 `rs1`。

```text
MSET rs2
  [4:0]   row
  [9:5]   col / group count
  [10]    alloc
  [11]    clear
  [63:12] reserved, must be zero
```

`clear` 仅在 `alloc=1` 时合法：

- `alloc=1, clear=0`：正常分配映射，不改变 bank 数据。
- `alloc=1, clear=1`：完成映射后，清零该 virtual bank 的每个已分配 group 的全部 `[0, bankEntries)` 行；最后一行的写响应返回前，`MSET` 不完成。
- `alloc=0, clear=0`：释放映射。
- `alloc=0, clear=1`：非法，硬件 assertion。

清零由 MemDomain 内的 `ZeroLineGenerator` 产生零数据行，不发出 TileLink 请求，不访问 TLB，也不依赖某个约定的内存地址。当前 boot 仅初始化 private bank；shared memory 的初始化不属于本流程。

## BALL_INIT

`BALL_INIT` 是框架保留的 BallDomain 指令，不写入 chip 的 `ballISA` TOML，也不占用任一 Ball 的业务 opcode。

```text
funct7     = 0x05
rs1        = 0
rs2[4:0]   = target_bid
rs2[63:5]  = 0
```

BallDomainDecoder 对该 opcode 特判并验证目标 Ball 已配置。BBus 在目标 Ball idle 时发送该 Ball 的专属 reset，并通过正常的 `cmdResp` 路径完成该命令。reset 覆盖目标 Ball 的完整内部层级及其子模块，因此会恢复控制状态、配置寄存器、队列和计数器的 reset 值；它不修改 MemDomain bank 数据。

普通 Ball 指令仍完全使用 `ballISA` 的 `funct7 -> bid` 映射。`BALL_INIT` 的目标 ID 位于 `rs2` 的 Ball-special 参数空间，避免破坏全系统统一的 `rs1` 资源编码。

## 约束与验证点

- `MSET` 的 group-count 字段为 5 bit，`bankNum` 最大为 32；`col=0` 与 `alloc=1` 表示全部 32 个 group。
- `BALL_INIT` 的 target ID 为 5 bit，配置中的每个 `ballId` 必须小于 32，且不得在 `ballISA` 中复用 `funct7=0x05`。
- boot 必须在 `MSET.clear`、每个 `BALL_INIT`、`MSET.release` 的全局完成后才解除 Frontend gate。
- 验证应覆盖 reset 后的软件第一条 RoCC 命令不会早于 release 完成、全部 private bank 行为零、每个已配置 Ball 都收到一次 reset，以及 `clear=1 && alloc=0` 的非法输入 assertion。
