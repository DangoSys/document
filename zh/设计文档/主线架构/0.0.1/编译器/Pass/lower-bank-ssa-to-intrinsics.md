# lower-bank-ssa-to-intrinsics

`lower-bank-ssa-to-intrinsics` 把 Buckyball op 降到 intrinsic wrapper。代码和 `lower-buckyball` 在同一个文件：

```text
stack/compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

这个 pass 的输入应该已经经过 `assign-physical-banks`。也就是说，Bank SSA 里的 bank handle 已经被指令使用的 bank 编号替换，`bank_alloc` / `bank_release` 也已经变成 `buckyball.mset`。

这一层的主要任务是把普通 Buckyball op 进一步改写成 `buckyball.intr.*`。例如：

```text
buckyball.mvin
buckyball.mvout
buckyball.vecmat16
buckyball.transpose
buckyball.im2col
buckyball.quant_f32_to_i8
buckyball.int32_to_fp32
```

会继续往 `buckyball.intr.*` / LLVM export pattern 方向转换。`transpose`、`im2col`、`quant_f32_to_i8`、`int32_to_fp32` 的 bank ID、iter 等字段在这里打包成 rs1/rs2，所以这里不再做 bank 分配。

这个 pass 和 `lower-buckyball` 使用同一套 Buckyball LLVM export pattern，两者都做 Buckyball op 到 intrinsic wrapper 的转换，不负责把普通 MLIR 控制流、memref、arith 全部降完。

用法示例：

```bash
buddy-opt --target=pebble input.mlir -lower-bank-ssa-to-intrinsics
```

常见顺序是：

```bash
buddy-opt --target=pebble input.mlir \
  -lower-buckyball-to-bank-ssa \
  -assign-physical-banks \
  -lower-bank-ssa-to-intrinsics
```
