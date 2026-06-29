# lower-buckyball-to-bank-ssa

`lower-buckyball-to-bank-ssa` 把 high-level Buckyball op 展开成显式 bank 数据流。代码在：

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballToBankSSAPass.cpp
```

当前这个 pass 主要处理 `buckyball.matmul`。输入还是算子形式：

```text
buckyball.matmul %a %b %c
```

输出会变成 bank 级别的操作：

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

`buckyball.matmul` 要求输入是 static rank-2 memref，shape 满足：

```text
A: M x K
B: K x N
C: M x N
M % 16 == 0
K % 16 == 0
N % 16 == 0
```

如果 shape 不满足这些条件，pass 不会自动 padding，而是直接 match failure。padding 应该在 `convert-tile-to-buckyball` 里提前完成。

lowering 后会生成两层循环：

```text
for m in 0..M step 16:
  for n in 0..N step 16:
    A_tile = A[m:m+16, 0:K]
    B_tile = B[0:K, n:n+16]
    C_tile = C[m:m+16, n:n+16]
```

每个 `16xK @ Kx16 -> 16x16` tile 的数据流是：

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

pass 会在每个 tile 内计算 A/B 的 abs max，生成 fp32 quant scale，再把 scale bitcast/extend 成 i64 传给 `bank_fp2int`。`bank_int2fp` 使用的是 `1 / (scaleA * scaleB)`。

这里的 bank 都是虚拟 handle。`bank_alloc` 的返回值不是物理 bank ID，只表示一个需要分配的片上缓冲。真正的物理 ID 在 `assign-physical-banks` 里决定。

用法示例：

```bash
buddy-opt input.mlir -lower-buckyball-to-bank-ssa
```

相关测试可以看：

```text
bb-tests/workloads/src/OpTest/buckyball/matmul_16x64_64x16.mlir
bb-tests/workloads/src/OpTest/buckyball/matmul_64x16_16x64.mlir
bb-tests/workloads/src/OpTest/buckyball/matmul_1024x16_16x1024.mlir
```
