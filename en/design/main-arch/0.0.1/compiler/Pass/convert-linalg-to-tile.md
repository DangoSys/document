# convert-linalg-to-tile

`convert-linalg-to-tile` rewrites Linalg operators into the Tile dialect. The implementation is not in Buckyball’s own `compiler/src`; it lives in buddy-mlir:

```text
compiler/thirdparty/buddy-mlir/midend/lib/Conversion/LowerLinalgToTile/LowerLinalgToTile.cpp
```

This pass handles entry points including `linalg.matmul`, `linalg.batch_matmul`, and some `linalg.conv_2d_*` ops. Output is `tile.tile_matmul` or `tile.tile_conv2d`. For example, an ordinary matmul goes from:

```text
linalg.matmul ins(%a, %b) outs(%c)
```

to:

```text
tile.tile_matmul %a %b %c
```

Matmul supports the default indexing map and a transposed-B form. When B is transposed, the pass first allocates a temporary memref, physically lays out B as `KxN`, then emits `tile.tile_matmul`. Matmul with rank 3 and batch dimension 1 is first collapsed to rank 2 via `memref.collapse_shape`.

Batch matmul is split along the batch dimension into sub-matrices. Each batch slice gets one `tile.tile_matmul`. This step is still static expansion, not keeping a batch op in the Tile layer.

Conv2d is converted to `tile.tile_conv2d` only when it meets conditions that current Buckyball Tile lowering can handle. The code checks that input, filter, and output are rank-4 static memref, element type is f32, and im2col-related parameters fit within current bank depth and instruction field limits. When those conditions are not met, the pass does not force a rewrite.

Usage example:

```bash
buddy-opt input.mlir -convert-linalg-to-tile
```

Related tests:

```text
compiler/thirdparty/buddy-mlir/tests/Conversion/lower-linalg-to-tile-batchmatmul-transpose-b.mlir
bb-tests/workloads/src/OpTest/linalg
```
