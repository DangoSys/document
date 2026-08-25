# compiler

`compiler` 负责构建 Buckyball 使用的 buddy-mlir 编译链。workload 里的 MLIRTest、ModelTest 都会依赖这套编译器，把 Linalg、Tile、Buckyball dialect 逐步降到 LLVM IR，再生成 RISC-V 自定义指令。

这里构建的是仓库里的 `compiler/thirdparty/buddy-mlir`。编译完成后，`workload build` 会使用其中的 `buddy-opt`、`buddy-translate`、`buddy-llc` 等工具继续编译测试程序和模型。

## build

`compiler build` 的产品入口是 chip：`bbdev compiler --build '--chip <chip>'`。默认 Core 来自 topology 里唯一的 `cores/<pkg>`；cmake/ninja 只负责编 buddy-mlir。实际执行步骤如下：

1. 用 cmake 配置 `compiler/thirdparty/buddy-mlir/build/cores/<compilerCore>`，并把 `BUDDY_EXTERNAL_DIALECTS_DIR` 指到 `examples/cores/<compilerCore>/compiler`。每个 `compilerCore` 独立一份 CMake 输出，不同 core 可并行编。
2. 再 `ninja` 编 `buddy-opt`、`buddy-translate`、`buddy-llc` 这三个后续 workload 会用到的工具；`build/bin/` 下会生成 `buddy-opt-<core>` 等 symlink 方便手工调用。
3. 交互式 shell 若要用裸 `buddy-opt`，先 `export BUCKYBALL_COMPILER_CORE=<core>` 再 `source sourceme.sh`；bbdev 的 compiler/workload 会在子进程里按 chip/core 注入 `BUDDY_MLIR_BUILD_DIR`。

用法如下：

```bash
bbdev compiler --build '--chip toy'
bbdev compiler --build '--core pebble'
```

==参数1 core/chip== 二者必须且只能指定一个。`--core` 直接指定编译器 Core，例如 `toy`、`pebble`、`goban`，对应目录必须存在 `examples/cores/<core>/compiler/CMakeLists.txt`。`--chip` 指定运行时 Chip，并通过 topology 里唯一的 `cores/<pkg>` 解析其默认 Core。

==参数2 stable== `--stable` 可选。按稳定构建路径编译；日常开发一般不用开。
