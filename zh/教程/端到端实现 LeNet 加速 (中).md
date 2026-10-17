# 端到端实现 LeNet 加速（中）：构建 NPU 与差分测试

上一篇已经把 LeNet 的子图降到 Buckyball 指令。本篇关注运行时：模型程序如何加载资源，BEMU 如何执行，Verilator 如何对照 RTL，以及差分测试如何缩小问题范围。

## 1. 先从模型产物开始

确认模型和 workload 都是同一个 Chip：

```bash
bbdev config --install
bbdev model --build '--chip pebble --model lenet'
bbdev workload --build '--chip pebble --model lenet'
```

模型构建目录的职责不同：

```text
stack/models/build/pebble/lenet/
├── generated/       importer 和 compiler 生成的 MLIR、参数和权重
└── artifact/        lenet-run、model.json、lenet.payload 等运行资源
```

`model.json` 描述输入和资源，`lenet.payload` 保存权重和参数，`lenet-run` 是加载器和计算内核的组合。模型程序通过 `stack/runtime` 提供的 workspace、DMA 和 trace 接口访问这些资源。

## 2. 在 BEMU 中先跑通

BEMU 只执行指令语义，适合确认模型程序、资源布局和 Ball 功能模型：

```bash
bbdev bebop-bemu --sim '--chip pebble --binary <lenet-run-产物> --pk --itrace --mtrace'
```

`<lenet-run-产物>` 应从 `bb-tests/output/pebble/workloads/src` 或模型 artifact 目录中确认，不要凭文件名猜。运行日志中至少要检查：

- 程序能找到 `model.json` 和 payload；
- 输入图像和输出分类的形状一致；
- `mtrace` 中的 bank 分配、搬入、计算、搬出顺序符合预期；
- 没有因为 shape 不对而走未实现的 fallback。

如果 BEMU 失败，优先检查编译器输出和模型资源，不要先改 RTL。

## 3. 用 Verilator 对照 RTL

功能模型通过后，生成并编译 pebble 的 RTL：

```bash
bbdev bebop-verilator --run '--chip pebble --binary <lenet-run-产物> --itrace --mtrace --pmctrace --ctrace'
```

对照时需要保持以下内容相同：

- 同一个 model artifact 和输入图像；
- 同一个 Chip 配置和 Core 配置；
- 同一个 compiler 参数；
- 同一个 trace 开关。

比较的顺序建议是：先看程序是否启动，再看第一条 Buckyball 指令，接着看第一笔 mvin 和第一个 Ball 完成，最后比较最终输出。这样能把一个“模型失败”缩成某一条指令或某一次 bank 访问。

## 4. 差分测试的边界

BEMU 和 Verilator 可以使用同一个 workload 做对照。差分测试关注的是 bank 级状态：

```bash
bbdev bebop-verilator --build '--chip pebble --diff --jobs 16'
bbdev bebop-verilator --batch '--chip pebble --diff --test elf-tests --clean-before'
```

差分失败时，先区分三类情况：

1. **指令流不同**：检查 compiler pass、ISA 编码和模型包是否来自同一次构建；
2. **指令流相同但 bank 状态不同**：检查 RTL 的地址、掩码、延迟和完成握手；
3. **bank 状态相同但最终输出不同**：检查运行时解包、输入数据和模型参数。

差分报告位于对应 Chip 的 `examples/chips/<chip>/emu/test-artifacts/`。保留失败目录中的日志和输入，修复后用同一个 case 重跑，不要只看最终分类结果。

## 5. 给模型加 trace

模型 CMake 支持两类对调试有用的 trace：

- `CTRACE`：记录从 Linalg 到 Buckyball 的周期路径；
- `DTRACE`：记录张量在 lowering 各阶段的内容。

可以在模型构建时打开：

```bash
bbdev model --build '--chip pebble --model lenet --ctrace --dtrace'
```

trace 会增加编译和运行时间，日常回归不需要打开。定位问题时只为一个模型和一个输入打开，避免日志淹没关键信息。

## 6. 从单算子到整网

如果整网失败，不要直接修改 LeNet 的所有 Pass。先把失败层拆成单独的 MLIRTest：

1. 用同一组 shape 写一个 matmul 或 conv2d；
2. 在 `bb-tests/workloads/src/MLIRTest` 中单独执行 lowering；
3. 用 BEMU 检查单算子的 bank 结果；
4. 再把它放回 LeNet 子图。

整网只是多个算子按顺序组合。单算子通过后，剩下的问题通常是 workspace、资源加载、跨算子 bank 生命周期或运行时同步。

继续阅读：[第三篇：FPGA 仿真与评估](端到端实现%20LeNet%20加速%20%28下%29.md)
