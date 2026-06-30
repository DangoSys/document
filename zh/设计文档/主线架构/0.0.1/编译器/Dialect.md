# Dialect

Buckyball 编译链里主要看三层 dialect：Linalg、Tile、Buckyball。它们不是同一种抽象的不同名字，而是负责不同阶段的问题。

## Linalg Dialect

Linalg 是输入层，表达普通计算语义。比如矩阵乘就是：

```text
linalg.matmul
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

这一层不关心 Buckyball 有多少 bank，也不关心 `mul_warp16` 一次能算多少列。它只说明 `C = A * B`。从 PyTorch 导出的模型，或者手写 OpTest，一般会先落到这一层或更低一层。

## Tile Dialect

Tile 是硬件无关算子和 Buckyball 硬件约束之间的中间层。它仍然操作 memref，但开始处理硬件粒度问题。当前主要 op 包括：

- `tile.tile_matmul`
- `tile.tile_transpose`
- `tile.tile_conv2d`

以 `tile.tile_matmul` 为例，它的输入还是完整矩阵：

```text
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

但 lowering 时会检查 shape、做 padding、选择 tile size，并生成 `scf.for` 循环和 `memref.subview`。如果 K 方向需要拆分，partial accumulation 也在 Tile 层做完。这样 Buckyball 层看到的就是规则 tile，不用再处理任意 shape。

## Buckyball Dialect

Buckyball dialect 表达加速器相关的操作。它内部又分三类。

第一类是 high-level op，比如：

```text
buckyball.matmul A B C
```

它表示一次硬件矩阵乘 tile，但还没有显式 bank 生命周期。

第二类是 Bank SSA op，比如：

```text
buckyball.bank_alloc
buckyball.bank_mvin
buckyball.bank_fp2int
buckyball.bank_transpose
buckyball.bank_mul_warp16
buckyball.bank_int2fp
buckyball.bank_mvout
buckyball.bank_release
```

这一层把数据流写清楚了，但 bank 仍然是虚拟 handle。虚拟 bank 的好处是 lowering 可以先描述“需要哪些片上缓冲”，再由后面的 pass 统一分配物理 bank ID。

第三类是 intrinsic wrapper，比如：

```text
buckyball.mset
buckyball.mvin
buckyball.mvout
buckyball.mul_warp16
buckyball.fp2int
buckyball.int2fp
buckyball.transpose
buckyball.fence
```

这一层已经接近 ISA。操作数里应该是物理 bank ID、depth、stride、iter、mode 这类参数。再往后，`lower-buckyball` 会把它们降到 LLVM intrinsic。
