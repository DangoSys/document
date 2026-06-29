# workload

## build

`workload build` 构建 `bb-tests` 下的测试 workload，底层通过 CMake + Ninja 编译。

==参数==
通过 `--model` 可指定具体模型目标（`lenet`、`mobilenet`、`resnet`、`yolo`），不指定则编译全部。注意指定 `--model` 时只会编译该目标，不会更新其余测试。


## tohex

`workload tohex` 将 `bb-tests/output/workloads/src` 下所有 `-baremetal` ELF 批量转换为 hex 格式，供 P2E FPGA 流程加载。P2E 的 FPGA DDR 加载需要特定的自定义 hex 格式，标准 ELF 或 binary 无法直接使用。转换分两步：先通过 `riscv64-unknown-elf-objcopy -O binary` 将 ELF 展开为 raw binary，再逐字节写成以 `@0` 开头、每行一个字节的大写 hex 文件。`@0` 表示从 DDR 偏移 0 开始，对应 CPU 地址 `0x80000000`，ELF 各 LOAD 段之间的空洞由 objcopy 补零。中间的 `.bin` 文件转换完成后自动删除。