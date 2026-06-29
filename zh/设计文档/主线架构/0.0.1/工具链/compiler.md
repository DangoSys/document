# compiler

### build

`compiler build` 编译 buddy-mlir 编译链。buddy-mlir 是 Buckyball 的 MLIR 编译器，负责把算子从 Linalg 降到 RISC-V 自定义指令，`workload build` 依赖它。构建过程在 `compiler/thirdparty/buddy-mlir/build` 下执行，底层走 Ninja。