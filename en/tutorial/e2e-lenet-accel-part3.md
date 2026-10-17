# End-to-End LeNet Acceleration (Part 3: FPGA Simulation and Evaluation)

Run the FPGA flow after the model passes BEMU and Verilator. FPGA testing checks longer runs, memory bandwidth and system software; it does not replace functional tests.

## 1. Build the kernel image

```bash
bbdev config --install
bbdev model --build '--chip pebble --model lenet'
bbdev workload --build '--chip pebble --model lenet'
bbdev kernel --build '--chip pebble --model lenet'
```

The kernel build produces boot images and model resources. For a larger model, put resources in DDR:

```bash
bbdev kernel --build '--chip pebble --model lenet --model-storage ddr --guest-memory-mib 4096'
```

Use the image and load manifest from the same build.

## 2. Run P2E

```bash
bbdev bebop-p2e --verilog '--chip pebble'
bbdev bebop-p2e --buildbitstream '--chip pebble'
bbdev bebop-p2e --runworkload '--chip pebble --image <kernel-or-workload-hex> --bitstream <build-dir>/fpgaCompDir/bitstream.bit'
```

Keep the bitstream fixed while changing a workload. If RTL or Chip configuration changes, rebuild the bitstream and remove stale build output.

## 3. Run FireSim

```bash
bbdev firesim --buildbitstream '--chip pebble'
bbdev firesim --infrasetup '--chip pebble'
bbdev firesim --runworkload '--chip pebble'
```

FireSim takes its workload from the Chip configuration and is useful for long system runs. Keep one variable changed per experiment so a result remains explainable.

## 4. Record the result

Record correctness, total and per-image cycles, memory wait time, FPGA resources, clock frequency and power. Use the same input set and compiler parameters for every comparison. Save the Chip configuration, build arguments, model input and weights, simulator logs, traces, bitstream and reports with the result.
