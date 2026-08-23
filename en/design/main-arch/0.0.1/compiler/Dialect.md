# Dialect

The Buckyball compilation chain mainly uses three dialect layers: Linalg, Tile, and Buckyball. They are not different names for the same abstraction; each handles problems at a different stage.

## Linalg Dialect

Linalg is the input layer and expresses ordinary compute semantics. For example, matrix multiply is:

```text
linalg.matmul
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

This layer does not care how many banks Buckyball has, or how many columns `vecmat16` can process in one shot. It only states that `C = A * B`. Models exported from PyTorch, or hand-written MLIRTests, usually land here or lower first.

## Tile Dialect

Tile sits between hardware-agnostic operators and Buckyball hardware constraints. It still operates on memref, but starts handling hardware granularity. Current main ops include:

- `tile.tile_matmul`
- `tile.tile_transpose`
- `tile.tile_conv2d`

Take `tile.tile_matmul` as an example. Its inputs are still full matrices:

```text
A: memref<MxKxf32>
B: memref<KxNxf32>
C: memref<MxNxf32>
```

During lowering, it checks shapes, applies padding, chooses tile sizes, and generates `scf.for` loops and `memref.subview`. If K must be split, partial accumulation is also finished in the Tile layer. The Buckyball layer then sees regular tiles and does not need to handle arbitrary shapes.

## Buckyball Dialect

The Buckyball dialect expresses accelerator-related operations. Internally it splits into three categories.

The first category is high-level ops, for example:

```text
buckyball.matmul A B C
```

This represents one hardware matrix-multiply tile, but without explicit bank lifetimes yet.

The second category is Bank SSA ops, for example:

```text
buckyball.bank_alloc
buckyball.bank_mvin
buckyball.bank_fp2int
buckyball.bank_transpose
buckyball.bank_vecmat16
buckyball.bank_int2fp
buckyball.bank_mvout
buckyball.bank_release
```

This layer makes dataflow explicit, but banks are still virtual handles. The benefit of virtual banks is that lowering can first describe “which on-chip buffers are needed,” and a later pass assigns physical bank IDs uniformly.

The third category is intrinsic wrappers, for example:

```text
buckyball.mset
buckyball.mvin
buckyball.mvout
buckyball.vecmat16
buckyball.fp2int
buckyball.int2fp
buckyball.transpose
buckyball.fence
```

This layer is close to the ISA. Operands should be physical bank IDs, depth, stride, iter, mode, and similar parameters. After that, `lower-buckyball` lowers them to LLVM intrinsics.
