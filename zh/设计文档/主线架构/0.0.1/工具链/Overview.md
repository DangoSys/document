---
banner: zh/设计文档/主线架构/0.0.1/工具链/images/banner.jpg
---

bbdev 是 Buckyball 的开发者工具链，以统一 CLI 和 HTTP API 两种方式对外暴露，驱动从 RTL 仿真、workload 编译到 FPGA 部署的完整开发流程。所有子工具均通过 bbdev 统一调用，开发者不需要直接接触各工具的原生接口。CLI 面向开发者手动使用，HTTP API 主要供 Agent 调用。

bbdev 支持以下命令：

| 命令 | 说明 |
| --- | --- |
| `compiler` | 构建 MLIR 编译链 |
| `workload` | 将 workload 编译为 RISC-V 二进制 |
| `kernel` | 构建 RISC-V 内核与 rootfs |
| `bebop-bemu` | 纯软件二进制模拟，速度最快，无 RTL |
| `bebop-verilator` | bebop 加速的 Verilator RTL 仿真 |
| `verilator` | 标准 Verilator RTL 仿真 |
| `vcs` | VCS RTL 仿真 |
| `firesim` | FireSim FPGA 加速仿真 |
| `bebop-p2e` | bebop FPGA 上板执行 |
| `yosys` | 开源综合与时序分析 |
| `dc` | Design Compiler RTL 导出 |



