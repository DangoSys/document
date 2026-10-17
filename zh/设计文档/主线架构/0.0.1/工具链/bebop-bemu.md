# bebop-bemu

`bebop-bemu` 是纯软件功能模拟。它不跑 RTL，只按指令语义执行 workload，用来先验证测试用例和 ball 的功能行为对不对。日常写 ball、写 ctest 时应该先在这里跑通，再上 Verilator。

每个 chip 的 BEMU 入口是 bbdev：`bbdev bebop-bemu --sim '--chip <chip> ...'`。Cargo 编 `examples/chips/<chip>/configs/generated/bemu/Cargo.toml`，运行该 chip 的模拟器。

跑之前需要先把 workload 编出来：

```bash
bbdev workload --clean '--chip toy'
bbdev workload --build '--chip toy'
```

## sim

`bebop-bemu sim` 跑单个 workload。实际执行步骤如下：

1. 按 `--chip` 找到 `examples/chips/<chip>/configs/chip.toml`。找不到就直接报错。
2. 在该 chip 的 workload 和 kernel 输出目录里按名字搜 ELF。搜不到同样直接报错。
3. 用 `cargo run --release --manifest-path ...` 启动该 Chip 的 BEMU，加载 ELF 执行。
4. 日志写到 `log/<时间戳>-<chip>-bemu-<binary>`。

用法如下：

```bash
bbdev bebop-bemu --sim '--chip toy --binary toy-toy-ctest-relu_i32_16x16_test-baremetal'
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal'
bbdev bebop-bemu --sim '--chip pebble --model lenet --itrace --mtrace'
```

==参数1 chip== `--chip` 必填。指定用哪个 chip 的 BEMU，比如 `toy`、`pebble`、`goban`。对应 `examples/chips/<chip>/configs/chip.toml` 必须存在。

==参数2 binary== `--binary` 和 `--model` 二选一。写 workload 产物名即可，不接受路径。常见后缀是 `-baremetal`。名字必须能在 `bb-tests/output/<chip>/workloads/src` 或 `bb-tests/output/kernel/<chip>` 里搜到，搜不到说明产物没编，或者编的是别的 chip。

==参数3 pk== `--pk` 已不支持。模型改用 `--model <模型名>`。

==参数4 disasm== `--disasm` 可选。启用逐指令反汇编日志 `disasm.log`，仅在调试指令执行时使用；默认关闭。

==参数5 tool-profile== `--tool-profile` 可选。输出 NPU 功能模型与 RVSim CPU 执行的粗粒度 host 时间占比；默认关闭。


## analysis

`bebop-bemu analysis` 只分析已有 `bdb.ndjson`，不跑仿真。`--chip` 必填：基础指令（fence / mset / mvin / mvout 等）用 frontend ISA，其余 funct 从该 chip 的生成配置中的 `balldomain.ballISA` 读取，对不上直接报错。mtrace 的 `bank_depth` 读同一 core 的 `memdomain` `[bank].entries`，占用率写成 `mean_rows/bank_depth`。

`--log-dir` 必填，目录里必须已有 `bdb.ndjson`。`--itrace` / `--mtrace` 至少开一个；要了某种 trace 但文件里没有对应事件，直接失败。报告写到 `<log-dir>/analysis.txt`。

```bash
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --itrace --mtrace'
bbdev bebop-bemu --analysis '--chip pebble --log-dir /abs/path/to/log-dir --itrace --mtrace'
```

==参数1 chip== `--chip` 必填。从 topology 里唯一的 `cores/<pkg>` 读 balldomain / memdomain。

==参数2 log-dir== `--log-dir` 必填，必须是绝对路径。相对路径（例如 `log/...`）直接报错。

==参数3 itrace / mtrace== 指定分析哪类 trace，至少开一个。


## batch

`bebop-bemu batch` 按 chip 的回归列表批量跑 nextest。测试列表不在命令行里写死，而是读：

```text
examples/chips/<chip>/regression/batch/bemu/workloads-bare.toml
examples/chips/<chip>/regression/batch/bemu/workloads-linux.toml
```

实际执行步骤如下：

1. 校验 `--chip` 和对应 BEMU manifest。
2. 按 `--test` 选 `workloads-bare.toml` 或 `workloads-linux.toml`。文件不存在直接报错。
3. 先 `cargo build --tests` 编 BEMU 测试。
4. 再 `cargo nextest run --test test_bemu -- --workload-toml <workloads-*.toml> --bb-tests-root <bb-tests/output>`。

用法如下：

```bash
bbdev bebop-bemu --batch '--chip toy --test bare-tests'
bbdev bebop-bemu --batch '--chip toy --test linux-tests --clean-before'
bbdev bebop-bemu --batch '--chip pebble --test bare-tests --clean-before'
```

==参数1 chip== `--chip` 必填，含义和 `sim` 一样。

==参数2 test== `--test` 必填，只能是 `bare-tests` 或 `linux-tests`。
- `bare-tests` 对应 baremetal 列表 `workloads-bare.toml`
- `linux-tests` 对应 Linux 列表 `workloads-linux.toml`

想加回归用例，改对应 toml，不要在命令行里临时拼一长串 binary。

==参数3 clean-before== `--clean-before` 可选。加上会先清掉该 chip BEMU 目录下的 `test-artifacts`，避免旧产物干扰本次 batch。CI 里一般会开。
