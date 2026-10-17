# 端到端实现 LeNet 加速（上）：模型分析与编译器

前面的 Ball 教程从 `spec → workload → BEMU → RTL` 讲了一个算子如何落地。模型加速再往前走一步：先看模型在做什么，再决定哪些算子交给 Ball，最后让编译器生成能在目标 Chip 上运行的指令。

本篇使用仓库里的 LeNet。它的模型定义在 `stack/models/models/lenet/model.py`，包含两层卷积、两层池化和三层全连接；针对不同 Chip 的 lowering 和运行时位于 `stack/models/archs/buckyball/<chip>/lenet/`。

## 1. 先做模型分析

不要从 RTL 开始。先列出模型的算子、张量形状和数据类型，再看它们是否适合现有 Ball：

| 模型算子 | 需要的能力 | 需要确认的约束 |
| --- | --- | --- |
| Conv2d | im2col、矩阵乘、累加 | 输入布局、kernel、stride、padding |
| MaxPool2d | 窗口归约 | 窗口大小和边界处理 |
| ReLU | 点运算 | 数据类型和 bank 原地写回 |
| Linear | 矩阵乘 | M/K/N 是否能切成硬件 tile |

分析的结果不是一份性能报表，而是一份实现边界：哪些操作可以直接降到 Buckyball，哪些需要 RVV 或软件 kernel，哪些需要新增 Ball。LeNet 的输入和权重还要考虑 bank 宽度、对齐和量化方式，否则编译器即使生成了指令，运行时也无法正确搬运数据。

## 2. 准备模型和编译器

先安装 Chip 配置并构建对应的 compiler：

```bash
bbdev config --install
bbdev compiler --build '--chip pebble'
```

模型构建由 `bbdev model` 负责。它会准备 buddy-mlir 工具，训练或读取 checkpoint，再执行 importer：

```bash
bbdev model --build '--chip pebble --model lenet'
```

模型源代码在 `stack/models/models/lenet/`：

- `prepare.py` 训练或准备 LeNet checkpoint；
- `importer.py` 把模型导入 MLIR，并生成权重和输入资源；
- `configs/model.toml` 保存模型参数；
- `pack.py` 把可执行文件和模型资源打成运行时包。

构建过程的中间文件位于 `stack/models/build/pebble/lenet/`。其中 `forward.mlir` 描述前向计算，`subgraph0.mlir` 是交给加速器 lowering 的子图，`lenet.payload/` 保存权重和参数。先查看这些文件，确认导入阶段没有把算子合并成无法解释的黑盒。

## 3. 从 Linalg 到 Buckyball

LeNet 的 `CMakeLists.txt` 把编译链分成几个阶段：

```text
Linalg
  → Tile
  → Buckyball high-level op
  → Bank SSA
  → physical bank
  → LLVM intrinsic
  → RISC-V custom instruction
```

对应的主要 Pass 是：

1. `convert-linalg-to-tile`：把卷积和矩阵乘变成硬件无关的 Tile 操作；
2. `convert-tile-to-buckyball`：处理 padding、tiling 和 partial accumulation；
3. `lower-buckyball-to-bank-ssa`：把一次算子展开成 bank 分配、搬入、计算、搬出和释放；
4. `assign-physical-banks`：把虚拟 bank 绑定到具体 bank，并插入 `mset`；
5. `lower-bank-ssa-to-intrinsics`：生成 Buckyball intrinsic wrapper；
6. `lower-buckyball`：导出 LLVM dialect 和 RISC-V intrinsic。

每一层只解决一类问题。shape 和 padding 在 Tile 层完成，bank 生命周期在 Bank SSA 层完成，最终编码留给 LLVM 后端。这样修改 bank 数量时，不需要重新解释模型算子；修改模型 shape 时，也不会把物理 bank ID 写进高层 MLIR。

## 4. 用一个算子检查 lowering

不必一开始就编完整个 LeNet。可以先构造一个 `linalg.matmul` 或 `tile.tile_matmul`，观察每一步的输出：

```bash
buddy-opt input.mlir -convert-linalg-to-tile -o tile.mlir
buddy-opt tile.mlir -convert-tile-to-buckyball -o buckyball.mlir
buddy-opt buckyball.mlir -lower-buckyball-to-bank-ssa -o bank.mlir
buddy-opt bank.mlir -assign-physical-banks -o physical.mlir
```

检查重点是：

- shape 是否被补齐到目标 tile；
- `bank_alloc` 和 `bank_release` 是否成对；
- 同一时刻的 bank 数是否超过 Core 配置；
- partial accumulation 是否在 Tile 层已经处理；
- 最终 `rs1`、`rs2` 字段是否满足 Ball 的 ISA 约束。

如果某一步失败，先看该层的输入和错误信息，不要直接修改下一层的指令编码。

## 5. 生成 workload

模型 lowering 通过后，构建目标 Chip 的 ModelTest：

```bash
bbdev workload --build '--chip pebble --model lenet'
```

普通 CTest 和模型 workload 共用 `bb-tests/output/pebble/workloads/src` 作为产物目录，但模型还会在 `stack/models/build/pebble/lenet/artifact/` 保留资源和运行包。后续仿真时必须使用同一个 Chip 生成的产物，不能把 toy 的模型二进制拿到 pebble 上运行。

下一篇会把这个 workload 放进 BEMU、Verilator，并用差分结果检查编译器生成的 bank 操作是否和 RTL 一致。

继续阅读：[第二篇：构建 NPU 与差分测试](端到端实现%20LeNet%20加速%20%28中%29.md) · [第三篇：FPGA 仿真与评估](端到端实现%20LeNet%20加速%20%28下%29.md)
