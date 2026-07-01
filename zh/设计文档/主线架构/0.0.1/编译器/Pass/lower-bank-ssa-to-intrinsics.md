# lower-bank-ssa-to-intrinsics

`lower-bank-ssa-to-intrinsics` 把 Buckyball op 降到 intrinsic wrapper。代码和 `lower-buckyball` 在同一个文件：

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

这个 pass 的输入应该已经经过 `assign-physical-banks`。也就是说，Bank SSA 里的虚拟 bank handle 已经被物理 bank ID 替换，`bank_alloc` / `bank_release` 也已经变成 `buckyball.mset`。

这一层的主要任务是把普通 Buckyball wrapper 进一步改写成 `buckyball.intr.*`。例如：

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

会继续往 `buckyball.intr.*` / LLVM export pattern 方向转换。`transpose`、`im2col`、`fp2int`、`int2fp` 在 `assign-physical-banks` 里已经把 bank ID、iter 等字段打包到了 rs1/rs2 形式，所以这里不再做 bank 分配。

这个 pass 和 `lower-buckyball` 使用同一套 Buckyball LLVM export pattern，区别是它只做 Buckyball op 到 intrinsic wrapper 的转换，不负责把普通 MLIR 控制流、memref、arith 全部降完。

用法示例：

```bash
buddy-opt input.mlir -lower-bank-ssa-to-intrinsics
```

常见顺序是：

```bash
buddy-opt input.mlir \
  -lower-buckyball-to-bank-ssa \
  -assign-physical-banks \
  -lower-bank-ssa-to-intrinsics
```
