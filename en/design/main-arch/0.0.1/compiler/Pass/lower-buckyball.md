# lower-buckyball

`lower-buckyball` lowers the Buckyball dialect to the LLVM dialect. Code lives at:

```text
compiler/src/Conversion/LowerBuckyball/LowerBuckyballPass.cpp
```

This step is the final exit. Input may include:

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

Input may also already contain `buckyball.intr.*`. For example, after `assign-physical-banks`, `bank_transpose`, `bank_im2col`, `bank_fp2int`, and `bank_int2fp` may already be `buckyball.intr.transpose`, `buckyball.intr.im2col`, `buckyball.intr.fp2int`, and `buckyball.intr.int2fp`.

Output is RISC-V intrinsic calls in the LLVM dialect, for example:

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

`print_memref` and `print_scalar` lower to `printf` calls. `counter_start` / `counter_stop` use inline asm to read `rdcycle` for simple performance counting.

Pass options include:

```text
bank_width  default 16
bank_depth  default 4096
bank_num    default 8
```

These options are passed to the Buckyball LLVM export patterns. Note that the default `bank_num` here differs from `assign-physical-banks`; if the flow depends on bank count, pass it explicitly rather than relying on defaults.

Usage example:

```bash
buddy-opt input.mlir -lower-buckyball
buddy-translate --buddy-to-llvmir input.ll.mlir
buddy-llc -mattr=+buddyext input.ll
```

After this step, Buckyball instructions are no longer MLIR high-level ops; they are RISC-V intrinsics the backend can recognize. Instruction selection and encoding after that belong to the LLVM backend.
