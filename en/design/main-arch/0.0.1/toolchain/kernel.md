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
3. Create rootfs. Default uses the shared overlay (interactive shell). With `--chip` alone, layer that chip's OS overlay from `examples/chips/<chip>/kernel/overlay` and install only `*-linux` entries from the chip's bemu `workloads-pk.toml`. With `--model`, `--chip` is required; install only that ModelTest runtime from `archs/buckyball/<chip>/<Model>`.
4. Build Linux Image with initramfs.
5. Package Linux Image into `fw_payload.bin` with OpenSBI.
6. Convert `fw_payload.bin` to `fw_payload.hex`.

Usage:

```bash
bbdev kernel --build
bbdev kernel --build '--chip pebble'
bbdev kernel --build '--chip pebble --model lenet'
bbdev kernel --build '--chip pebble --model lenet --interactive'
bbdev kernel --build '--visible-hart-count 64 --total-hart-count 256'
```

==Parameter 1 chip== `--chip` is used in two modes:

- **`--chip` alone (pk regression)**: each chip owns `examples/chips/<chip>/kernel/` (at least `overlay/init`). When set:
  - overlay: shared `bb-tests/workloads/lib/kernel/overlay` plus chip overlay on top
  - `/root`: only stems listed in that chip's `regression/batch/bemu/workloads-pk.toml` (missing files fail)
  - artifacts: `fw_payload-<chip>-pk.bin` / `.hex`
  - chip `/init` runs `/root/*-linux` serially; success uses `poweroff -f` (OpenSBI → `scu_sim_exit=0`), failure uses `reboot -f` (`sim_exit=1`)
  - cmdline includes `panic=1`: kernel panic cold-reboots through OpenSBI → `sim_exit=1`
- **With `--model`**: only selects the ModelTest output directory `archs/buckyball/<chip>/...`; does not enable pk overlay / workloads-pk install.

==Parameter 2 model== `--model` specifies the end-to-end model to pack into rootfs; **`--chip` is required**. When set, kernel installs only that model's ModelTest runtime files, not all workloads into `/root`. Supported values: `bert`, `deepseekr1`, `gemma4`, `lenet`, `llama2`, `mobilenet`, `qwen3`, `resnet`, `stable-diffusion`, `yolo`.

Build the corresponding ModelTest workload before specifying `--model`.

```bash
bbdev workload --build '--chip pebble --model lenet'
```

Otherwise kernel build fails when runtime files are missing. `--model` also affects output filenames; e.g. `--chip pebble --model lenet` produces `fw_payload-lenet.bin` and `fw_payload-lenet.hex`.

With `--model`, `/init` auto-runs the corresponding `buddy-buckyball-*-run` under `/root`: success `poweroff -f`, failure `reboot -f` (same as chip pk regression).

==Parameter 3 interactive== `--interactive` keeps the shared overlay interactive shell (`/init` → `/bin/sh -i`) and does not auto-run chip/model workloads. Matching files are still installed under `/root` for manual runs. Combines with `--chip` or `--chip --model`.

- [ ] TODO: Add model build to automated workflow


==Parameter 4 total-hart-count== `--total-hart-count` specifies how many harts exist in hardware. Default equals `visible-hart-count`.

Used mainly for multi-core or heterogeneous core configs. Hardware may have many harts, but not all need to be managed by Linux. `total-hart-count` is the hardware total; OpenSBI uses this for platform init and hart info in DTB.

==Parameter 5 visible-hart-count== `--visible-hart-count` specifies how many harts Linux can see; default is 64.

Passed to OpenSBI and Linux boot config. After boot, Linux schedules only these visible harts. Other harts, if present in hardware, are hidden from DTB at boot and not handed to Linux.

If `total-hart-count` is not 1, output filenames get a `t` suffix. If `visible-hart-count` is not 1, output filenames get a `v` suffix. For example `--visible-hart-count 64 --total-hart-count 256` produces:

```text
fw_payload-v64-t256.bin
fw_payload-v64-t256.hex
```
