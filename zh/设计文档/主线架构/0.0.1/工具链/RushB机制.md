# RushB 机制

RushB 是 Buckyball 的 Host 驱动 RTL 仿真方式。Workload 被编译为宿主机程序，通过 C ABI 直接向 Buckyball RTL 提交指令，不需要 Rocket 或 Spike 执行 RISC-V 指令流。

## 整体流程

```text
Host workload
    |
    | rushb_mset / rushb_mvin / rushb_mvout / rushb_custom
    v
RushB C ABI
    |
    v
NPU Scheduler
    |
    | DPI-C + RoCC valid/ready
    v
Buckyball RTL
```

`rushb_init()` 启动 NPU Scheduler 线程并创建 Verilator 模型。Host 线程只提交请求和等待结果，RTL 时钟统一由 Scheduler 推进。

Scheduler 为每个 accelerator 维护独立队列。命令先等待 RTL `ready`，在 `valid && ready` 时被接收。对于 MSET、MVIN 和普通 custom 指令，RTL 接收命令后，对应的 Host 函数调用就会结束，Host 程序可以执行下一行代码。这只表示命令已进入 RTL，不表示执行已经完成。Scheduler 随后可以继续提交其他指令，使多条指令同时处于 inflight 状态。

不同 accelerator 可以在同一 RTL 时间轴上并发工作，Verilator 模型仍由一个 Scheduler 线程操作。

## MVIN 与 MVOUT

RTL 不能直接访问 Host 虚拟地址，所以 MVIN 和 MVOUT 需要经过 BBSimDRAM 中的 staging 区域。

MVIN 的数据路径：

```text
Host buffer -> BBSimDRAM staging -> RTL MVIN -> Bank
```

RushB 提交 MVIN 时先复制 Host 数据并写入 staging，再把指令中的地址替换为 staging 地址。RTL 接收命令后 `rushb_mvin()` 返回。

MVOUT 的数据路径：

```text
Bank -> RTL MVOUT -> BBSimDRAM staging -> Host buffer
```

`rushb_mvout()` 会等待 RTL 完成 MVOUT，再从 staging 读取数据并复制到 Host buffer，之后才返回。因此 MVOUT 是同步接口，返回后 Host 才能安全读取输出。

同一 accelerator 等待 MVOUT 完成时，不会继续向 RTL 提交排在该 MVOUT 后面的命令，所以 MVOUT 会形成同步点；其他 accelerator 仍可继续运行。

## 完成判断

每个 accelerator 都记录 `accepted`、`completed` 和 `inflight` 计数。RTL 接收命令时增加 `accepted` 和 `inflight`，收到完成信号时增加 `completed` 并减少 `inflight`。

MVOUT 等待期间，同一 accelerator 不会接收排在该 MVOUT 后面的命令。因此当 `completed` 达到 MVOUT 接收时记录的目标值，就能确认 MVOUT 已完成，不需要逐条传递 completion tag。

Fence 不走普通 GlobalROB 完成路径，所以在被 RTL 接收时直接完成记账。所有 inflight 指令结束后，staging 地址才会被复用。
