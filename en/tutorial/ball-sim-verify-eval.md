# Ball simulation, verification, and evaluation

RTL is only one part of a Ball. We also need evidence that the result is correct, the interface obeys the protocol, and the design meets its performance and PPA goals.

## The evidence chain

```text
spec → workload → BEMU → Verilator → UVM → PPA
```

Each stage answers a different question:

| Stage | Question |
| --- | --- |
| spec | Are the fields, bank layout, bounds, and completion semantics defined? |
| workload | Is the input and expected output correct? |
| BEMU | Does the functional model implement the instruction semantics? |
| Verilator | Does RTL preserve data, handshakes, and cycle-level behavior? |
| UVM | Do protocol, random cases, and coverage hold without a full chip workload? |
| PPA | What are throughput, area, timing, and power? |

A BEMU failure points to the test or functional model. A BEMU pass followed by an RTL failure points first to RTL, bank addressing, reset, or handshake. An RTL pass followed by a UVM failure usually points to a protocol assumption or testbench constraint.

## BEMU first

```bash
bbdev config --install
bbdev workload --build '--chip pebble'
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --itrace --mtrace'
```

`itrace` records instructions and `mtrace` records bank activity. The resulting `bdb.ndjson` can be summarized with:

```bash
bbdev bebop-bemu --analysis '--chip pebble --log-dir /abs/path/to/log-dir --itrace --mtrace'
```

Keep the software expected result independent from the Ball implementation. Otherwise a bug in the model and a bug in the test can cancel each other.

## RTL with Verilator

```bash
bbdev bebop-verilator --run '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal'
```

After workload-only changes, use `sim` directly. After RTL or configuration changes, regenerate and rebuild:

```bash
bbdev bebop-verilator --verilog '--chip pebble'
bbdev bebop-verilator --build '--chip pebble --jobs 16'
```

Keep waveforms when debugging; remove `--no-wave` and add trace flags when the software and RTL timelines must be aligned. Common failures are a missing workload, stale Verilator markers, incorrect bank addresses, dropped `cmdResp`, or a ready/valid deadlock.

## UVM and regression

A Ball UVM environment lives under `examples/balls/<ball>/verify`. It can check bank data, addresses, masks, completion IDs, and coverage without bringing up a full Linux image:

```bash
bbdev uvm --build '--ball=transpose'
bbdev uvm --run '--ball=transpose' -- '+BID=0'
```

Once a single case passes, add it to both Chip regression manifests:

```text
examples/chips/<chip>/regression/batch/bemu/workloads-bare.toml
examples/chips/<chip>/regression/batch/verilator/workloads-bare.toml
```

```bash
bbdev bebop-bemu --batch '--chip pebble --test elf-tests --clean-before'
bbdev bebop-verilator --batch '--chip pebble --test elf-tests --clean-before'
```

## PPA

Measure PPA only after correctness is stable. Keep the Chip config, input, compiler parameters, logs, traces, synthesis reports, and power reports together. Compare the same workload before and after a change, and use traces to explain whether a speedup comes from more Ball work, fewer memory stalls, or a changed schedule.
