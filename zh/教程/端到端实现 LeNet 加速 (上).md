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

### 为什么是 LeNet

要加速一个模型，总得先挑一个。LeNet 是识别手写数字的小网络，参数不到 5 万个，一张 28×28 的灰度图进去，出来 10 个数字的得分。它小，但该有的东西都有：卷积、池化、全连接。拿它走通一遍，换成更大的模型时流程是一样的。

### model：看看它长什么样

下面是 `stack/models/models/lenet/model.py` 里的定义：

```python
class LeNet(nn.Module):
    def __init__(self):
        super(LeNet, self).__init__()
        self.conv1 = nn.Conv2d(1, 6, 5)
        self.pool = nn.MaxPool2d(2, 2)
        self.conv2 = nn.Conv2d(6, 16, 5)
        self.fc1 = nn.Linear(16 * 4 * 4, 120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10)

    def forward(self, x):
        x = self.pool(torch.relu(self.conv1(x)))
        x = self.pool(torch.relu(self.conv2(x)))
        x = x.view(-1, 16 * 4 * 4)
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.fc3(x)
        return x
```

一张图经过的形状变化是这样的：

| 步骤 | 输出形状 |
|---|---|
| 输入 | 1 × 28 × 28 |
| conv1（1→6，5×5） | 6 × 24 × 24 |
| relu + pool | 6 × 12 × 12 |
| conv2（6→16，5×5） | 16 × 8 × 8 |
| relu + pool | 16 × 4 × 4 |
| 拉平 | 256 |
| fc1 → fc2 → fc3 | 120 → 84 → 10 |

### profiling：时间都花在哪

profiling 要测量各层的实际耗时，再决定加速什么。这里先数一遍乘加次数（MAC，一次乘法加一次加法），看看计算量怎么分布，作为选择加速对象的参考：

| 层 | MAC 次数 | 占比 |
|---|---:|---:|
| conv1 | 86,400 | 30.7% |
| conv2 | 153,600 | 54.5% |
| fc1 | 30,720 | 10.9% |
| fc2 | 10,080 | 3.6% |
| fc3 | 840 | 0.3% |
| 合计 | 281,640 | 100% |

以 conv2 为例：输出有 16×8×8 个数，每个数要做 6×5×5 次乘加，所以是 16×8×8×6×25 = 153,600。

两层卷积合计占约 85.2% 的 MAC，全连接合计约占 14.8%。pool 和 relu 做的是比较，不计入这张 MAC 表。

从 MAC 数量看，可以先把卷积列为加速候选。实际时间花在哪，还受访存、数据布局和算子实现影响，需要在目标平台上测量；pool 和 relu 的耗时也要一起看。

### spec：决定要加速什么

spec 就是把“要做什么”先写清楚，不用一上来就写得很细。

上一节算下来，卷积占了大部分 MAC。这次先选卷积作为教程的加速对象，做一个能算卷积的 Ball。它的输入是一张特征图和一组卷积核，输出是新的一张特征图。全连接层本质上是矩阵乘，之后有需要再一起考虑。

Ball 具体怎么写，见 [[什么是Ball & 如何写一个Ball]]。

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

构建过程的中间文件位于 `stack/models/build/pebble/lenet/`。其中 `generated/forward.mlir` 描述前向计算，`generated/subgraph0.mlir` 是交给加速器 lowering 的子图，`artifact/lenet.payload/` 保存权重和参数。先查看这些文件，确认导入阶段没有把算子合并成无法解释的黑盒。

## 3. 从 Linalg 到 Buckyball

LeNet 的 `CMakeLists.txt` 把编译链分成几个阶段：

```text
PyTorch 模型
   ↓ 导入
Linalg          只表达“这是个卷积 / 矩阵乘”，不管硬件
   ↓ convert-linalg-to-tile
Tile            把形状整理成硬件吃得下的块
   ↓ convert-tile-to-buckyball
Buckyball       表达“我要让硬件做一次运算”
   ↓ lower-buckyball-to-bank-ssa
Bank SSA        把数据在片上存储（bank）里怎么流动写出来
   ↓ assign-physical-banks
                把虚拟的 bank 绑定到具体的 bank 编号
   ↓ lower-bank-ssa-to-intrinsics → lower-buckyball
指令 wrapper    完成其余方言转换后，导出 LLVM IR，交给 LLVM
```

对应的主要 Pass 是：

