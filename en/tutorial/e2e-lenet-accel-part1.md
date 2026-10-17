# End-to-End LeNet Acceleration (Part 1: Model Analysis and Compiler)

This tutorial follows the LeNet model in the repository from model analysis to a Chip workload. The complete path is:

```text
model → compiler → workload → BEMU → Verilator → FPGA
```

## 1. Inspect the model

The model is under `stack/models/models/lenet/`. It contains convolution, pooling, ReLU and fully connected layers. Before changing hardware, list each operator's shape, data type, layout and padding. Then decide which operators map to existing Balls, which stay in the software kernel, and which need a new Ball.

| Operator | Hardware question |
| --- | --- |
| Conv2d | Can the matrix dimensions and padding fit the tile? |
| MaxPool2d | How are windows at the image boundary handled? |
| ReLU | Can the result be written back in place? |
| Linear | How are M/K/N split across the banks? |

The target-specific lowering and runtime code is under `stack/models/archs/buckyball/<chip>/lenet/`.

## 2. Build the model

Install the Chip configuration and compiler first:

```bash
bbdev config --install
bbdev compiler --build '--chip pebble'
bbdev model --build '--chip pebble --model lenet'
```

The build directory is `stack/models/build/pebble/lenet/`. Inspect `forward.mlir`, `subgraph0.mlir` and the generated payload before running the full model. `forward.mlir` represents the imported graph; `subgraph0.mlir` is the part lowered to Buckyball operations.

## 3. Follow the lowering pipeline

The model compiler applies the following stages:

```text
Linalg → Tile → Buckyball op → Bank SSA → physical bank → LLVM/RISC-V intrinsic
```

The corresponding passes are `convert-linalg-to-tile`, `convert-tile-to-buckyball`, `lower-buckyball-to-bank-ssa`, `assign-physical-banks` and `lower-bank-ssa-to-intrinsics`. Each stage has one job: shape and padding belong to Tile, bank lifetime belongs to Bank SSA, and instruction encoding belongs to the LLVM backend.

When debugging, run a single matmul or convolution through the stages and inspect each output:

```bash
buddy-opt input.mlir -convert-linalg-to-tile -o tile.mlir
buddy-opt tile.mlir -convert-tile-to-buckyball -o buckyball.mlir
buddy-opt buckyball.mlir -lower-buckyball-to-bank-ssa -o bank.mlir
buddy-opt bank.mlir -assign-physical-banks -o physical.mlir
```

Check that tile shapes are padded correctly, every bank allocation has a release, and the number of live banks fits the Core configuration.

## 4. Build the workload

```bash
bbdev workload --build '--chip pebble --model lenet'
```

The executable is placed under `bb-tests/output/pebble/workloads/src`; model resources remain under the model artifact directory. Keep the Chip, compiler options and model artifact from the same build. The next part runs this workload in BEMU and Verilator.

Next: [Part 2: NPU and differential testing](e2e-lenet-accel-part2.md) · [Part 3: FPGA simulation and evaluation](e2e-lenet-accel-part3.md)
