# assign-physical-banks

`assign-physical-banks` 把 Bank SSA 里的虚拟 bank handle 分配成虚拟 bank ID。代码在：

```text
stack/compiler/src/Conversion/LowerBuckyball/AssignPhysicalBanksPass.cpp
```

输入是：

```text
buckyball.bank_alloc
buckyball.bank_release
buckyball.bank_mvin
buckyball.bank_mvout
buckyball.bank_vecmat16
buckyball.bank_transpose
buckyball.bank_im2col
buckyball.bank_quant_f32_to_i8
buckyball.bank_int32_to_fp32
```

输出是带 bank 编号的 Buckyball op 和 `buckyball.mset`：

```text
buckyball.mset(bankId, alloc=true, row, col)
buckyball.mvin
buckyball.mvout
buckyball.vecmat16
buckyball.transpose
buckyball.im2col
buckyball.quant_f32_to_i8
buckyball.int32_to_fp32
buckyball.mset(bankId, alloc=false, row=0, col=0)
```

其中 `bank_mvin`、`bank_mvout`、`bank_vecmat16` 会变成普通 `buckyball.mvin`、`buckyball.mvout`、`buckyball.vecmat16`。`bank_transpose`、`bank_im2col`、`bank_quant_f32_to_i8`、`bank_int32_to_fp32` 也会变成对应的普通 Buckyball op；rs1/rs2 打包由后续指令导出完成。

分配模型很直接：物理 group 容量来自目标配置。`bank_alloc` 上的 `row` 和 `col` 表示这次分配需要多少个 group：

```text
need = row * col
```

pass 从低 ID 开始找空闲的虚拟 bank 编号。找到后插入 alloc 形式的 `mset`，并用该编号替换 handle；运行时建立它到物理 group 的映射，group 不要求连续。遇到 `bank_release` 时，插入 release 形式的 `mset`，释放编号和占用的 group。

例如一个 `col=4` 的 alloc 可能变成：

```text
%0 = arith.constant 0 : i64
buckyball.mset %0 {alloc = true, row = 1 : i64, col = 4 : i64} : i64
```

这表示虚拟 bank 0 映射到 4 个 group。

这个 pass 会严格检查错误：

- `row <= 0` 或 `col <= 0` 会失败。
- 同时占用的 group 超过目标容量，或没有可用的虚拟 bank 编号会失败。
- release 的 bank ID 不是常量会失败。
- release 找不到对应 alloc 会失败。
- 函数结束时还有没释放的虚拟 bank handle 会失败。

容量和合法 ID 范围由 `--target` 对应的配置提供，不再接受 `bank_num` 参数：

```bash
buddy-opt --target=pebble input.mlir -assign-physical-banks
```

注意：这个 pass 会 walk 到 `scf.for` / `scf.if` 内部处理 bank op。Tile lowering 生成的循环体里有 bank 生命周期，所以 allocator 不能只看函数顶层 block。
