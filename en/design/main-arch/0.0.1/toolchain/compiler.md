# compiler

`compiler` builds the buddy-mlir compilation chain used by Buckyball. OpTest and ModelTest workloads depend on this compiler to lower Linalg, Tile, and Buckyball dialects step by step to LLVM IR, then generate RISC-V custom instructions.

This builds `compiler/thirdparty/buddy-mlir` in the repository. After compilation, `workload build` uses tools such as `buddy-opt`, `buddy-translate`, and `buddy-llc` to continue compiling test programs and models.

## build

`compiler build` configures and compiles buddy-mlir for the specified chip. Execution steps:

1. Configure `compiler/thirdparty/buddy-mlir/build` with cmake and set `BUDDY_EXTERNAL_DIALECTS_DIR` to `examples/chips/<chip>/compiler`. Different chips produce different compiler extensions.
2. Then `ninja` builds `buddy-opt`, `buddy-translate`, and `buddy-llc` — the three tools workload build uses next.

Usage:

```bash
bbdev compiler --build '--chip toy'
bbdev compiler --build '--chip pebble'
```

==Parameter 1 chip== `--chip` is required. Specifies which chip's compiler extension to build, e.g. `toy`, `pebble`, `goban`. Directory `examples/chips/<chip>/compiler/CMakeLists.txt` must exist.

==Parameter 2 stable== `--stable` is optional. Builds via the stable build path; usually not needed for day-to-day development.
