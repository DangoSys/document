# 端到端实现 LeNet 加速（下）：FPGA 仿真与评估

当模型在 BEMU 和 Verilator 中都通过后，才有必要上 FPGA。FPGA 主要验证更长的运行时间、真实的内存带宽和板级运行时；它不替代前面的功能测试。

## 1. 准备 FPGA 需要的产物

先构建模型和 kernel：

```bash
bbdev config --install
bbdev model --build '--chip pebble --model lenet'
bbdev kernel --build '--chip pebble --model lenet'
```

kernel 会把 OpenSBI、Linux、rootfs 和模型运行资源打包成 `fw_payload-*.bin`、`.elf` 和 `.hex`。默认模型放进 initramfs；模型较大时可以使用 DDR 存储：

```bash
bbdev kernel --build '--chip pebble --model lenet --model-storage ddr --guest-memory-mib 4096'
```

使用 DDR 存储时，除了启动镜像，还会生成模型加载清单。上板工具必须使用同一组镜像和清单，不能混用上一次构建的文件。

## 2. 先用 P2E 验证 bitstream

`bebop-p2e` 负责生成 Verilog、构建 bitstream 和运行镜像。使用 hex 镜像时，运行阶段必须同时给出 `.hex` 镜像和 bitstream 路径：

```bash
bbdev bebop-p2e --verilog '--chip pebble'
bbdev bebop-p2e --buildbitstream '--chip pebble'
bbdev bebop-p2e --runworkload '--chip pebble --image <kernel-or-workload-hex> --bitstream <build-dir>/fpgaCompDir/bitstream.bit'
```

DDR 模型运行时，把上面命令的 `--image <kernel-or-workload-hex>` 换成 `--load-manifest <本次构建生成的.load.json路径>`，两者只能选一个。

具体 FPGA 平台由 Chip 的配置决定。构建时间通常比 Verilator 长，调试时应先固定 bitstream，只替换 workload 或输入。若必须重新生成 RTL，先清理旧的 P2E 构建目录，避免把旧 bitstream 和新配置混在一起。

## 3. 用 FireSim 做长时间运行

如果目标是验证长时间运行或更完整的系统软件，可以使用 FireSim：

```bash
bbdev firesim --buildbitstream '--chip pebble'
bbdev firesim --infrasetup '--chip pebble'
bbdev firesim --runworkload '--chip pebble'
```

FireSim 从 Chip 的 workload 配置选择运行内容，不在命令行传入单个 binary。它需要自己的 FPGA 和基础设施配置，准备时间较长。第一次调试不要同时改变模型、kernel、Chip 配置和 FireSim 参数；每次只改变一个变量，结果才容易解释。

## 4. 评估指标

LeNet 的评估至少应记录四组数据：

| 指标 | 说明 |
| --- | --- |
| 正确性 | 分类结果、输出张量和参考实现是否一致 |
| 性能 | 总周期、单张图像周期、Ball 占用周期和内存等待 |
| 资源 | LUT、FF、BRAM/URAM、DSP 和时钟频率 |
| 能耗 | 芯片或 FPGA 的功耗估计，以及每次推理能耗 |

性能比较必须使用同一输入集和同一编译参数。不要只比较总时间；如果总时间变快但 bank 等待变多，说明优化可能只是把开销转移到了其他阶段。

## 5. 形成可复现的结果

一次完整实验至少保存：

```text
Chip 配置和生成配置
compiler / model / workload 的构建参数
模型输入、权重和版本
BEMU / Verilator / P2E 的日志
波形或 trace（如果打开）
综合、bitstream 和功耗报告
```

修复问题后先重跑失败的 BEMU 或 Verilator case，再跑整网和 FPGA。这样每个结果都能回到一条具体指令、一个 Ball 或一段 runtime 代码，而不是只留下一个最终分数。
