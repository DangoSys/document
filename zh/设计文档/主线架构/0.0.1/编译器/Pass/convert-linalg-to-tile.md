# convert-linalg-to-tile

`convert-linalg-to-tile` 把 Linalg 算子改写成 Tile dialect。实现不在 Buckyball 自己的 `compiler/src` 里，而在 buddy-mlir：

```text
compiler/thirdparty/buddy-mlir/midend/lib/Conversion/LowerLinalgToTile/LowerLinalgToTile.cpp
```

这个 pass 处理的入口包括 `linalg.matmul`、`linalg.batch_matmul` 和部分 `linalg.conv_2d_*`。输出是 `tile.tile_matmul` 或 `tile.tile_conv2d`。例如普通 matmul 会从：

```text
linalg.matmul ins(%a, %b) outs(%c)
```

变成：

```text
tile.tile_matmul %a %b %c
```

matmul 支持默认 indexing map，也支持 B 转置的形式。遇到 B 转置时，pass 会先分配一个临时 memref，把 B 真实转成 `KxN` 排布，再生成 `tile.tile_matmul`。rank 为 3 且 batch 维度为 1 的 matmul，会先通过 `memref.collapse_shape` 折成 rank 2。

batch matmul 会按 batch 维度拆成多个子矩阵。每个 batch slice 会生成一次 `tile.tile_matmul`。这一步还是静态展开，不是在 Tile 层保留一个 batch op。

conv2d 只在满足当前 Buckyball Tile lowering 能处理的条件时才转成 `tile.tile_conv2d`。代码里会检查输入、filter、输出都是 rank-4 static memref，元素类型是 f32，并且 im2col 相关参数能放进当前 bank depth 和指令字段限制。不满足这些条件时，pass 不会强行改写。

用法示例：

```bash
buddy-opt input.mlir -convert-linalg-to-tile
```

相关测试可以看：

```text
compiler/thirdparty/buddy-mlir/tests/Conversion/lower-linalg-to-tile-batchmatmul-transpose-b.mlir
bb-tests/workloads/src/OpTest/linalg
```
