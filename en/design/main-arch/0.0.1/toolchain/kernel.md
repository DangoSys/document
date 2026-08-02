# kernel

`kernel` builds the Linux boot image used by Buckyball. Source is under `bb-tests/workloads/lib/kernel`; final artifacts are under `bb-tests/output/kernel`.

## What Is a Kernel

We call the image that packages Linux, executables, and data together a kernel.

Linux can boot in many ways; in Buckyball simulation and on-board flows we use only one: the kernel is pre-flashed into DDR, and after power-on BootROM jumps to the kernel content in DDR.

The Buckyball kernel image has three main parts: OpenSBI for machine-mode init and SBI services; Linux Image as the OS that runs user programs; and rootfs embedded in Linux with BusyBox, boot scripts, and workload or model runtime files. Current address layout:

```text
0x00010000  BootROM
            CPU executes here first after reset

0x80000000  fw_payload.bin
            |
            +-- 0x80000000  OpenSBI
            |               Runs in M-mode; initializes interrupts, timers, console, and SBI
            |
            +-- 0x80200000  Linux Image
                            Runs in S-mode; includes initramfs/rootfs
                            rootfs holds BusyBox, /init, workloads or model files
```

![kernel](kernel.svg)

Boot flow:
1. System powers on; kernel is flashed into DDR.
2. After DDR flash completes, CPU powers on and resets.
3. CPU enters BootROM; BootROM performs minimal multi-core sync, then jumps to `0x80000000` with `hartid` and DTB address.
4. OpenSBI runs; it initializes CLINT, PLIC, SCU console, and other platform resources and prepares SBI interfaces for Linux.
5. Switch to S-mode and jump to `0x80200000`. Linux takes over, parses DTB, mounts built-in rootfs, enters `/init`.
6. Linux boot completes; workloads or model programs under `/root` can then run in the Linux environment.


## build

`kernel build` builds Linux firmware. Default artifacts:

```text
bb-tests/output/kernel/fw_payload.bin
bb-tests/output/kernel/fw_payload.hex
```

`.bin` is the OpenSBI fw_payload; `.hex` is the hex file for FPGA DDR backdoor loading.

> [!tip] Note
> Pre-flashing DDR in a real system is not practical; see chip-specific docs for boot flow on each chip.

`kernel build` execution steps:

1. Run commands in the `build` directory under `bb-tests/workloads/lib/kernel`.
2. Build BusyBox and place it in initramfs.
3. Create rootfs. Without `--model`, installs workloads from `bb-tests/output/workloads` into `/root`; with `--model`, installs only the corresponding ModelTest runtime files into `/root`.
4. Build Linux Image with initramfs.
5. Package Linux Image into `fw_payload.bin` with OpenSBI.
6. Convert `fw_payload.bin` to `fw_payload.hex`.

Usage:

```bash
bbdev kernel --build
bbdev kernel --build '--visible-hart-count 64 --total-hart-count 256'
bbdev kernel --build '--visible-hart-count 64 --total-hart-count 256 --model lenet'
```

==Parameter 1 model== `--model` specifies the end-to-end model to pack into rootfs. When set, kernel installs only that model's ModelTest runtime files, not all workloads into `/root`. Supported values: `bert`, `deepseekr1`, `gemma4`, `lenet`, `llama2`, `mobilenet`, `qwen3`, `resnet`, `stable-diffusion`, `yolo`.

Build the corresponding ModelTest workload before specifying `--model`.

```bash
bbdev workload --build '--model lenet'
```

Otherwise kernel build fails when runtime files are missing. `--model` also affects output filenames; e.g. `--model lenet` produces `fw_payload-lenet.bin` and `fw_payload-lenet.hex`.

- [ ] TODO: Add model build to automated workflow


==Parameter 2 total-hart-count== `--total-hart-count` specifies how many harts exist in hardware. Default equals `visible-hart-count`.

Used mainly for multi-core or heterogeneous core configs. Hardware may have many harts, but not all need to be managed by Linux. `total-hart-count` is the hardware total; OpenSBI uses this for platform init and hart info in DTB.

==Parameter 3 visible-hart-count== `--visible-hart-count` specifies how many harts Linux can see; default is 64.

Passed to OpenSBI and Linux boot config. After boot, Linux schedules only these visible harts. Other harts, if present in hardware, are hidden from DTB at boot and not handed to Linux.

If `total-hart-count` is not 1, output filenames get a `t` suffix. If `visible-hart-count` is not 1, output filenames get a `v` suffix. For example `--visible-hart-count 64 --total-hart-count 256` produces:

```text
fw_payload-v64-t256.bin
fw_payload-v64-t256.hex
```
