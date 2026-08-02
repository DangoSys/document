# lower-buckyball-to-bank-ssa

`lower-buckyball-to-bank-ssa` expands high-level Buckyball ops into explicit bank dataflow. Code lives at:

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballToBankSSAPass.cpp
```

Currently this pass mainly handles `buckyball.matmul`. Input is still operator form:

```text
buckyball.matmul %a %b %c
```

Output becomes bank-level ops:

```text
buckyball.bank_alloc
buckyball.bank_mvin
buckyball.bank_fp2int
buckyball.bank_transpose
buckyball.bank_mul_warp16
buckyball.bank_int2fp
buckyball.bank_mvout
buckyball.bank_release
buckyball.fence
```

`buckyball.matmul` requires static rank-2 memref inputs with shapes:

```text
A: M x K
B: K x N
C: M x N
M % 16 == 0
K % 16 == 0
N % 16 == 0
```

If shapes do not meet these conditions, the pass does not pad automatically; it match-fails. Padding should be done earlier in `convert-tile-to-buckyball`.

After lowering, two nested loops are generated:

```text
for m in 0..M step 16:
  for n in 0..N step 16:
    A_tile = A[m:m+16, 0:K]
    B_tile = B[0:K, n:n+16]
    C_tile = C[m:m+16, n:n+16]
```

Dataflow for each `16xK @ Kx16 -> 16x16` tile:

```text
aFp32 = bank_alloc(col=4)
bFp32 = bank_alloc(col=4)
aI8   = bank_alloc(col=1)
bI8   = bank_alloc(col=1)
aI8T  = bank_alloc(col=1)
cI32  = bank_alloc(col=4)
cFp32 = bank_alloc(col=4)

bank_mvin(A_tile -> aFp32)
bank_mvin(B_tile -> bFp32)
bank_fp2int(aFp32 -> aI8)
bank_fp2int(bFp32 -> bI8)
bank_transpose(aI8 -> aI8T)
bank_mul_warp16(aI8T, bI8 -> cI32)
bank_int2fp(cI32 -> cFp32)
bank_mvout(cFp32 -> C_tile)
fence
bank_release(...)
```

The pass computes abs max for A/B within each tile, builds fp32 quant scales, then bitcast/extends scales to i64 for `bank_fp2int`. `bank_int2fp` uses `1 / (scaleA * scaleB)`.

Banks here are virtual handles. `bank_alloc` return values are not physical bank IDs; they only denote on-chip buffers that need allocation. Physical IDs are decided in `assign-physical-banks`.

Usage example:

```bash
buddy-opt input.mlir -lower-buckyball-to-bank-ssa
```

Related tests:

```text
bb-tests/workloads/src/OpTest/buckyball/matmul_16x64_64x16.mlir
bb-tests/workloads/src/OpTest/buckyball/matmul_64x16_16x64.mlir
bb-tests/workloads/src/OpTest/buckyball/matmul_1024x16_16x1024.mlir
```
