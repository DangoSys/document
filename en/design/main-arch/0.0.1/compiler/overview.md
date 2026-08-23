---
banner: "[[en/design/main-arch/0.0.1/compiler/images/banner.avif]]"
banner-height: 200
banner_y: 45.0%
---
# Overview

The Buckyball compiler lowers operators from models or hand-written MLIR step by step down to Buckyball custom instructions. The entry point is typically Linalg ops such as `linalg.matmul` and `linalg.conv_2d_*`, but the pipeline can also start from Tile/Buckyball MLIR that is already written. The exit is LLVM IR with `@llvm.riscv.bb.*` intrinsics, which are then turned into RISC-V code by `buddy-translate --buddy-to-llvmir` and `buddy-llc -mattr=+buddyext`.

This pipeline does not jump directly from Linalg to instructions. It deliberately splits into several layers: Linalg expresses ordinary operator semantics; Tile turns shapes into hardware-sized blocks; Buckyball high-level ops express “I want to run one hardware operator”; Bank SSA makes on-chip bank dataflow explicit; and physical bank assignment binds virtual bank handles to concrete bank IDs. The benefit is that each layer handles one kind of problem: shape is not patched at the instruction layer, bank lifetimes are not guessed at the Linalg layer, and final instruction encoding does not pollute high-level operator semantics.

The main flow looks like this:

```text
Linalg
  |
  | convert-linalg-to-tile
  v
Tile
  |
  | convert-tile-to-buckyball
  v
Buckyball high-level ops
  |
  | lower-buckyball-to-bank-ssa
  v
Bank SSA
  |
  | assign-physical-banks
  v
Buckyball ops with physical bank IDs
  |
  | lower-bank-ssa-to-intrinsics
  v
Buckyball intrinsic wrapper
  |
  | lower-buckyball
  v
LLVM IR
```

`convert-linalg-to-tile` comes from buddy-mlir and turns Linalg matmul, batch matmul, and some conv2d ops into `tile.*` ops. Buckyball’s own main pipeline starts at `convert-tile-to-buckyball`, with code under `compiler/src/Conversion`. If a workload already contains `tile.*` or `buckyball.*` ops, testing can start from an intermediate layer without running the full pipeline from Linalg every time.

The Tile layer is the most important buffer in this pipeline. For example, matmul inputs might be `127x17 @ 17x127`, but the hardware’s basic granularity is 16 rows, 16 columns, and 16-byte bank rows. The Tile pass first checks that `A[M,K]`, `B[K,N]`, and `C[M,N]` match, then pads M/K/N to multiples of 16 and chooses tile sizes according to bank depth and mvin/mvout depth limits. If K is split into multiple segments, partial accumulation is also done in the Tile layer. That lets later `buckyball.matmul` ops keep simple semantics: one op covers writing one regular tile.

The Buckyball layer has two forms. The first is high-level ops such as `buckyball.matmul`, which still look like ordinary operators. The second is Bank SSA, such as `buckyball.bank_mvin`, `buckyball.bank_fp2int`, `buckyball.bank_vecmat16`, and `buckyball.bank_mvout`, where you can already see the order of moving data into banks, quantizing, transposing, computing, dequantizing, and moving data out. Banks in Bank SSA are still virtual handles, not final physical bank IDs.

`assign-physical-banks` maps virtual bank handles to physical bank IDs and inserts `buckyball.mset`. If the number of banks needed at the same time exceeds `bank_num`, or if a release cannot find the corresponding alloc, the pass fails immediately. This behavior is intentional: bank count and lifetimes are hardware correctness issues and should not be masked in the compiler with defaults or fallback logic.

The last two steps lower Buckyball ops to LLVM IR. `lower-bank-ssa-to-intrinsics` rewrites Buckyball ops that already have physical bank IDs into intrinsic wrappers such as `buckyball.intr.*`; `lower-buckyball` then lowers those wrappers to RISC-V intrinsics in the LLVM dialect. After that, the problem is handed off to the LLVM backend and the Buckyball RISC-V extension.

Related docs:
- [[Dialect]]: roles of the Linalg, Tile, and Buckyball dialect layers.
- [[Pass/convert-linalg-to-tile]]: from Linalg to Tile.
- [[Pass/convert-tile-to-buckyball]]: Tile-layer padding, tiling, and partial accumulation.
- [[Pass/lower-buckyball-to-bank-ssa]]: from `buckyball.matmul` to explicit bank dataflow.
- [[Pass/assign-physical-banks]]: from virtual banks to physical bank IDs.
- [[Pass/lower-bank-ssa-to-intrinsics]]: from Bank SSA to Buckyball intrinsic wrappers.
- [[Pass/lower-buckyball]]: from Buckyball wrappers to LLVM IR.
- [[Pass/report-bank-usage]]: peak bank usage statistics from `mset`.
