# kernel

`kernel` 构建 Buckyball 使用的 RISC-V 启动镜像。源码在 `bb-tests/workloads/lib/kernel`，产物写入 `bb-tests/output/kernel`；指定 `--chip` 时写入 `bb-tests/output/kernel/<chip>`。

## 镜像内容

镜像由 OpenSBI、Linux Image 和 rootfs 组成。OpenSBI 负责机器态初始化，Linux 运行用户程序，rootfs 包含 BusyBox、`/init` 和 workload 或模型文件。仿真和上板流程使用同一套 `fw_payload` 产物。

```text
0x00010000  BootROM
0x80000000  OpenSBI + Linux Image + initramfs/rootfs
```

## build

```bash
bbdev kernel --build
bbdev kernel --build '--chip toy'
bbdev kernel --build '--chip pebble --model lenet'
bbdev kernel --build '--chip pebble --model lenet --model-storage ddr --guest-memory-mib 4096'
bbdev kernel --build '--chip toy --interactive'
```

构建流程由 `bbdev/api/steps/kernel/01_build_event.step.py` 驱动：先用 CMake 配置 `bb-tests/workloads/lib/kernel`，再构建 `kernel-build`，最后把二进制转换成 Verilog hex。指定 chip 且不指定 model 时，workload 列表来自 `examples/chips/<chip>/kernel/workloads.toml`。

默认产物为：

```text
bb-tests/output/kernel/fw_payload.bin
bb-tests/output/kernel/fw_payload.elf
bb-tests/output/kernel/fw_payload.hex
```

指定 chip、model、内存大小或存储方式后，文件名会带上相应后缀，例如 `fw_payload-pebble-linux.bin`、`fw_payload-lenet.bin` 或 `fw_payload-lenet-mem4096M-ddr.bin`。

## 参数

- `--chip`：选择芯片配置。芯片必须存在，并且配置已经安装。
- `--model`：把指定 ModelTest 放进 rootfs，必须和 `--chip` 一起使用。模型产物需要先用 `bbdev model --build '--chip <chip> --model <model>'` 构建。
- `--interactive`：保留交互式 `/init`，启动后进入 shell，不自动执行 workload。
- `--hart-count`：设置 Linux 可见的 hart 数量；指定 chip 时必须与生成配置中的拓扑一致，未指定 chip 时默认值为 64。
- `--guest-memory-mib`：设置 guest 内存大小，范围是 1 到 16384 MiB，默认 512 MiB。
- `--model-storage`：模型存储位置，取 `initramfs` 或 `ddr`。使用 `ddr` 时必须指定 model，且 guest 内存小于 16384 MiB；构建结果还会包含 `.load.json` 清单。

`--model` 和 `--chip` 的派生产物都由工具生成，不要手动复制到 `bb-tests/output`。如果配置、workload 或模型发生变化，重新运行对应的 build 命令。
