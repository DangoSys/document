# workload

`workload` builds programs under `bb-tests/workloads`. Currently this includes CTest, OpTest, ModelTest, and tutorial.
- tutorial: small programs for learning CMake.
- CTest: hand-written C tests for quick hardware and custom-instruction checks. CTest calls software-side Buckyball instruction wrappers directly, e.g. `mvin/mvout`, vecunit, transpose, TLB, MMIO, multi-core barrier, etc.
- OpTest: compiler operator tests for verifying compiler implementation. Input is MLIR; checks that Linalg, Tile, Buckyball lowering layers correctly reach RISC-V workloads.
- ModelTest: end-to-end model tests for performance evaluation on real tasks. Compiles models such as LeNet, YOLO, Llama, Qwen from PyTorch into instruction streams the accelerator can run.

## clean

`workload clean` clears the workload output directory. It only deletes `bb-tests/output`, not `bb-tests/build`. CMake/Ninja build cache is preserved so the next `workload build` can reuse the existing build directory.

Use before rebuilding workloads when switching chips, to avoid stale ELFs from other chips in `bb-tests/output` causing duplicate case names in bebop-generated test lists.

Usage:

```bash
bbdev workload --clean
```

This API has no parameters.

## build

`workload build` compiles workloads. The command enters `bb-tests/build`, runs `cmake -G Ninja ..` and `ninja`, and builds with CMake + Ninja. Usage:

```shell
bbdev workload --build '--chip toy'
bbdev workload --build '--chip toy --model lenet'
```

`--chip` is required. Without `--model`, builds all workloads for the specified chip except end-to-end models, including tutorial, CTest, OpTest, embench, coremark, and other regular test programs. After build, `*-baremetal` and `*-linux` executables are synced to `bb-tests/output/workloads`. For chip workloads under `*/chips/<chip>`, only the directory for `--chip` is synced.

==Parameter model== `--model` selects an end-to-end model target. Supported: `lenet`, `mobilenet`, `resnet`, `yolo`, `bert`, `qwen3`, `gemma4`, `deepseekr1`, `llama2`, `stable-diffusion`, `whisper`. With `--model`, only the corresponding ModelTest target is built; other workloads such as ctest are not updated.


## tohex

`workload tohex` converts workloads to hex files loadable by P2E. P2E on-board flow loads programs via DDR backdoor; input is not ELF but the agreed hex format, so baremetal programs need conversion before on-board use.

The command scans all ELFs under `bb-tests/output/workloads/src` whose names end with `-baremetal`, and writes corresponding `.hex` files in the same directory. When booting an OS, test cases are packaged into a full kernel flashed to FPGA; kernel `tohex` conversion is implemented in `bbdev kernel`.

Each ELF conversion has two steps; see `elf2hex.py` for details:

1. Call `riscv64-unknown-elf-objcopy -O binary` to expand ELF to raw binary.
2. Write binary byte-by-byte as hex text: first line `@0`, then one byte per line as two uppercase hex digits.

`@0` means load from DDR offset 0, corresponding to CPU address `0x80000000`. Gaps between ELF LOAD segments are zero-filled when objcopy expands to binary. Intermediate `.bin` files are used only for conversion and are deleted after `.hex` is written.

Usage:

```bash
bbdev workload --tohex
```

This API has no parameters.
