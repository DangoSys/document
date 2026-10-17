# lower-buckyball

`lower-buckyball` 把 Buckyball dialect 降到 intrinsic wrapper。代码在：

```text
stack/compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

这一步处理的是最终出口。输入里可以有：

```text
buckyball.mset
buckyball.mvin
buckyball.mvout
buckyball.vecmat16
buckyball.quant_f32_to_i8
buckyball.int32_to_fp32
buckyball.transpose
buckyball.im2col
```

也可以已经包含 `buckyball.intr.*`。`bank_transpose`、`bank_im2col` 在 `assign-physical-banks` 后变成普通 Buckyball op，字段在这里打包。

Ball 指令默认使用目标配置中的 funct7；`stable=true` 让支持该模式的 Ball 生成专用 intrinsic wrapper。输出仍是 MLIR；经过后续 LLVM IR 导出后，会生成 RISC-V intrinsic 调用，例如稳定路径中的：

```text
@llvm.riscv.bb.mset
@llvm.riscv.bb.mvin
@llvm.riscv.bb.mvout
@llvm.riscv.bb.transpose
@llvm.riscv.bb.im2col
```

`print_memref` 和 `print_scalar` 是调试操作，但当前 pass 未注册它们的 lowering。

pass 参数为 `stable`，默认 false。bank 宽度、深度和数量来自 `--target`，不再接受 `bank_width`、`bank_depth`、`bank_num`。

用法示例：

```bash
buddy-opt --target=pebble input.mlir -lower-buckyball -o lowered.mlir
```

完成其余方言转换、得到 `input.ll.mlir` 后，再导出 LLVM IR 并生成 RISC-V 代码：

```bash
buddy-translate --buddy-to-llvmir input.ll.mlir -o input.ll
buddy-llc -mtriple=riscv64 -mattr=+xbuckyball input.ll
```

这一步之后，Buckyball 指令已经不再是 MLIR high-level op，而是 intrinsic wrapper。完成其余方言转换后，由 `buddy-translate --buddy-to-llvmir` 导出 LLVM IR。再往后的指令选择和编码属于 LLVM 后端。
