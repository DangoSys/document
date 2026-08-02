# bebop-bemu

`bebop-bemu` is pure software functional simulation. It does not run RTL; it executes workloads according to instruction semantics, used to verify test cases and ball functional behavior first. When writing balls and ctests day to day, run here first before moving to Verilator.

Each chip has its own BEMU implementation, with entry point at `examples/chips/<chip>/emu`. The command finds the corresponding `Cargo.toml` by `--chip`, then runs the specified ELF.

Build the workload before running:

```bash
bbdev workload --clean
bbdev workload --build '--chip toy'
```

## sim

`bebop-bemu sim` runs a single workload. Execution steps:

1. Find `examples/chips/<chip>/emu/Cargo.toml` by `--chip`. Error if not found.
2. Search for the ELF by name under `bb-tests/output/workloads/src`. Prefer `CTest/chips/<chip>` first; if not found, search for a non-chip-specific artifact with the same name. Error if not found.
3. `cargo run` starts that chip's BEMU and loads the ELF for execution.
4. Logs default to `arch/log/<timestamp>-<binary>-bemu`.

Usage:

```bash
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-singlecore-baremetal'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-linux --pk'
bbdev bebop-bemu --sim '--chip pebble --binary pebble_conv_im2col_test-singlecore-baremetal'
```

==Parameter 1 chip== `--chip` is required. Specifies which chip's BEMU to use, e.g. `toy`, `pebble`, `goban`. Directory `examples/chips/<chip>/emu/Cargo.toml` must exist.

==Parameter 2 binary== `--binary` is required. Provide the workload artifact name; an absolute path is not required. Common suffixes are `-singlecore-baremetal` or `-linux`. The name must be found under `bb-tests/output/workloads/src`; if not, the workload was not built or was built for a different chip.

==Parameter 3 pk== `--pk` is optional. When set, uses the proxy kernel path to run Linux userspace `-linux` workloads. Do not use this for baremetal ELFs.

==Parameter 4 log-dir== `--log-dir` is optional. Specifies the log directory. Defaults to `arch/log/...`.


## batch

`bebop-bemu batch` runs nextest in bulk according to the chip's regression list. Test lists are not hardcoded on the command line; they are read from:

```text
examples/chips/<chip>/regression/batch/bemu/workloads-elf.toml
examples/chips/<chip>/regression/batch/bemu/workloads-pk.toml
```

Execution steps:

1. Validate `--chip` and the corresponding BEMU manifest.
2. Select `workloads-elf.toml` or `workloads-pk.toml` by `--test`. Error if the file does not exist.
3. `cargo build --tests` to build BEMU tests first.
4. Then `cargo nextest run --test test_bemu` with workload toml and `bb-tests/output` in environment variables.

Usage:

```bash
bbdev bebop-bemu --batch '--chip toy --test elf-tests'
bbdev bebop-bemu --batch '--chip toy --test pk-tests --clean-before'
bbdev bebop-bemu --batch '--chip pebble --test elf-tests --clean-before'
```

==Parameter 1 chip== `--chip` is required; same meaning as in `sim`.

==Parameter 2 test== `--test` is required; must be `elf-tests` or `pk-tests`.
- `elf-tests` maps to baremetal list `workloads-elf.toml`
- `pk-tests` maps to linux/pk list `workloads-pk.toml`

To add regression cases, edit the corresponding toml; do not assemble a long list of binaries on the command line.

==Parameter 3 clean-before== `--clean-before` is optional. When set, clears `test-artifacts` under that chip's BEMU directory first to avoid stale artifacts interfering with the batch. Usually enabled in CI.
