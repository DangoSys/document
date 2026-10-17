# compiler

`compiler` 负责构建 Buckyball 使用的 buddy-mlir 编译链。MLIRTest 和模型构建都会依赖这套编译器，把 Linalg、Tile、Buckyball dialect 逐步降到 LLVM IR，再生成 RISC-V 自定义指令。

这里构建的是仓库里的 `stack/compiler/thirdparty/buddy-mlir`。编译完成后，workload 和模型构建会使用其中的 `buddy-opt`、`buddy-translate`、`buddy-llc` 等工具继续编译测试程序和模型。

## build

`compiler build` 的产品入口是 chip：`bbdev compiler --build '--chip <chip>'`。cmake/ninja 只负责编 buddy-mlir。实际执行步骤如下：

1. 用 cmake 配置 `stack/compiler/thirdparty/buddy-mlir/build/<chip>`，并把 `BUDDY_EXTERNAL_DIALECTS_DIR` 指到 `stack/compiler`。不同 chip 使用各自的构建目录。
2. 再 `ninja` 编 `buddy-opt`、`buddy-translate`、`buddy-llc` 这三个后续 workload 会用到的工具；产物位于 `build/<chip>/bin/` 下。
3. 交互式 shell 若要用裸 `buddy-opt`，先 `export BUCKYBALL_COMPILER_CHIP=<chip>` 再 `source sourceme.sh`。

用法如下：

```bash
bbdev compiler --build '--chip toy'
bbdev compiler --build '--chip pebble'
```

==参数1 chip== `--chip` 必填，指定要构建的 Chip；不接受 `--core`。
