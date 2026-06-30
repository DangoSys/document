# assign-physical-banks

`assign-physical-banks` 把 Bank SSA 里的虚拟 bank handle 分配成物理 bank ID。代码在：

```text
compiler/src/Conversion/LowerBuckyball/AssignBuckyballBanksPass.cpp
```

输入是：

```text
buckyball.bank_alloc
buckyball.bank_release
buckyball.bank_mvin
buckyball.bank_mvout
buckyball.bank_mul_warp16
buckyball.bank_transpose
buckyball.bank_im2col
buckyball.bank_fp2int
buckyball.bank_int2fp
```

输出是带物理 bank ID 的 Buckyball op、`buckyball.mset`，以及少量已经打包好的 intrinsic wrapper：

```text
buckyball.mset(bankId, alloc=true, row, col)
buckyball.mvin
buckyball.mvout
buckyball.mul_warp16
buckyball.intr.transpose
buckyball.intr.im2col
buckyball.intr.fp2int
buckyball.intr.int2fp
buckyball.mset(bankId, alloc=false, row=0, col=0)
```

其中 `bank_mvin`、`bank_mvout`、`bank_mul_warp16` 会变成普通 `buckyball.mvin`、`buckyball.mvout`、`buckyball.mul_warp16`。`bank_transpose`、`bank_im2col`、`bank_fp2int`、`bank_int2fp` 会在这个 pass 里把 rs1/rs2 字段打包好，直接生成 `buckyball.intr.*`。

分配模型很直接：默认有 16 个物理 bank。`bank_alloc` 上的 `row` 和 `col` 表示这次分配需要连续占用多少个 bank：

```text
need = row * col
```

pass 从低 ID 开始找一段连续空闲 bank。找到后插入 alloc 形式的 `mset`，并把虚拟 handle 的所有使用替换成物理 base bank ID。遇到 `bank_release` 时，pass 插入 release 形式的 `mset`，并释放这段连续 bank。

例如一个 `col=4` 的 alloc 可能变成：

```text
%0 = arith.constant 0 : i64
buckyball.mset %0 {alloc = true, row = 1 : i64, col = 4 : i64}
```

这表示从 bank 0 开始连续占 4 个 bank。

这个 pass 会严格检查错误：

- `row <= 0` 或 `col <= 0` 会失败。
- 同时存活的 bank 超过 `bank_num` 会失败。
- release 的 bank ID 不是常量会失败。
- release 找不到对应 alloc 会失败。
- 函数结束时还有没释放的虚拟 bank handle 会失败。

`bank_num` 可以通过 pass 参数指定，默认是 16：

```bash
buddy-opt input.mlir -assign-physical-banks='bank_num=16'
```

注意：这个 pass 会 walk 到 `scf.for` / `scf.if` 内部处理 bank op。Tile lowering 生成的循环体里有 bank 生命周期，所以 allocator 不能只看函数顶层 block。
