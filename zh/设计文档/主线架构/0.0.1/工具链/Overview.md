---
banner: zh/设计文档/主线架构/0.0.1/工具链/images/banner.jpg
---
# Overview

bbdev 是 Buckyball 的开发者工具链，以统一 CLI 和 HTTP API 两种方式对外暴露，驱动从 RTL 仿真、workload 编译到 FPGA 部署的完整开发流程。所有子工具均通过 bbdev 统一调用，开发者不需要直接接触各工具的原生接口。CLI 面向开发者手动使用，HTTP API 主要供 Agent 调用。

bbdev 支持以下命令：

| 命令                | 说明                         |
| :---------------- | :------------------------- |
| `compiler`        | 构建 MLIR 编译链                |
| `workload`        | 将 workload 编译为 RISC-V 二进制  |
| `kernel`          | 构建 RISC-V 内核与 rootfs       |
| `bebop-bemu`      | 纯软件二进制模拟，速度最快，无 RTL        |
| `bebop-verilator` | bebop 加速的 Verilator RTL 仿真 |
| `verilator`       | 标准 Verilator RTL 仿真        |
| `vcs`             | VCS RTL 仿真                 |
| `firesim`         | FireSim FPGA 加速仿真          |
| `bebop-p2e`       | bebop FPGA 上板执行            |
| `yosys`           | 开源综合与时序分析                  |
| `dc`              | Design Compiler RTL 导出     |

日常验证按这条链路走就行：

```text
compiler build → workload build → bebop-bemu → bebop-verilator
```

先把功能在 `bebop-bemu` 跑通，再上 `bebop-verilator` 对 RTL。单测用 `sim`，回归用 `batch`。详细参数看同目录下各命令文档：

- [[compiler]]
- [[workload]]
- [[kernel]]
- [[bebop-bemu]]
- [[bebop-verilator]]

人直接敲 CLI；Agent 走仓库根目录 `.mcp.json` 里的 `buckyball-dev`（Claude Code / Codex / Cursor 都读这份），对应 tool 是 `bbdev_compiler_build`、`bbdev_workload_build`、`bbdev_bemu_sim`、`bbdev_bebop_verilator_run` 等。MCP 会自己拉起 bbdev HTTP，端口是动态选的，不是写死 `5000`。

一个最小例子（toy）：

```bash
bbdev compiler --build '--core toy'
bbdev workload --clean
bbdev workload --build '--chip toy'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-baremetal'
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-baremetal'
```

pebble 把上面的 `toy` 换成 `pebble`，verilator config 换成 `sims.verilator.BuckyballPebbleVerilatorConfig` 即可。
