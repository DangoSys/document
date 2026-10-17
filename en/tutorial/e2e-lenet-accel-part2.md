# End-to-End LeNet Acceleration (Part 2: NPU and Differential Testing)

This part runs the same LeNet workload in the functional model and RTL simulator. Keeping the input, model payload and Chip configuration identical makes a mismatch useful.

## 1. Build matching artifacts

```bash
bbdev config --install
bbdev model --build '--chip pebble --model lenet'
bbdev workload --build '--chip pebble --model lenet'
```

The model artifact contains the generated MLIR, `model.json`, payload and the `lenet-run` loader. Confirm the exact binary path under `stack/models/build/pebble/lenet/artifact/` or `bb-tests/output/pebble/workloads/src` before starting the simulator.

## 2. Run BEMU first

```bash
bbdev bebop-bemu --sim '--chip pebble --binary <lenet-run> --pk --itrace --mtrace'
```

BEMU checks instruction semantics, resource loading and Ball behavior without RTL timing. Check that the input and output shapes match, bank allocation and movement are ordered correctly, and no unexpected fallback is used. A BEMU failure usually points to the compiler output, payload layout or runtime.

## 3. Compare with Verilator

```bash
bbdev bebop-verilator --run '--chip pebble --binary <lenet-run> --itrace --mtrace --pmctrace --ctrace'
```

Compare the runs in this order: program start, first Buckyball instruction, first memory transfer, first Ball completion, and final output. If the instruction stream differs, check the compiler and artifact versions. If the stream matches but bank state differs, inspect RTL address, mask, latency and handshake behavior.

## 4. Run differential tests

```bash
bbdev bebop-verilator --build '--chip pebble --diff --jobs 16'
bbdev bebop-verilator --batch '--chip pebble --diff --test elf-tests --clean-before'
```

Keep the failing case, input and trace together. Re-run that case after a fix before starting the full regression. For a whole-model failure, reduce it to one MLIR operator and test the same shape in isolation.

## 5. Enable traces only while debugging

Use `--itrace`, `--mtrace`, `--pmctrace`, `--ctrace` and `--banktrace` to narrow a mismatch. Traces add build and run time, so leave them off for normal regression runs.

Next: [Part 3: FPGA simulation and evaluation](e2e-lenet-accel-part3.md)
