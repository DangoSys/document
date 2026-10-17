# lower-buckyball-to-bank-ssa

`lower-buckyball-to-bank-ssa` 把 high-level Buckyball op 展开成显式 bank 数据流。代码在：

```text
stack/compiler/src/Conversion/LowerBuckyball/LowerBuckyballToBankSSAPass.cpp
```

当前这个 pass 按目标 Ball 注册的 pattern 处理高层操作。以 ReLU 为例，输入还是算子形式：

```text
buckyball.relu_matrix %input %output
```

输出会变成 bank 级别的操作：

```text
buckyball.bank_alloc
buckyball.bank_mvin
buckyball.bank_relu
buckyball.bank_mvout
buckyball.bank_release
```

ReLU 要求输入输出为相同形状的静态 INT32 memref，行列数为正且按 16 对齐。

如果 shape 不满足这些条件，pass 不会自动 padding，而是直接报错。padding 应该在进入这个 pass 前完成。

这里的 bank 都是虚拟 handle。`bank_alloc` 的返回值不是物理 bank ID，只表示一个需要分配的片上缓冲。虚拟 bank ID 在 `assign-physical-banks` 里决定。

用法示例：

```bash
buddy-opt --target=pebble input.mlir -lower-buckyball-to-bank-ssa
```

相关测试可以看：

```text
examples/balls/relu/workloads/mlir_tests
```
