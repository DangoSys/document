# Buckyball 设计总览

Buckyball 把 DSA 开发中反复出现的部分放进主线架构，把具体芯片放进 `examples/`。主线提供统一的接口、编译器、模拟器、运行时和验证环境；芯片、Core 和 Ball 通过配置与实现接入这些能力。

## 主线与实例

主线代码位于仓库根目录的 `arch/`、`bbdev/`、`bebop/`、`stack/`、`bb-tests/` 和 `verify/`。这些目录定义共享契约，不绑定某一颗芯片。

`examples/` 保存可以直接构建的实例：

| 目录 | 负责什么 | 典型入口 |
| --- | --- | --- |
| `examples/balls/<ball>` | 一个 Ball 的 RTL 参数、BEMU、ISA、workload 和 UVM 用例 | `configs/default.toml` |
| `examples/cores/<core>` | 单 Core 的 CPU、Frontend、BallDomain、MemDomain 和编译器 | `configs/`、`compiler/` |
| `examples/chips/<chip>` | Tile 拓扑、芯片配置、仿真入口、内核和回归列表 | `configs/chip.toml` |

芯片配置通过 `examples/chips/<chip>/configs/chip.toml` 进入。它引用一个 design，再由 design 选择 Core 和 Tile 配置。安装配置后，派生产物写入 `configs/generated/`；这个目录是工具生成的结果，修改配置应回到源 TOML。

## 设计原则

- **Ball 是计算扩展的边界。** Ball 自己拥有指令语义、硬件实现、功能模型、验证和 workload；共享 Frontend、MemDomain 和 BBus 负责把它接入 Core。
- **bank 是调度和存储的共同单位。** 指令携带 bank 访问信息，Frontend 用它做依赖跟踪，MemDomain 负责 bank 的实际读写。
- **先小规模验证，再扩展到多 Core 和多 Tile。** 同一套接口覆盖单 Core、片内 Tile 和 Tile 间互连，工具链不随拓扑重复实现。
- **实例遵守主线契约。** 如果多个实例都需要同一能力，应先修改主线接口和实现，再更新实例；不要在单个芯片里复制一套工具链。

## 按任务阅读

- 想了解硬件边界：阅读 [主线架构 v0.0.1](主线架构/0.0.1/Overview/Overview.md) 和 [ISA](主线架构/0.0.1/Overview/ISA.md)。
- 想了解指令如何流动：阅读 [前端域架构](主线架构/0.0.1/frontend/前端域架构.md) 和 [Boot 流程](主线架构/0.0.1/boot流程/Overview.md)。
- 想把 MLIR 变成指令：阅读 [编译器总览](主线架构/0.0.1/编译器/Overview.md)。
- 想运行 workload 或回归：阅读 [工具链总览](主线架构/0.0.1/工具链/Overview.md)。
- 想新增一个实例：先读 [什么是 Ball，如何写一个 Ball](../教程/什么是Ball%20%26%20如何写一个Ball.md)，再对照 `examples/balls`、`examples/cores` 和 `examples/chips` 的目录结构。
