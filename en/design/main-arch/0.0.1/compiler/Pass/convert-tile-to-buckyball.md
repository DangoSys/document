# convert-tile-to-buckyball

`convert-tile-to-buckyball` is Buckyball’s own Tile lowering pass. Code lives at:

```text
compiler/src/Conversion/LowerTileToBuckyball/LowerTileToBuckyball.cpp
```

Input is `tile.tile_matmul`, `tile.tile_transpose`, and `tile.tile_conv2d`. Output is `scf.for`, `memref.subview`, and Buckyball ops. It is not a simple rename: shape, padding, tiling, and some hardware limits are handled here.

## matmul

`tile.tile_matmul` takes full matrices:

```text
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

The pass first checks shapes:

```text
A.shape = M x K
B.shape = K x N
C.shape = M x N
```

Then it pads M/K/N to multiples of 16:

```text
M_pad = ceil(M / 16) * 16
K_pad = ceil(K / 16) * 16
N_pad = ceil(N / 16) * 16
```

If the original shape is not 16-aligned, it allocates padded buffers, fills them with zero, and copies the valid region in. After compute, only the valid region of `C_pad` is copied back to the original C.

Tile size is chosen from bank depth and mvin/mvout depth limits. Basic granularity is:

```text
M direction: 16
N direction: 16
K direction: 16
```

The pass tries to increase K tile first, then N tile, then M tile. Each candidate tile must satisfy current bank depth and the hard-coded mvin/mvout depth limits in the code:

```text
kMaxI8MvinDepthLines = 1024
kMaxAccMvoutDepthLines = 256
```

If K needs only one tile, lowering is roughly:

```text
for k in 0..K_pad step kTileSize:
  for m in 0..M_pad step mTileSize:
    for n in 0..N_pad step nTileSize:
      buckyball.matmul A_tile, B_tile, C_tile
```

If K is split into multiple tiles, the Tile layer explicitly allocates a partial buffer and accumulates on an fp32 memref:

```text
fill C_tile with zero
for k in 0..K_pad step kTileSize:
  buckyball.matmul A_tile, B_tile, partial
  C_tile += partial
```

This design keeps `buckyball.matmul` as overwrite semantics; partial accumulation is not understood in Bank SSA or the ISA layer.

## transpose

`tile.tile_transpose` first checks that the output shape is really the transpose of the input shape. Hardware transpose processes 16 rows at a time; the column direction handles at most 64 i8 elements. The pass tiles by rows and columns; each tile generates:

```text
bank_alloc
bank_mvin
bank_transpose
bank_mvout
bank_release
```

If the last tile has fewer than 16 rows, it is padded internally to 16 rows per hardware requirements, but mvout writes back only the real output region.

## conv2d

`tile.tile_conv2d` currently handles NHWC input and HWCF filter:

```text
input : [N, H, W, C]
filter: [KH, KW, C, OC]
output: [N, OH, OW, OC]
```

Lowering rewrites convolution into an im2col + matmul style dataflow. Input channels C are padded when needed to satisfy 16-byte bank row layout. Patches are then taken from the input feature map via `bank_im2col`, compute runs through `bank_mul_warp16`, and results are written to output.

Usage example:

```bash
buddy-opt input.mlir -convert-tile-to-buckyball
```

Related tests:

```text
bb-tests/workloads/src/OpTest/tile
```
