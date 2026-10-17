# convert-tile-to-buckyball

`convert-tile-to-buckyball` 是 Buckyball 自己实现的 Tile lowering pass。代码在：

```text
stack/compiler/src/Conversion/LowerTileToBuckyball/LowerTileToBuckyballPass.cpp
```

这个 pass 的输入是 `tile.tile_matmul`、`tile.tile_transpose`、`tile.mega_kernel` 等操作，输出是 `scf.for`、`memref.subview` 和 Buckyball op。它不是简单地把 op 名字换掉，而是在这里处理 shape、padding、tiling 和部分硬件限制。

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

然后把 M pad 到 8 的倍数、K/N pad 到 16 的倍数：

```text
M_pad = ceil(M / 8) * 8
K_pad = ceil(K / 16) * 16
N_pad = ceil(N / 16) * 16
```

如果原始 shape 不满足上述对齐要求，会分配 padded buffer，先填 0，再把有效区域 copy 进去。计算完成后，只把 `C_pad` 的有效区域 copy 回原始 C。

tile size 由 SMatMul lowering 固定。基本粒度是：

```text
M 方向: 8
N 方向: 16
K 方向: 浮点和带量化参数的路径保留完整 K；INT8 路径按 16 切分
```

带量化参数的路径保留完整 N，由后续转换处理输出分块。INT8 tile 还需满足目标 bank depth 限制。

```text
kBankLane = 16
```

如果 K 方向只需要一个 tile，lowering 结构大致是：

```text
for k in 0..K_pad step kTileSize:
  for m in 0..M_pad step mTileSize:
    for n in 0..N_pad step nTileSize:
      buckyball.smatmul_matmul A_tile, B_tile, C_tile
```

如果 K 被拆成多个 tile，Tile 层会显式分配 partial buffer，并在 INT32 memref 上累加：

```text
fill C_tile with zero
for k in 0..K_pad step kTileSize:
  buckyball.smatmul_matmul A_tile, B_tile, partial
  C_tile += partial
```

这个设计让 `buckyball.smatmul_matmul` 保持覆盖写语义，不需要在 Bank SSA 或 ISA 层理解 partial accumulation。

## transpose

`tile.tile_transpose` 会先检查输出 shape 是否真的是输入 shape 的转置。当前生成 `buckyball.mem_transpose`，随后由 Bank SSA pass 转成 `linalg.generic` 内存转置；不会自动展开为 TransposeBall 的 bank 操作。

## conv2d

`tile.tile_conv2d` 当前按 NHWC 输入和 HWCF filter 处理：

```text
input : [N, H, W, C]
filter: [KH, KW, C, OC]
output: [N, OH, OW, OC]
```

当前 pass 未注册 `tile.tile_conv2d` 的直接转换；量化卷积通过 `tile.mega_kernel` 及后续 Bank SSA lowering 处理。

用法示例：

```bash
buddy-opt --target=pebble input.mlir -convert-tile-to-buckyball
```

具体实现可以看：

```text
examples/balls/smatmul/compiler/src/Conversion/LowerTileToBuckyball/TileMatMulPatterns.cpp
```
