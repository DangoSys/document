# 端到端实现 LeNet 加速 (上篇: workload分析 与 编译器)


上一节我们的设计流程从spec→workload→rtl拓展为spec→workload→bebop→rtl。
这一节让我们来继续延长这个设计的链条。

model→profiling→spec→compiler→test case→bebop→rtl

这一篇只走前半段：从 model 到 compiler。后半段（test case、bebop、rtl）放到中篇。

## 为什么是 LeNet

要加速一个模型，总得先挑一个。LeNet 是识别手写数字的小网络，参数不到 5 万个，一张 28×28 的灰度图进去，出来 10 个数字的得分。它小，但该有的东西都有：卷积、池化、全连接。拿它走通一遍，换成更大的模型时流程是一样的。

## model：看看它长什么样

下面是 `buddy-mlir/examples/BuddyLeNet/model.py` 里的定义：

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

## profiling：时间都花在哪

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

## spec：决定要加速什么

spec 就是把“要做什么”先写清楚，不用一上来就写得很细。

上一节算下来，卷积占了大部分 MAC。这次先选卷积作为教程的加速对象，做一个能算卷积的 Ball。它的输入是一张特征图和一组卷积核，输出是新的一张特征图。全连接层本质上是矩阵乘，之后有需要再一起考虑。

Ball 具体怎么写，见 [[什么是Ball & 如何写一个Ball]]。

## compiler：模型怎么变成指令

模型是用 PyTorch 写的，硬件认的是一条条自定义指令，中间差着很远。编译器的活就是一层一层往下翻译。Buckyball 的编译器把这个过程拆成了几层：

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
LLVM IR         带上 RISC-V 自定义指令，后面交给 LLVM
```

为什么要分这么多层？每一层只解决一类问题：形状的事在 Tile 层处理完，不留给指令层；存储怎么分配在 Bank 这几层处理，不在最上面去猜。出了问题也好定位，是哪一层的事就去看哪一层。

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

### 自己看一层的结果

编译器里每一层都是一个 pass，可以单独拿出来跑，看输入输出长什么样。比如看 Linalg 到 Tile 这一步：

```bash
buddy-opt input.mlir -convert-linalg-to-tile
```

一个小提醒：这一步要求输入里的数据已经是内存形式（memref），如果直接喂纯数值形式（tensor）的 IR，会报 `expected static memref operands`。先做一遍 bufferize 再喂进去就行。

每一层的细节在设计文档的“编译器”部分，有每个 pass 单独的一页。第一次看不用全读，知道有哪几层、各管什么就够了。

## 小结

这一篇做了三件事：

1. 看模型：LeNet 就是两层卷积加三层全连接
2. 数计算量：卷积占约 85.2% 的 MAC，先作为加速候选，实际耗时需要测量
3. 了解编译器：从 Linalg 一层层降到指令，形状按目标 Ball 和具体 lowering 的要求补齐

下一篇从 test case 开始，真正动手搭一个 NPU，并用差分测试去验证它。
