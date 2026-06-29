# kernel

`kernel` 负责构建 Buckyball 使用的 Linux 启动镜像。源码在 `bb-tests/workloads/lib/kernel`，最终产物在 `bb-tests/output/kernel`。

## 什么是 Kernel

我们将包含 Linux 系统及可执行文件和数据的所有东西打包成的一个镜像称为 kernel。

Linux 启动有很多种方式，在 Buckyball 的仿真和上板流程里，我们约定只使用一种：Kernel提前烧录在DDR中，上电后 BootROM 跳到 DDR 里的执行Kernel的内容。

Buckyball 的 kernel 镜像主要包含三部分：第一部分是 OpenSBI，负责机器态初始化和 SBI 服务；第二部分是 Linux Image，是真正运行用户程序的操作系统；第三部分是打进 Linux 里的 rootfs，里面有 BusyBox、启动脚本，以及 workload 或指定模型的运行文件。当前地址空间按下面这样排布：

```text
0x00010000  BootROM
            CPU reset 后先从这里执行

0x80000000  fw_payload.bin
            |
            +-- 0x80000000  OpenSBI
            |               运行在 M-mode，负责初始化中断、定时器、console 和 SBI
            |
            +-- 0x80200000  Linux Image
                            运行在 S-mode，里面带 initramfs/rootfs
                            rootfs 里放 BusyBox、/init、workload 或模型文件
```

![kernel](kernel.svg)

启动流程：
1. 系统上电，烧录 Kernel 进入 DDR。
2. DDR烧录完成，CPU上电 reset。
3. CPU 进入 BootROM，BootROM 做最小的多核同步，然后带着 `hartid` 和 DTB 地址跳到 `0x80000000`。
4. 开始执行 OpenSBI，OpenSBI 初始化 CLINT、PLIC、SCU console 等平台资源，准备好给 Linux 使用的 SBI 接口。
5. 切到 S-mode 并跳到 `0x80200000`。Linux 接管系统，解析 DTB，挂载内置 rootfs，进入 `/init`
6. Linux启动完成，之后可以在 Linux 环境中运行 `/root` 下的 workload 或模型程序。


## build

`kernel build` 用于构建 Linux 固件。默认产物是：

```text
bb-tests/output/kernel/fw_payload.bin
bb-tests/output/kernel/fw_payload.hex
```

其中 `.bin` 是 OpenSBI fw_payload，`.hex` 是给 FPGA 的 DDR 后门加载用的 hex 文件。

> [!tip] 注意
> 真实系统中提前向DDR烧录数据并不现实，具体芯片的boot流程请查看对应文档。

`kernel build` 的实际执行步骤如下：

1. 在 `bb-tests/workloads/lib/kernel` 的 `build` 目录开始执行命令。
2. 构建 BusyBox，并把它放进 initramfs。
3. 创建 rootfs。如果不指定模型，会把 `bb-tests/output/workloads` 里的 workload 安装进 `/root`；如果指定 `--model`，只把对应 ModelTest 的运行文件安装进 `/root`。
4. 构建带 initramfs 的 Linux Image。
5. 用 OpenSBI 把 Linux Image 打包成 `fw_payload.bin`。
6. 把 `fw_payload.bin` 转成 `fw_payload.hex`。

用法如下：

```bash
bbdev kernel --build
bbdev kernel --build '--visible-hart-count 64 --total-hart-count 256'
bbdev kernel --build '--visible-hart-count 64 --total-hart-count 256 --model lenet'
```

==参数1 model== `--model` 用于指定要打包进 rootfs 的端到端模型。指定后，kernel 只会安装这个模型对应的 ModelTest 运行文件，不会把所有 workload 都放进 `/root`。当前支持的 model 参数包括：`bert`, `deepseekr1`, `gemma4`, `lenet`,`llama2`,`mobilenet`,`qwen3`,`resnet`,`stable-diffusion`,`yolo`。

指定 `--model` 前，需要先构建对应 ModelTest workload。

```bash
bbdev workload --build '--model lenet'
```

否则 kernel 构建时找不到模型运行文件，会直接报错。指定模型也会影响产物文件名，例如 `--model lenet` 会生成 `fw_payload-lenet.bin` 和 `fw_payload-lenet.hex`。

- [ ] TODO: 将模型构建加入自动workflow


==参数2 total-hart-count== `--total-hart-count` 用于指定硬件里一共有多少个 hart。默认值等于 `visible-hart-count`。

这个参数主要用于多核或异构核配置。硬件里可能有很多 hart，但不一定都要交给 Linux 管理。`total-hart-count` 表示硬件总数，OpenSBI 会根据这个数量处理平台初始化和 DTB 里的 hart 信息。

==参数3 visible-hart-count== `--visible-hart-count` 用于指定 Linux 能看到多少个 hart，默认是 64。

这个参数会传给 OpenSBI 和 Linux 启动配置。Linux 启动后，只会调度这些 visible hart。其它 hart 即使硬件存在，也会在启动时从 DTB 里隐藏掉，不交给 Linux 使用。

如果 `total-hart-count` 不等于1，产物文件名会带上 `t` 后缀。如果 `visible-hart-count` 不等于1，产物文件名会带上 `v` 后缀。例如 `--visible-hart-count 64 --total-hart-count 256` 会生成：

```text
fw_payload-v64-t256.bin
fw_payload-v64-t256.hex
```
