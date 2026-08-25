# bbdev

`bbdev` 是 Buckyball 的统一开发者工具链入口。它不自己实现编译、仿真或综合，而是把 compiler、workload、BEMU、Verilator、FPGA 和综合等流程包装成同一套 CLI 和 HTTP API。开发者只需要记住 `bbdev <工具> --<操作> '<参数>'` 这一种调用方式。

bbdev 源码在仓库根目录的 `bbdev/` 下：

```text
bbdev/
├── bbdev              CLI 入口
├── api/
│   ├── steps/         各工具的 HTTP 入口和执行步骤
│   ├── utils/         端口、进程、路径和日志等公共逻辑
│   └── config.yaml   iii 服务配置
└── mcp/              给 Agent 使用的 MCP 工具封装
```

## CLI 用法

进入仓库的 Nix 开发环境后，`sourceme.sh` 会把 `bbdev/` 加入 `PATH`，可以直接执行：

```bash
bbdev --help
bbdev workload --build '--chip toy'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-singlecore-baremetal'
```

一条 bbdev 命令分三层：

```text
bbdev <command> --<operation> '<operation args>'
      工具         操作          工具自己的参数
```

例如：

```bash
bbdev bebop-verilator --run '--jobs 16 --chip toy --binary toy_vecunit_matmul_ones-singlecore-baremetal --no-wave'
```

这里 `bebop-verilator` 是 command，`run` 是 operation，`--jobs`、`--chip`、`--binary` 和 `--no-wave` 都是 `run` 自己的参数。

> [!important] 注意
> operation 后面的参数要用引号包成一个字符串。例如要写 `--build '--chip toy --model lenet'`，不要写 `--build --chip toy --model lenet`。不带参数的操作可以直接写，例如 `bbdev workload --clean`。

同一个 command 每次只能选一个 operation。例如 `bebop-verilator` 的 `--verilog`、`--build`、`--sim` 和 `--run` 互斥；需要分步执行时，分成多条 bbdev 命令。

## 执行模式

默认是单任务模式。bbdev 会自动选择空闲的 HTTP 和 worker 端口，启动 iii 与 Motia worker，提交当前任务，然后等待结果。任务结束后临时服务和进程会被清理。人手工跑编译或仿真时，直接用这种模式就行。

```bash
bbdev compiler --build '--chip toy'
```

它的执行路径是：

```text
CLI 解析参数
  → 启动临时 iii 和 Motia worker
  → POST /compiler/build
  → 返回 trace_id
  → CLI 等待任务成功或失败
  → 停止临时服务
```

`--server` 是常驻服务模式，主要给 MCP 和其它程序调用 HTTP API。可以指定端口启动和停止：

```bash
bbdev start --server --port 5200
bbdev stop --server --port 5200
bbdev stop --server --all
```

HTTP 路径由 command 和 operation 组成，其中 command 里的 `-` 会换成 `/`。例如：

```text
bbdev workload --build       → POST /workload/build
bbdev bebop-bemu --sim       → POST /bebop/bemu/sim
bbdev bebop-verilator --run  → POST /bebop/verilator/run
```

HTTP 请求体是 operation 参数对应的 JSON object。服务受理任务后会返回 `trace_id`，调用方需要根据这个 id 查询最终结果。

## Agent 调用

Agent 不直接拼 HTTP 请求，而是使用项目配置的 `buckyball-dev` MCP。MCP 会在第一次调用时选择 `5100–5500` 之间的空闲端口，拉起 bbdev 常驻服务，后续任务复用这个服务。

与 CLI 不同，MCP 工具是非阻塞的。提交成功只表示任务已进入队列，不表示编译或仿真已经通过。正确用法是：

```text
bbdev_workload_build(chip="toy")
  → { accepted: true, processing: true, trace_id: "..." }

bbdev_task_status(trace_id="...")
  → processing=true                         继续查询
  → success=true, returncode=0              任务通过
  → failure=true / cancelled=true           任务终止
```

任务执行时的输出会继续写入各工具自己的日志目录；MCP 服务自身的启动和路由日志写在 `bbdev/server.log`。需要中止任务时使用 `bbdev_task_cancel(trace_id)`。

## 支持的工具

| command             | 常用 operation                                      | 用途                         |
| :------------------ | :------------------------------------------------------ | :--------------------------- |
| `compiler`          | `build`                                                 | 构建 buddy-mlir 编译链       |
| `workload`          | `clean` / `build` / `tohex`                             | 构建和转换 workload            |
| `kernel`            | `build`                                                 | 构建 Linux、rootfs 与 OpenSBI |
| `bebop-bemu`        | `sim` / `batch`                                         | 软件功能模拟和回归               |
| `bebop-verilator`   | `clean` / `verilog` / `build` / `sim` / `run` / `batch` | bebop 加速的 RTL 仿真          |
| `verilator` / `vcs` | `clean` / `verilog` / `build` / `sim` / `run`           | 标准 RTL 仿真                  |
| `bebop-p2e`         | `clean` / `verilog` / `buildbitstream` / `runworkload` / `batch` | FPGA 上板执行           |
| `firesim`           | `enumeratefpgas` / `buildbitstream` / `infrasetup` / `runworkload` | FireSim 加速仿真       |
| `uvm`               | `build` / `run`                                         | Ball 级 UVM 验证              |
| `yosys`             | `run` / `verilog` / `synth`                             | 开源综合流程                    |
| `dc`                | `verilog` / `area` / `power`                            | DC 综合、面积和功耗分析          |
| `ip-replace`        | `run`                                                   | 替换行为级 IP RTL              |

每个工具的必填参数、产物路径和具体执行步骤不完全一样。日常使用的 compiler、workload、kernel、bebop-bemu 和 bebop-verilator 可继续查看同目录下对应的文档。

## 常见踩坑

1. 提示 sub-arguments 需要 quoted string：把 operation 的所有参数放进同一对引号，例如 `--sim '--chip toy --binary xxx'`。
2. MCP 返回 `accepted=true` 就继续下一步：这时任务可能还在排队或执行，必须用 `bbdev_task_status` 查到终态。
3. 手动把端口写死为 `5000`：bbdev 默认会动态选端口；只有手动启动 `--server` 时才应该传固定的 `--port`。
4. 任务失败但没看到有用信息：先看对应工具在 `log/` 下的任务日志；如果是 MCP 服务没起来或路由没注册，再看 `bbdev/server.log`。
