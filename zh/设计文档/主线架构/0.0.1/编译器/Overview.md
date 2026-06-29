---
banner: "[[zh/设计文档/主线架构/0.0.1/编译器/imaegs/banner.avif]]"
banner-height: 200
banner_y: 45.0%
---
# Overview

Buckyball 编译器负责把模型或手写 MLIR 里的算子，逐步降到 Buckyball 自定义指令。入口通常是 `linalg.matmul`、`linalg.conv_2d_*` 这类 Linalg op，也可以从已经写好的 Tile/Buckyball MLIR 开始；出口是带 `@llvm.riscv.bb.*` 的 LLVM IR，后面再由 `buddy-translate --buddy-to-llvmir` 和 `buddy-llc -mattr=+buddyext` 生成 RISC-V 代码。

这条链路不是直接从 Linalg 跳到指令。中间故意分了几层：Linalg 只表达普通算子语义，Tile 负责把 shape 处理成硬件能吃的块，Buckyball high-level op 表达“我要做一次硬件算子”，Bank SSA 把片上 bank 的数据流显式写出来，physical bank assignment 再把虚拟 bank handle 绑定到具体 bank ID。这样做的好处是每一层只处理一类问题：shape 不在指令层补，bank 生命周期不在 Linalg 层猜，最终指令编码也不反过来污染高层算子语义。

主流程大致如下：

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

`convert-linalg-to-tile` 来自 buddy-mlir，负责把 Linalg 的 matmul、batch matmul、部分 conv2d 变成 `tile.*` op。Buckyball 自己实现的主线从 `convert-tile-to-buckyball` 开始，代码在 `compiler/src/Conversion`。如果 workload 里已经是 `tile.*` 或 `buckyball.*`，就可以从中间层开始测，不一定每次都从 Linalg 跑完整链路。

Tile 层是这条链路里最重要的缓冲层。比如 matmul 的原始输入可以是 `127x17 @ 17x127`，但硬件的基本粒度是 16 行、16 列和 16-byte bank row。Tile pass 会先检查 `A[M,K]`、`B[K,N]`、`C[M,N]` 是否匹配，再把 M/K/N pad 到 16 的倍数，按 bank depth 和 mvin/mvout 深度限制选择 tile size。如果 K 被拆成多段，partial accumulation 也在 Tile 层完成。这样后面的 `buckyball.matmul` 就可以保持简单语义：一次 op 只覆盖写一个规则 tile。

Buckyball 层分两种形态。第一种是 high-level op，例如 `buckyball.matmul`，它仍然看起来像一个算子。第二种是 Bank SSA，例如 `buckyball.bank_mvin`、`buckyball.bank_fp2int`、`buckyball.bank_mul_warp16`、`buckyball.bank_mvout`，这里已经能看到数据先搬进 bank、量化、转置、计算、反量化、搬出的顺序。Bank SSA 里的 bank 还是虚拟 handle，不是最终物理 bank ID。

`assign-physical-banks` 把虚拟 bank handle 分配成物理 bank ID，并插入 `buckyball.mset`。如果同一时刻需要的 bank 数超过 `bank_num`，或者 release 找不到对应 alloc，pass 会直接报错。这个行为是故意的：bank 数量和生命周期是硬件正确性问题，不应该在编译器里用默认值或兜底逻辑掩盖。

最后两步把 Buckyball op 降到 LLVM IR。`lower-bank-ssa-to-intrinsics` 把已经分配好物理 bank 的 Buckyball op 改写成 `buckyball.intr.*` 这类 intrinsic wrapper；`lower-buckyball` 再把这些 wrapper 降到 LLVM dialect 里的 RISC-V intrinsic。再往后，问题就交给 LLVM 后端和 Buckyball RISC-V 扩展处理。

相关文档：
- [[dialect]]：Linalg、Tile、Buckyball 三层 dialect 的定位。
- [[convert-linalg-to-tile]]：从 Linalg 到 Tile。
- [[convert-tile-to-buckyball]]：Tile 层 padding、tiling 和 partial accumulation。
- [[lower-buckyball-to-bank-ssa]]：`buckyball.matmul` 到显式 bank 数据流。
- [[assign-physical-banks]]：虚拟 bank 到物理 bank ID。
- [[lower-bank-ssa-to-intrinsics]]：Bank SSA 到 Buckyball intrinsic wrapper。
- [[lower-buckyball]]：Buckyball wrapper 到 LLVM IR。
- [[report-bank-usage]]：根据 `mset` 统计 bank 使用峰值。
