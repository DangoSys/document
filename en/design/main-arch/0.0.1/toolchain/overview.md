---
banner: en/design/main-arch/0.0.1/toolchain/images/banner.jpg
---
# Overview

bbdev is Buckyball's developer toolchain, exposed through a unified CLI and HTTP API. It drives the full development flow from RTL simulation and workload compilation to FPGA deployment. All sub-tools are invoked through bbdev; developers do not need to touch each tool's native interface directly. The CLI is for manual use by developers; the HTTP API is mainly for Agent invocation.

bbdev supports the following commands:

| Command           | Description                              |
| :---------------- | :--------------------------------------- |
| `compiler`        | Build the MLIR compilation chain         |
| `workload`        | Compile workloads into RISC-V binaries   |
| `kernel`          | Build RISC-V kernel and rootfs           |
| `bebop-bemu`      | Pure software binary simulation; fastest, no RTL |
| `bebop-verilator` | bebop-accelerated Verilator RTL simulation |
| `verilator`       | Standard Verilator RTL simulation        |
| `vcs`             | VCS RTL simulation                       |
| `firesim`         | FireSim FPGA-accelerated simulation      |
| `bebop-p2e`       | bebop FPGA on-board execution            |
| `yosys`           | Open-source synthesis and timing analysis |
| `dc`              | Design Compiler RTL export               |

For day-to-day verification, follow this pipeline:

```text
compiler build → workload build → bebop-bemu → bebop-verilator
```

Get functionality working in `bebop-bemu` first, then move to `bebop-verilator` for RTL validation. Use `sim` for single tests and `batch` for regression. See the per-command docs in this directory for detailed parameters:

- [[compiler]]
- [[workload]]
- [[kernel]]
- [[bebop-bemu]]
- [[bebop-verilator]]

Humans run the CLI directly; Agents use `buckyball-dev` from `.mcp.json` at the repository root (read by Claude Code / Codex / Cursor). Corresponding tools include `bbdev_compiler_build`, `bbdev_workload_build`, `bbdev_bemu_sim`, `bbdev_bebop_verilator_run`, and others. MCP starts bbdev HTTP automatically; the port is chosen dynamically, not fixed at `5000`.

A minimal example (toy):

```bash
bbdev compiler --build '--core toy'
bbdev workload --clean
bbdev workload --build '--chip toy'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-baremetal'
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-baremetal'
```

For pebble, replace `toy` with `pebble` and use verilator config `sims.verilator.BuckyballPebbleVerilatorConfig`.
