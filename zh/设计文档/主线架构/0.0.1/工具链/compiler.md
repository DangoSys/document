# compiler

`compiler` 负责构建 Buckyball 使用的 buddy-mlir 编译链。workload 里的 OpTest、ModelTest 都会依赖这套编译器，把 Linalg、Tile、Buckyball dialect 逐步降到 LLVM IR，再生成 RISC-V 自定义指令。

这里构建的是仓库里的 `compiler/thirdparty/buddy-mlir`。编译完成后，`workload build` 会使用其中的 `buddy-opt`、`buddy-translate`、`buddy-llc` 等工具继续编译测试程序和模型。

## build

`compiler build` 按选定的 Core 配置并编译 buddy-mlir。也可以通过 Chip 的 `chip.toml` 选择其默认 compiler Core。实际执行步骤如下：

1. 用 cmake 配置 `compiler/thirdparty/buddy-mlir/build`，并把 `BUDDY_EXTERNAL_DIALECTS_DIR` 指到 `examples/cores/<core>/compiler`。不同 Core 编出来的编译器扩展不一样。
2. 再 `ninja` 编 `buddy-opt`、`buddy-translate`、`buddy-llc` 这三个后续 workload 会用到的工具。

用法如下：

```bash
bbdev compiler --build '--chip toy'
bbdev compiler --build '--core pebble'
```

==参数1 core/chip== 二者必须且只能指定一个。`--core` 直接指定编译器 Core，例如 `toy`、`pebble`、`goban`，对应目录必须存在 `examples/cores/<core>/compiler/CMakeLists.txt`。`--chip` 指定运行时 Chip，并通过 `examples/chips/<chip>/chip.toml` 解析其默认 Core。

==参数2 stable== `--stable` 可选。按稳定构建路径编译；日常开发一般不用开。
