# bebop-verilator

`bebop-verilator` is bebop-accelerated Verilator RTL simulation. Unlike `bebop-bemu`, it actually runs generated RTL, so it can catch timing, interface handshakes, bank access, and other issues invisible to pure software simulation. The cost is slower runs, and the first time requires Verilog generation and simulator compilation.

Recommended order:

1. Get functionality working with `bebop-bemu` first.
2. Then use `bebop-verilator` on the same workload for RTL cross-check.
3. After RTL or config changes, redo `verilog` + `build`; when only the workload changes, an existing simulator can go straight to `sim`.

Common configs:

```text
sims.verilator.BuckyballToyVerilatorConfig
sims.verilator.BuckyballPebbleVerilatorConfig
```

Artifacts default to `arch/build/<config-name>/`.


## clean

`bebop-verilator clean` deletes the build directory for the specified config, i.e. `arch/build/<config-name>`. Use when switching configs, when Verilog generation is abnormal, or when build cache may be stale.

Usage:

```bash
bbdev bebop-verilator --clean '--config sims.verilator.BuckyballToyVerilatorConfig'
```

==Parameter 1 config== `--config` is required. Full Scala/Chipyard simulation config name.

==Parameter 2 output-dir== `--output-dir` is optional. Specifies the directory to clean. Defaults to the path derived from config.


## verilog

`bebop-verilator verilog` only exports RTL; it does not compile the simulator. It invokes mill by `--config` and generates Chisel output to `arch/build/<config-name>/`.

Usage:

```bash
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballPebbleVerilatorConfig'
```

==Parameter 1 config== `--config` is required.

==Parameter 2 output-dir== `--output-dir` is optional. Specifies the Verilog output directory.


## build

`bebop-verilator build` compiles the bebop Verilator simulation binary from Verilog generated in the previous step. Requires the directory pointed to by `VSRC_PATH` to exist, i.e. `verilog` must have been run first. After build, a build marker is written under `bebop`; later `sim` checks that the marker matches the current config / vsrc, and errors if not, to avoid running an old binary against new RTL.

Usage:

```bash
bbdev bebop-verilator --build '--jobs 16 --config sims.verilator.BuckyballToyVerilatorConfig'
```

==Parameter 1 config== `--config` is required.

==Parameter 2 jobs== `--jobs` is optional, default `16`. Parallelism passed to `cargo build`.


## sim

`bebop-verilator sim` runs a single workload. Requires the current config to have been `build` and the build marker to be current.

Execution steps:

1. Check that `arch/build/<config-name>` exists.
2. Check `bebop/target/debug/bebop` and the build marker.
3. Find the ELF by name under `bb-tests/output/workloads/src`.
4. Run `bebop run verilator --elf ...`.
5. Logs default to `arch/log/<timestamp>-<binary>`; waveforms default to `arch/waveform/<timestamp>-<binary>`.

Usage:

```bash
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig --itrace --mtrace --pmctrace --ctrace --banktrace'
bbdev bebop-verilator --sim '--binary pebble_conv_im2col_test-singlecore-baremetal --config sims.verilator.BuckyballPebbleVerilatorConfig --no-wave'
```

==Parameter 1 config== `--config` is required.

==Parameter 2 binary== `--binary` is required. Provide the workload artifact name; same search under `bb-tests/output/workloads/src` as bemu.

==Parameter 3 log-dir / fst-dir== `--log-dir`, `--fst-dir` are optional. Specify text log and waveform directories respectively.

==Parameter 4 no-wave== `--no-wave` is optional. Disables waveforms; enable for batch or pass/fail-only runs for a speedup.

==Parameter 5 trace flags== `--itrace`, `--mtrace`, `--pmctrace`, `--ctrace`, `--banktrace` are all optional. Enable when you need instruction flow, memory access, PMC, control flow, or bank access. Enabling all slows runs significantly and produces much larger logs.


## run

`bebop-verilator run` is end-to-end: `clean → verilog → build → sim`. Use when first setting up the environment or when you need to redo the full pipeline for the current config. For day-to-day workload iteration, do not `run` every time — too slow; if RTL is unchanged, use `sim` directly.

Usage:

```bash
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig --itrace --mtrace --pmctrace --ctrace --banktrace'
```

Parameters align with `clean` / `verilog` / `build` / `sim`: `--config`, `--binary` required; `--jobs`, trace flags, `--log-dir`, `--fst-dir`, `--no-wave` optional.


## batch

`bebop-verilator batch` runs nextest in bulk according to the chip's regression list. Same as bemu, lists are at:

```text
examples/chips/<chip>/regression/batch/verilator/workloads-elf.toml
examples/chips/<chip>/regression/batch/verilator/workloads-pk.toml
```

Note: batch does not rebuild for you. Ensure `--config` has completed `verilog` + `build` before running, or it will fail due to missing `VSRC_PATH` or a mismatched simulator.

Usage:

```bash
bbdev bebop-verilator --clean '--config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --build '--jobs 16 --config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --batch '--chip pebble --config sims.verilator.BuckyballPebbleVerilatorConfig --test elf-tests --clean-before'
```

==Parameter 1 chip== `--chip` is required. Determines which chip's regression toml to read.

==Parameter 2 config== `--config` is required. Determines which built Verilator RTL/simulator to use.

==Parameter 3 test== `--test` is required; `elf-tests` or `pk-tests`.

==Parameter 4 clean-before== `--clean-before` is optional. Clears `bebop/test-artifacts` before running.


## Common Pitfalls

1. bemu passes but verilator fails: suspect RTL, interface timing, or bank layout first — not the test case itself. This is why bemu runs first.
2. `binary not found`: usually missing `workload --build`, or `--chip` does not match the built artifacts.
3. `VSRC_PATH does not exist` / build marker mismatch: Verilog not generated, or config changed but old build still in use. Re-run `verilog` + `build`.
4. Before switching chips, run `bbdev workload --clean`, then build for the new chip, to avoid stale ELFs with the same name in `bb-tests/output` causing batch list mismatches.
