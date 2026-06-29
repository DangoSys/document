# kernel

`kernel` 负责构建 Buckyball 的 Linux 启动镜像。源码在 `bb-tests/workloads/lib/kernel`，产物是 OpenSBI、Linux 内核和 initramfs 打包成的 `fw_payload.bin`，用于需要操作系统的仿真或上板场景。与 `workload build` 输出的 baremetal 程序不同，这里产出的是一份可以直接启动 Linux 的固件。

`kernel build` 通过 CMake 完成构建，产物写入 `bb-tests/output/kernel/`。可通过 `--visible-hart-count` 和 `--total-hart-count` 配置 hart 数量，默认均为 64；`--model` 可选 `lenet`、`mobilenet`、`resnet`、`yolo` 等，会把对应 ModelTest 的运行时文件打包进 initramfs。不同配置会生成不同文件名，例如 `fw_payload.bin` 或 `fw_payload-v64-t256-lenet.bin`。