1. `convert-linalg-to-tile`：把卷积和矩阵乘变成硬件无关的 Tile 操作；
2. `convert-tile-to-buckyball`：处理 padding、tiling 和 partial accumulation；
3. `lower-buckyball-to-bank-ssa`：把一次算子展开成 bank 分配、搬入、计算、搬出和释放；
4. `assign-physical-banks`：把虚拟 bank 绑定到具体 bank 编号，并插入 `mset`；
5. `lower-bank-ssa-to-intrinsics`：生成 Buckyball intrinsic wrapper；
6. `lower-buckyball`：生成可导出的指令 wrapper；LLVM IR 由后续翻译步骤导出。

每一层只解决一类问题。shape 和 padding 在 Tile 层完成，bank 生命周期在 Bank SSA 层完成，最终编码留给 LLVM 后端。这样修改 bank 数量时，不需要重新解释模型算子；修改模型 shape 时，也不会把物理 bank ID 写进高层 MLIR。

### 拿 LeNet 举个例子：形状要补齐

有些矩阵的大小不符合硬件要求，编译器会先补 0。以当前的 SMatMul 为例，输入矩阵的行数要凑成 8 的倍数，输入和输出矩阵的列数要凑成 16 的倍数。其他 Ball 的要求可能不同。

LeNet 的全连接层按这个规则处理时，行数、列数会变成这样：

| 要补齐的大小 | 原来 | 补齐后 |
|---|---:|---:|
| 输入矩阵的行数（单张图推理） | 1 | 8 |
| fc2 输出矩阵的列数 | 84 | 96 |
| fc1 输出矩阵的列数 | 120 | 128 |
| fc3 输出矩阵的列数 | 10 | 16 |

补上去的部分填 0，计算后取回原始形状范围内的结果。这样会增加存储和计算开销：例如 fc3 的输出按 16 列计算，其中真正有用的只有 10 列。卷积的通道数怎么处理，要看对应的卷积 lowering，不能直接套用这个矩阵乘规则。

## 4. 用一个算子检查 lowering

不必一开始就编完整个 LeNet。可以先构造一个 `linalg.matmul` 或 `tile.tile_matmul`，观察每一步的输出：

```bash
buddy-opt input.mlir -convert-linalg-to-tile -o tile.mlir
buddy-opt --target=pebble tile.mlir -convert-tile-to-buckyball -o buckyball.mlir
buddy-opt --target=pebble buckyball.mlir -lower-buckyball-to-bank-ssa -o bank.mlir
buddy-opt --target=pebble bank.mlir -assign-physical-banks -o physical.mlir
```

一个小提醒：这一步要求输入里的数据已经是内存形式（memref），如果直接喂纯数值形式（tensor）的 IR，会报 `expected static memref operands`。先做一遍 bufferize 再喂进去就行。

每一层的细节在设计文档的“编译器”部分，有每个 pass 单独的一页。第一次看不用全读，知道有哪几层、各管什么就够了。

检查重点是：

- shape 是否被补齐到目标 tile；
- `bank_alloc` 和 `bank_release` 是否成对；
- 同一时刻的 bank 数是否超过 Core 配置；
- partial accumulation 是否在 Tile 层已经处理；
- 最终 `rs1`、`rs2` 字段是否满足 Ball 的 ISA 约束。

如果某一步失败，先看该层的输入和错误信息，不要直接修改下一层的指令编码。

## 5. 生成 workload

模型 lowering 通过后，构建目标 Chip 的模型程序：

```bash
bbdev model --build '--chip pebble --model lenet'
```

普通 CTest 使用 `bb-tests/output/pebble/workloads/src` 作为产物目录，模型会在 `stack/models/build/pebble/lenet/artifact/` 保留资源和运行包。后续仿真时必须使用同一个 Chip 生成的产物，不能把 toy 的模型二进制拿到 pebble 上运行。

## 小结

这一篇做了三件事：

1. 看模型：LeNet 就是两层卷积加三层全连接
2. 数计算量：卷积占约 85.2% 的 MAC，先作为加速候选，实际耗时需要测量
3. 了解编译器：从 Linalg 一层层降到指令，形状按目标 Ball 和具体 lowering 的要求补齐

下一篇会把这个 workload 放进 BEMU、Verilator，并用差分结果检查编译器生成的 bank 操作是否和 RTL 一致。

继续阅读：[第二篇：构建 NPU 与差分测试](端到端实现%20LeNet%20加速%20%28中%29.md) · [第三篇：FPGA 仿真与评估](端到端实现%20LeNet%20加速%20%28下%29.md)
