# Buckyball 文档

Buckyball 是一个面向领域专用架构（DSA）的开源软硬件框架。文档以当前代码仓库为准，说明主线架构、芯片和 Core 的边界，以及从编译、模拟到 RTL 验证的开发路径。

## 从这里开始

- [仓库概览与环境搭建](zh/教程/仓库概览与环境搭建.md)：安装环境，认识目录和第一个 workload。
- [设计总览](zh/设计文档/Overview.md)：理解主线架构与具体芯片的分工。
- [主线架构 v0.0.1](zh/设计文档/主线架构/0.0.1/Overview/Overview.md)：查看 Core、Frontend、MemDomain、BallDomain 和 Tile 的关系。
- [什么是 Ball，如何写一个 Ball](zh/教程/什么是Ball%20%26%20如何写一个Ball.md)：从一个计算单元开始开发。
- [工具链总览](zh/设计文档/主线架构/0.0.1/工具链/Overview.md)：编译 workload、运行 BEMU 和 Verilator。

英文文档从 [English overview](en/design/overview.md) 开始。代码仓库位于 [DangoSys/buckyball](https://github.com/DangoSys/buckyball)。

## 文档范围

```text
主线架构  arch/       共享的 Chisel/RTL 框架、Frontend、MemDomain、BallDomain
工具链    bbdev/      统一 CLI、HTTP API 和 MCP 入口
模拟器    bebop/      BEMU、Verilator、trace 和运行时节点
软件栈    stack/      compiler、runtime、platforms、models、serving、sims
实例      examples/   balls、cores、chips 及其配置、workload、验证代码
测试      bb-tests/   CTest、MLIRTest、内核和回归输出
验证      verify/     共享 UVM 环境和 IP/Ball 验证
```

目录名和命令会随代码演进。涉及具体参数时，以代码仓库当前版本和同目录说明为准。
