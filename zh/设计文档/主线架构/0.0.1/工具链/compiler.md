# compiler

`compiler` 负责构建 Buckyball 使用的 buddy-mlir 编译链。workload 里的 OpTest、ModelTest 都会依赖这套编译器，把 Linalg、Tile、Buckyball dialect 逐步降到 LLVM IR，再生成 RISC-V 自定义指令。

这里构建的是仓库里的 `compiler/thirdparty/buddy-mlir`。编译完成后，`workload build` 会使用其中的 `buddy-opt`、`buddy-translate`、`buddy-llc` 等工具继续编译测试程序和模型。

## build

`compiler build` 每次增量编译 buddy-mlir。实际执行步骤如下：

1. 在 `compiler/thirdparty/buddy-mlir/build` 目录下先执行 `cmake --build . --target python-package-buddy`，构建 buddy 的 Python package。这步重新编译器前端代码。
2. 再执行 `ninja -j$(nproc)`，编译 buddy-mlir 里的其它目标。这步更新中端与后端的代码。

用法如下：

```bash
bbdev compiler --build
```

该 API 没有参数。

