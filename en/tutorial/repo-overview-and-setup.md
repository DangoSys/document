# Repository overview and setup

## What is Buckyball?

Buckyball is a software and hardware framework for domain-specific architectures (DSAs). It keeps instruction interfaces, scheduling, bank memory, compilation, simulation, verification, and runtime support in the shared mainline so a project can focus on its Core, Balls, and Chip.

The repository is organized by responsibility:

```text
arch/       shared hardware framework: Frontend, MemDomain, BallDomain, banks, interconnect
bbdev/      unified developer entry point: CLI, HTTP API, MCP
bebop/      BEMU, Verilator nodes, and traces
stack/      compiler, runtime, platforms, models, serving, simulations
examples/   Ball, Core, and Chip instances and configuration
bb-tests/   CTest, MLIRTest, kernels, workloads, and regression output
verify/     shared UVM environments and IP/Ball verification
```

A Ball is connected to a Core's BallDomain. A Chip selects a Core through its Tile configuration, then runs it with BEMU, Verilator, or an FPGA flow. Chip configuration starts at `examples/chips/<chip>/configs/chip.toml`; files under `configs/generated/` are generated outputs.

## Environment setup

Buckyball uses a Nix Flake for the compiler, RISC-V toolchains, Verilator, CMake, Ninja, Rust, and simulation dependencies. Linux and network access to GitHub are recommended.

### 1. Install Nix

Install Nix using the official installer or Determinate Systems. Confirm that `nix --version` works and that flakes are enabled.

```bash
curl -fsSL https://install.determinate.systems/nix | sh -s -- install
```

### 2. Initialize the repository

```bash
git clone https://github.com/DangoSys/buckyball.git
cd buckyball
./scripts/nix/build-all.sh
```

The setup script enters the Nix environment, initializes submodules, installs `bbdev`, and builds the compiler, RTL prerequisites, workloads, Bebop, and verification environment. Later sessions only need:

```bash
nix develop
```

### 3. Build and run a workload

```bash
bbdev config --install
bbdev workload --build '--chip toy'
bbdev bebop-bemu --sim '--chip toy --binary toy-toy-ctest-relu_i32_16x16_test-baremetal'
```

BEMU checks instruction and functional-model behavior. To run the same workload against generated RTL:

```bash
bbdev bebop-verilator --run '--chip toy --binary toy-toy-ctest-relu_i32_16x16_test-baremetal --no-wave'
```

Remove `--no-wave` and add trace flags such as `--itrace`, `--mtrace`, `--pmctrace`, `--ctrace`, or `--banktrace` when debugging. Logs are written under `log/`; waveforms are under the corresponding `waveform/` directory.

## Next steps

- Read the [design overview](../design/overview.md) and [main architecture overview](../design/main-arch/0.0.1/overview/overview.md).
- Read [what is a Ball and how to write one](what-is-ball-and-how-to-write-one.md) before adding a Ball.
- Read the [toolchain overview](../design/main-arch/0.0.1/toolchain/overview.md) for compiler and regression workflows.
