# lower-buckyball

`lower-buckyball` 把 Buckyball dialect 降到 LLVM dialect。代码在：

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

这一步处理的是最终出口。输入里可以有：

```text
buckyball.mset
buckyball.mvin
buckyball.mvout
buckyball.mul_warp16
buckyball.fp2int
buckyball.int2fp
buckyball.transpose
buckyball.im2col
buckyball.fence
buckyball.print_memref
buckyball.print_scalar
buckyball.counter_start
buckyball.counter_stop
```

也可以已经包含 `buckyball.intr.*`。比如经过 `assign-physical-banks` 后，`bank_transpose`、`bank_im2col`、`bank_fp2int`、`bank_int2fp` 可能已经变成 `buckyball.intr.transpose`、`buckyball.intr.im2col`、`buckyball.intr.fp2int`、`buckyball.intr.int2fp`。

输出是 LLVM dialect 里的 RISC-V intrinsic 调用，例如：

```text
@llvm.riscv.bb.mset
@llvm.riscv.bb.mvin
@llvm.riscv.bb.mvout
@llvm.riscv.bb.mul.warp16
@llvm.riscv.bb.fp2int
@llvm.riscv.bb.int2fp
@llvm.riscv.bb.transpose
@llvm.riscv.bb.im2col
@llvm.riscv.bb.fence
```

`print_memref` 和 `print_scalar` 会降到 `printf` 调用。`counter_start` / `counter_stop` 会使用 inline asm 读 `rdcycle`，用于简单性能计数。

pass 参数包括：

```text
bank_width  默认 16
bank_depth  默认 4096
bank_num    默认 8
```

这些参数会传给 Buckyball LLVM export pattern。注意这里的默认 `bank_num` 和 `assign-physical-banks` 的默认值不一样；如果流程里依赖 bank 数量，应该显式传参，不要靠默认值。

用法示例：

```bash
buddy-opt input.mlir -lower-buckyball
buddy-translate --buddy-to-llvmir input.ll.mlir
buddy-llc -mattr=+buddyext input.ll
```

这一步之后，Buckyball 指令已经不再是 MLIR high-level op，而是后端能识别的 RISC-V intrinsic。再往后的指令选择和编码属于 LLVM 后端。
