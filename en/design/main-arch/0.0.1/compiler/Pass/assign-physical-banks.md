# assign-physical-banks

`assign-physical-banks` maps virtual bank handles in Bank SSA to physical bank IDs. Code lives at:

```text
compiler/src/Conversion/LowerBuckyball/AssignBuckyballBanksPass.cpp
```

Input ops:

```text
buckyball.bank_alloc
buckyball.bank_release
buckyball.bank_mvin
buckyball.bank_mvout
buckyball.bank_vecmat16
buckyball.bank_transpose
buckyball.bank_im2col
buckyball.bank_fp2int
buckyball.bank_int2fp
```

Output is Buckyball ops with physical bank IDs, `buckyball.mset`, and a few intrinsic wrappers that are already packed:

```text
buckyball.mset(bankId, alloc=true, row, col)
buckyball.mvin
buckyball.mvout
buckyball.vecmat16
buckyball.intr.transpose
buckyball.intr.im2col
buckyball.intr.fp2int
buckyball.intr.int2fp
buckyball.mset(bankId, alloc=false, row=0, col=0)
```

Among these, `bank_mvin`, `bank_mvout`, and `bank_vecmat16` become ordinary `buckyball.mvin`, `buckyball.mvout`, and `buckyball.vecmat16`. `bank_transpose`, `bank_im2col`, `bank_fp2int`, and `bank_int2fp` pack rs1/rs2 fields in this pass and emit `buckyball.intr.*` directly.

The allocation model is straightforward: there are 16 physical banks by default. `row` and `col` on `bank_alloc` mean how many consecutive banks this allocation occupies:

```text
need = row * col
```

The pass searches from low IDs for a contiguous free run of banks. After finding one, it inserts an alloc-form `mset` and replaces all uses of the virtual handle with the physical base bank ID. On `bank_release`, it inserts a release-form `mset` and frees that contiguous run.

For example, a `col=4` alloc might become:

```text
%0 = arith.constant 0 : i64
buckyball.mset %0 {alloc = true, row = 1 : i64, col = 4 : i64}
```

This means four consecutive banks starting at bank 0.

This pass checks errors strictly:

- `row <= 0` or `col <= 0` fails.
- More live banks at once than `bank_num` fails.
- A release whose bank ID is not a constant fails.
- A release with no matching alloc fails.
- Unreleased virtual bank handles at function end fail.

`bank_num` can be set via pass options; the default is 16:

```bash
buddy-opt input.mlir -assign-physical-banks='bank_num=16'
```

Note: this pass walks into `scf.for` / `scf.if` to process bank ops. Tile lowering generates loop bodies with bank lifetimes, so the allocator cannot look only at the function’s top-level block.
