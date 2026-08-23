# bebop-bemu

`bebop-bemu` is pure software functional simulation. It does not run RTL; it executes workloads according to instruction semantics, used to verify test cases and ball functional behavior first. When writing balls and ctests day to day, run here first before moving to Verilator.

The chip product entry for BEMU is Bazel: `bazel build //examples/chips/<chip>:emu`. Cargo only builds `bebop/Cargo.toml`. Chips with `emu/src/main.rs` (multi-hart) use `bebop-chip`; others use the bebop CLI `run bemu`.

Build the workload before running:

```bash
bbdev workload --clean
bbdev workload --build '--chip toy'
```

## sim

`bebop-bemu sim` runs a single workload. Execution steps:

1. Find `examples/chips/<chip>/chip.toml` by `--chip`. Error if not found.
2. Search for the ELF by name under `bb-tests/output/<chip>/workloads/src`. Prefer `CTest/chips/<chip>` first; if not found, search for a non-chip-specific artifact with the same name. Error if not found.
3. `cargo run --release --features bemu` on `bebop/Cargo.toml` loads the ELF. Multi-hart chips also enable `chip-emu` and run `bebop-chip --tile`.
4. Logs go to `log/<timestamp>-bemu-<binary>`.

Usage:

```bash
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-baremetal'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-linux --pk'
bbdev bebop-bemu --sim '--chip pebble --binary pebble_conv_im2col_test-baremetal'
bbdev bebop-bemu --sim '--binary buddy-buckyball-mobilenetv3-run --pk --chip pebble --disasm'
bbdev bebop-bemu --sim '--binary buddy-buckyball-mobilenetv3-run --pk --chip pebble --step-n 256'
```

==Parameter 1 chip== `--chip` is required. Specifies which chip's BEMU to use, e.g. `toy`, `pebble`, `goban`. `examples/chips/<chip>/chip.toml` must exist.

==Parameter 2 binary== `--binary` is required. Provide the workload artifact name; an absolute path is not required. Common suffixes are `-baremetal` or `-linux`. The name must be found under `bb-tests/output/<chip>/workloads/src`; if not, the workload was not built or was built for a different chip.

==Parameter 3 pk== `--pk` is optional. When set, uses the proxy kernel path to run Linux userspace `-linux` workloads. Do not use this for baremetal ELFs.

==Parameter 4 disasm== `--disasm` is optional. Enables the per-instruction `disasm.log`, intended only for instruction-level debugging; it is disabled by default.

==Parameter 5 tool-profile== `--tool-profile` is optional. Prints a coarse host-time breakdown between the NPU functional model and Spike/guest CPU execution; it is disabled by default.

==Parameter 6 step-n== `--step-n` is optional and defaults to `1`. It processes up to `N` guest instructions in one Rust-to-native BEMU call. Syscall, exit, and PC checks remain per guest instruction in native code; larger values reduce host wrapper overhead.

Direct `bebop run bemu` requires `--log-dir`.


## analysis

`bebop-bemu analysis` only analyzes an existing `bdb.ndjson`; it does not run simulation. `--chip` is required: frontend ISA names fence / mset / mvin / mvout, and every other funct comes from that chip's `core.toml` → `balldomain` `ballISA`. A mismatch is an error. mtrace `bank_depth` comes from that core's `memdomain` `[bank].entries`; occupancy is reported as `mean_rows/bank_depth`.

`--log-dir` is required and must already contain `bdb.ndjson`. At least one of `--itrace` / `--mtrace` is required. If a requested trace has no events, the command fails. The report is written to `<log-dir>/analysis.txt`.

```bash
bbdev bebop-bemu --sim '--chip pebble --binary buddy-buckyball-yolo26-run --pk --itrace --mtrace'
bbdev bebop-bemu --analysis '--chip pebble --log-dir /abs/path/log/2026-08-19-13-00-bemu-buddy-buckyball-yolo26-run --itrace --mtrace'
```

==Parameter 1 chip== `--chip` is required. Resolves the unique `cores/<pkg>` in the chip topology, then that core's balldomain / memdomain.

==Parameter 2 log-dir== `--log-dir` is required and must be an absolute path. A relative path such as `log/...` is an error.

==Parameter 3 itrace / mtrace== Select which traces to analyze; at least one is required.


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
4. Then `cargo nextest run --test test_bemu -- --workload-toml <workloads-*.toml> --bb-tests-root <bb-tests/output>`.

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
