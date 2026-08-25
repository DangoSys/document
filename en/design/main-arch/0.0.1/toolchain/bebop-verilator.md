# bebop-verilator

`bebop-verilator` is bebop-accelerated Verilator RTL simulation. Unlike `bebop-bemu`, it actually runs generated RTL, so it can catch timing, interface handshakes, bank access, and other issues invisible to pure software simulation. The cost is slower runs, and the first time requires Verilog generation and simulator compilation.

Recommended order:

1. Get functionality working with `bebop-bemu` first.
2. Then use `bebop-verilator` on the same workload for RTL cross-check.
3. After RTL or config changes, redo `verilog` + `build`; when only the workload changes, an existing simulator can go straight to `sim`.

The mill class is not a CLI flag; it lives in `examples/chips/<chip>/chip.toml` as `[chip].verilatorConfig`, e.g.:

```text
toy    → sims.verilator.BuckyballToyVerilatorConfig
pebble → sims.verilator.BuckyballPebbleVerilatorConfig
```

Artifacts default to `arch/build/<config-name>/`.


## clean

`bebop-verilator clean` deletes the build directory for the specified config, i.e. `arch/build/<config-name>`. Use when switching configs, when Verilog generation is abnormal, or when build cache may be stale.

Usage:

```bash
bbdev bebop-verilator --clean '--chip toy'
```

==Parameter 1 chip== `--chip` is required. Mill class comes from `chip.toml` `[chip].verilatorConfig`.

==Parameter 2 output-dir== `--output-dir` is optional. Specifies the directory to clean. Defaults to the path derived from config.


## verilog

`bebop-verilator verilog` only exports RTL; it does not compile the simulator. It invokes mill from `--chip` (`[chip].verilatorConfig`) and generates Chisel output to `arch/build/<config-name>/`.

Usage:

```bash
bbdev bebop-verilator --verilog '--chip toy'
bbdev bebop-verilator --verilog '--chip pebble'
```

==Parameter 1 chip== `--chip` is required.

==Parameter 2 output-dir== `--output-dir` is optional. Specifies the Verilog output directory.


## build

`bebop-verilator build` compiles the bebop Verilator simulation binary from Verilog generated in the previous step. Requires the directory pointed to by `VSRC_PATH` to exist, i.e. `verilog` must have been run first. After build, a build marker is written under `bebop`; later `sim` checks that the marker matches the current config / vsrc, and errors if not, to avoid running an old binary against new RTL.

Usage:

```bash
bbdev bebop-verilator --build '--jobs 16'
```

==Parameter 1 chip== `--chip` is required.

==Parameter 2 jobs== `--jobs` is optional, default `16`. Parallelism passed to `cargo build`.


## sim

`bebop-verilator sim` runs a single workload. Requires the current config to have been `build` and the build marker to be current.

Execution steps:

1. Check that `arch/build/<config-name>` exists.
2. Check `bebop/target/<chip>/release/bebop` and the build marker (`bebop/target/<chip>/.bbdev-verilator-build.json`).
3. Find the ELF by name under `bb-tests/output/<chip>/workloads/src`.
4. Run `bebop run verilator --elf ...`.
5. Logs go to `log/<timestamp>-verilator-<binary>`; waveforms go to `waveform/` under that directory.

Usage:

```bash
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-baremetal'
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-baremetal --itrace --mtrace --pmctrace --ctrace --banktrace'
bbdev bebop-verilator --sim '--binary pebble_conv_im2col_test-baremetal --no-wave'
```

==Parameter 1 chip== `--chip` is required.

==Parameter 2 binary== `--binary` is required. Provide the workload artifact name; same search under `bb-tests/output/<chip>/workloads/src` as bemu.

==Parameter 3 no-wave== `--no-wave` is optional. Disables waveforms; enable for batch or pass/fail-only runs for a speedup.

==Parameter 4 trace flags== `--itrace`, `--mtrace`, `--pmctrace`, `--ctrace`, `--banktrace` are all optional. Enable when you need instruction flow, memory access, PMC, control flow, or bank access. Enabling all slows runs significantly and produces much larger logs.

Direct `bebop run verilator` requires `--log-dir`; waveforms go to `log_dir/waveform/`.


## run

`bebop-verilator run` is end-to-end: `clean → verilog → build → sim`. Use when first setting up the environment or when you need to redo the full pipeline for the current config. For day-to-day workload iteration, do not `run` every time — too slow; if RTL is unchanged, use `sim` directly.

Usage:

```bash
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-baremetal'
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-baremetal --itrace --mtrace --pmctrace --ctrace --banktrace'
```

Parameters align with `clean` / `verilog` / `build` / `sim`: `--chip`, `--binary` required; `--jobs`, trace flags, `--no-wave` optional.


## batch

`bebop-verilator batch` runs nextest in bulk according to the chip's regression list. Same as bemu, lists are at:

```text
examples/chips/<chip>/regression/batch/verilator/workloads-elf.toml
examples/chips/<chip>/regression/batch/verilator/workloads-pk.toml
```

Note: batch does not rebuild for you. Ensure `--chip` has completed `verilog` + `build` before running, or it will fail due to missing `VSRC_PATH` or a mismatched simulator.

Usage:

```bash
bbdev bebop-verilator --clean '--chip pebble'
bbdev bebop-verilator --verilog '--chip pebble'
bbdev bebop-verilator --build '--jobs 16'
bbdev bebop-verilator --batch '--chip pebble --test elf-tests --clean-before'
```

Batch DiffTest requires building the chip-specific Verilator+BEMU executable with `--diff`, then passing `--diff` to batch:

```bash
bbdev bebop-verilator --build '--diff --jobs 16'
bbdev bebop-verilator --batch '--diff --chip toy --test elf-tests --clean-before'
```

==Parameter 1 chip== `--chip` is required. Determines which chip's regression toml to read.

==Parameter 2 output-dir== `--output-dir` is optional.

==Parameter 3 test== `--test` is required; `elf-tests` or `pk-tests`.

==Parameter 4 clean-before== `--clean-before` is optional. Clears `bebop/test-artifacts` before running.

==Parameter 5 diff== `--diff` is optional. It runs every workload with both Verilator RTL and the selected chip's BEMU and performs bank DiffTest. It cannot be combined with `--rushB`. Each case writes `bank_diff.ndjson` under `examples/chips/<chip>/emu/test-artifacts/difftest-<timestamp>-<workload>/log/`.


## Common Pitfalls

1. bemu passes but verilator fails: suspect RTL, interface timing, or bank layout first — not the test case itself. This is why bemu runs first.
2. `binary not found`: usually missing `workload --build`, or `--chip` does not match the built artifacts.
3. `VSRC_PATH does not exist` / build marker mismatch: Verilog not generated, or config changed but old build still in use. Re-run `verilog` + `build`.
4. Before switching chips, run `bbdev workload --clean`, then build for the new chip, to avoid stale ELFs with the same name in `bb-tests/output` causing batch list mismatches.
