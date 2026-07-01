# convert-tile-to-buckyball

`convert-tile-to-buckyball` 是 Buckyball 自己实现的 Tile lowering pass。代码在：

```text
compiler/src/Conversion/LowerTileToBuckyball/LowerTileToBuckyball.cpp
```

这个 pass 的输入是 `tile.tile_matmul`、`tile.tile_transpose`、`tile.tile_conv2d`，输出是 `scf.for`、`memref.subview` 和 Buckyball op。它不是简单地把 op 名字换掉，而是在这里处理 shape、padding、tiling 和部分硬件限制。

## matmul

`tile.tile_matmul` 输入是完整矩阵：

```text
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

pass 先检查 shape：

```text
A.shape = M x K
B.shape = K x N
C.shape = M x N
```

然后把 M/K/N pad 到 16 的倍数：

```text
M_pad = ceil(M / 16) * 16
K_pad = ceil(K / 16) * 16
N_pad = ceil(N / 16) * 16
```

如果原始 shape 不是 16 对齐，会分配 padded buffer，先填 0，再把有效区域 copy 进去。计算完成后，只把 `C_pad` 的有效区域 copy 回原始 C。

tile size 由 pass 根据 bank depth 和 mvin/mvout 深度限制选择。基本粒度是：

```text
M 方向: 16
N 方向: 16
K 方向: 16
```

pass 会优先尝试增大 K tile，再增大 N tile，最后增大 M tile。每个候选 tile 都要满足当前 bank depth，以及代码里写死的 mvin/mvout 深度限制：

```text
kMaxI8MvinDepthLines = 1024
kMaxAccMvoutDepthLines = 256
```

如果 K 方向只需要一个 tile，lowering 结构大致是：

```text
for k in 0..K_pad step kTileSize:
  for m in 0..M_pad step mTileSize:
    for n in 0..N_pad step nTileSize:
      buckyball.matmul A_tile, B_tile, C_tile
```

如果 K 被拆成多个 tile，Tile 层会显式分配 partial buffer，并在 fp32 memref 上累加：

```text
fill C_tile with zero
for k in 0..K_pad step kTileSize:
  buckyball.matmul A_tile, B_tile, partial
  C_tile += partial
```

这个设计让 `buckyball.matmul` 保持覆盖写语义，不需要在 Bank SSA 或 ISA 层理解 partial accumulation。

## transpose

`tile.tile_transpose` 会先检查输出 shape 是否真的是输入 shape 的转置。硬件 transpose 一次按 16 行处理，列方向最多按 64 个 i8 元素处理。pass 会按行列切 tile，每个 tile 生成：

```text
bank_alloc
bank_mvin
bank_transpose
bank_mvout
bank_release
```

如果最后一个 tile 不满 16 行，会按硬件要求在内部补到 16 行，但 mvout 只写回真实输出区域。

## conv2d

`tile.tile_conv2d` 当前按 NHWC 输入和 HWCF filter 处理：

```text
input : [N, H, W, C]
filter: [KH, KW, C, OC]
output: [N, OH, OW, OC]
```

lowering 会把卷积改写成 im2col + matmul 风格的数据流。输入通道 C 会在需要时 pad 到满足 16-byte bank row 的排布。之后通过 `bank_im2col` 从输入 feature map 取 patch，通过 `bank_mul_warp16` 做计算，再把结果写回 output。

用法示例：

```bash
buddy-opt input.mlir -convert-tile-to-buckyball
```

相关测试可以看：

```text
bb-tests/workloads/src/OpTest/tile
```
