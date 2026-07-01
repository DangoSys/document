# report-bank-usage

`report-bank-usage` 是诊断 pass，不改变 IR。代码在：

```text
compiler/src/Conversion/LowerBuckyball/ReportBankUsagePass.cpp
```

它读取 `buckyball.mset` 的 alloc/release 时间线，统计一个函数里物理 bank 的使用峰值。输入应该已经经过 `assign-physical-banks`，因为这个 pass 需要看到常量形式的 bank ID。

输出打印到 stderr，格式类似：

```text
[bank-usage] func_name peak=7/16 alloc=12 release=12 leaked=0
```

其中：

- `peak` 是同时占用的物理 bank 峰值。
- `alloc` 是 alloc 事件数量。
- `release` 是 release 事件数量。
- `leaked` 是函数结束时还没释放的 allocation 数量。

可以打开 verbose 输出每次 alloc/release：

```bash
buddy-opt input.mlir -report-bank-usage='bank_num=16 verbose=true'
```

这个 pass 会严格检查 `mset` 时间线：

- `bank_num <= 0` 会失败。
- bank ID 不是常量会失败。
- bank ID 超出范围会失败。
- alloc 的 row/col 非法会失败。
- 同一个 base bank 重复 alloc 会失败。
- 两次 alloc 有重叠 bank 会失败。
- release 没有对应 alloc 会失败。
- 函数结束还有未释放 allocation 会失败。

它适合放在 `assign-physical-banks` 后面，用来确认某个 lowering 的 bank 生命周期是否符合预期。
