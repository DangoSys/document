# compiler

`compiler` builds the buddy-mlir compilation chain used by Buckyball. MLIRTest and ModelTest workloads depend on this compiler to lower Linalg, Tile, and Buckyball dialects step by step to LLVM IR, then generate RISC-V custom instructions.

This builds `compiler/thirdparty/buddy-mlir` in the repository. After compilation, `workload build` uses tools such as `buddy-opt`, `buddy-translate`, and `buddy-llc` to continue compiling test programs and models.

## build

`compiler build` product entry is the chip: `bazel build //examples/chips/<chip>:compiler` (or bbdev `--chip`). The default Core is the unique `cores/<pkg>` in the topology; cmake/ninja only compile buddy-mlir. Execution steps:

1. Configure `compiler/thirdparty/buddy-mlir/build/cores/<compilerCore>` with cmake and set `BUDDY_EXTERNAL_DIALECTS_DIR` to `examples/cores/<compilerCore>/compiler`. Each `compilerCore` has its own CMake output tree; different cores can be built in parallel.
2. Then `ninja` builds `buddy-opt`, `buddy-translate`, and `buddy-llc`. Symlinks such as `build/bin/buddy-opt-<core>` are created for manual invocation.
3. For interactive shells that need bare `buddy-opt`, set `export BUCKYBALL_COMPILER_CORE=<core>` before `source sourceme.sh`. bbdev compiler/workload inject `BUDDY_MLIR_BUILD_DIR` per subprocess from chip/core.

Usage:

```bash
bbdev compiler --build '--chip toy'
bbdev compiler --build '--core pebble'
```

==Parameter 1 core/chip== Specify exactly one target. `--core` directly selects a compiler Core such as `toy`, `pebble`, or `goban`; its package must contain `examples/cores/<core>/compiler/CMakeLists.txt`. `--chip` selects a runtime Chip and resolves its default Core from the unique `cores/<pkg>` in the topology.

==Parameter 2 stable== `--stable` is optional. Builds via the stable build path; usually not needed for day-to-day development.
