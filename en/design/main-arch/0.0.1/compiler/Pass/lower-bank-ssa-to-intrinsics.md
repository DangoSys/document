# lower-bank-ssa-to-intrinsics

`lower-bank-ssa-to-intrinsics` lowers Buckyball ops to intrinsic wrappers. Code shares a file with `lower-buckyball`:

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

Input should already have gone through `assign-physical-banks`. That is, virtual bank handles in Bank SSA are replaced by physical bank IDs, and `bank_alloc` / `bank_release` have become `buckyball.mset`.

The main job at this layer is to rewrite ordinary Buckyball wrappers further into `buckyball.intr.*`. For example:

```text
buckyball.mvin
buckyball.mvout
buckyball.mul_warp16
buckyball.intr.transpose
buckyball.intr.im2col
buckyball.intr.fp2int
buckyball.intr.int2fp
buckyball.fence
```

These continue toward `buckyball.intr.*` / LLVM export patterns. For `transpose`, `im2col`, `fp2int`, and `int2fp`, `assign-physical-banks` already packed bank IDs, iter, and related fields into rs1/rs2 form, so this pass does no bank allocation.

This pass and `lower-buckyball` use the same Buckyball LLVM export patterns. The difference is that this pass only converts Buckyball ops to intrinsic wrappers; it does not lower all ordinary MLIR control flow, memref, and arith.

Usage example:

```bash
buddy-opt input.mlir -lower-bank-ssa-to-intrinsics
```

A typical ordering is:

```bash
buddy-opt input.mlir \
  -lower-buckyball-to-bank-ssa \
  -assign-physical-banks \
  -lower-bank-ssa-to-intrinsics
```
