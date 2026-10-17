---
banner: zh/设计文档/主线架构/0.0.1/Overview/images/banner.avif
---

# 主线架构 v0.0.1

本文记录 Buckyball v0.0.1 的共享架构。具体芯片可以选择不同的 Core、Ball 和 Tile 配置，但应遵守这里定义的接口和指令契约。

## 两个层次

芯片级结构由 Tile、Core、共享内存和互连组成。`mbus` 连接 Tile，Tile 内的 `T2M` 连接内存，`T2T` 连接其他 Tile；`C2H` 和 `C2C` 分别表示芯片到主机、芯片到芯片的边界。

![芯片级 Tile 互连](../../../../../resource/images/architecture-tile.png)

单个 Core 内部，Rocket/Host 通过 RoCC 接入 Buckyball。Frontend 负责解码、依赖跟踪和调度；MemDomain 负责 Loader/Store、MemFrontend、MemMidend 和 bank；BallDomain 负责 Ball 解码、保留站和具体 Ball。

![单 Core Buckyball 加速器](../../../../../resource/images/architecture-core.png)

两张图的关系是：Core 是 Tile 的计算单元，多个 Core 共享 Tile 内的内存和控制路径；多个 Tile 再通过 `T2T` 和 `mbus` 组成芯片。

## Core 内的数据路径

1. CPU 通过 RoCC 发出 Buckyball 指令，Frontend 的 `GlobalDecoder` 将其转换成统一的 `PostGDCmd`。
2. `GlobalScheduler` 和 `GlobalROB` 根据 domain、bank 访问和依赖状态决定入队、发射、完成和提交。
3. MemDomain 处理 bank 搬运和内存访问，BallDomain 将 Ball 指令送入对应的 Ball。
4. 指令完成后沿完成通道回到 Frontend，由 ROB 按顺序提交；复杂 Ball 可以通过 SubROB 展开微指令。

共享硬件代码在 `arch/src/main/scala/framework/`：`frontend/`、`balldomain/` 和 `mem-core/` 分别对应三类核心模块。Core 的具体参数和 Ball 选择在 `examples/cores/<core>/configs/` 中，芯片再通过 `examples/chips/<chip>/configs/chip.toml` 选择一个具体 Core。

## 代码边界

| 层次 | 代码位置 | 主要产物 |
| --- | --- | --- |
| 共享硬件 | `arch/` | Chisel/RTL、接口、bank、Frontend、BallDomain、MemDomain |
| Core 实例 | `examples/cores/` | CPU/域参数、Core RTL 顶层、Core 专用 compiler |
| Ball 实例 | `examples/balls/` | Ball RTL、BEMU、ISA、验证和 workload |
| Chip 实例 | `examples/chips/` | Tile 配置、仿真目标、内核、回归和生成配置 |
| 软件与工具 | `stack/`、`bebop/`、`bbdev/` | compiler、runtime、BEMU、Verilator 和统一命令入口 |

不要直接编辑 `examples/chips/<chip>/configs/generated/` 下的文件。配置变更应修改 `configs/chip.toml`、design TOML 或 Core 配置，再重新运行 `bbdev config --install`。

## 继续阅读

- [ISA](ISA.md)：RoCC 指令字段和通用指令约定。
- [前端域架构](../frontend/前端域架构.md)：Frontend 的调度、ROB、BAT、Scoreboard 和 SubROB。
- [编译器总览](../编译器/Overview.md)：从 Linalg/Tile 到 Buckyball 指令的 lowering 链路。
- [工具链总览](../工具链/Overview.md)：从 workload 构建到 BEMU、Verilator 和 UVM。
