# workload

`workload` 负责构建 `bb-tests/workloads` 里的程序，当前主要包括 CTest、OpTest、ModelTest 和 tutorial 四类。
- tutorial 是教程用的小程序，帮助不熟悉CMake的开发者学习。
- CTest 是手写 C 测试，用于快速测试硬件功能和自定义指令。CTest直接调用软件侧的 Buckyball 指令封装，比如`mvin/mvout`、vecunit、transpose、TLB、MMIO、多核 barrier 等。
- OpTest 是编译器算子测试，用于快速验证编译器实现。输入为 MLIR，检查 Linalg、Tile、Buckyball 这些编译层级能不能正确降到 RISC-V workload。
- ModelTest 是端到端模型测试，用于进行实际任务的性能评估。把 LeNet、YOLO、Llama、Qwen 等模型从 pytorch 编译到加速器能运行的指令流。

## build

`workload build` 用于编译 workload。命令会进入 `bb-tests/build`，执行 `cmake -G Ninja ..` 和 `ninja`，基于 CMake + Ninja 进行构建。用法如下：

```
bbdev workload --build 
bbdev workload --build '--model lenet'
```

==参数==
- 不带参数时，构建除了端到端模型外的所有 workload，包括 tutorial、CTest、OpTest、embench、coremark 等常规测试程序。构建结束后，会自动将 `*-baremetal`、`*-linux` 这些可执行文件同步到 `bb-tests/output/workloads`。
- 通过 `--model` 可指定端到端模型目标，当前支持 `lenet`、`mobilenet`、`resnet`、`yolo`、`bert`、`qwen3`、`gemma4`、`deepseekr1`、`llama2`、`stable-diffusion`、`whisper`。指定 `--model` 时只构建对应 ModelTest 目标，并不会更新其它 workload 如ctest。


## tohex

`workload tohex` 用于把 workload 转成 P2E 可以加载的 hex 文件。P2E 上板流程通过 DDR backdoor 加载程序，输入不是 ELF，而是约定的 hex 格式，所以 baremetal 程序在上板前需要先做一次转换。

命令会扫描 `bb-tests/output/workloads/src` 下所有文件名以 `-baremetal` 结尾的 ELF，并在同目录生成对应的 `.hex` 文件。因为起操作系统的情况，测试用例会被打包成一个完整的kernel烧录进FPGA，kernel的`tohex`转换在`bbdev kernel`中实现。

每个 ELF 的转换分两步，具体逻辑见`elf2hex.py`：

1. 先调用 `riscv64-unknown-elf-objcopy -O binary`，把 ELF 展开成 raw binary。
2. 再把 binary 逐字节写成 hex 文本：第一行是 `@0`，后面每行一个字节，使用两位大写十六进制。

`@0` 表示从 DDR 偏移 0 开始加载，对应 CPU 地址 `0x80000000`。ELF 各个 LOAD 段之间如果有空洞，会在 objcopy 展开成 binary 时补 0。中间生成的 `.bin` 文件只用于转换，写完 `.hex` 后会自动删除。

用法如下：

```bash
bbdev workload --tohex
```

该API没有参数
