# bebop-verilator

`bebop-verilator` 是 bebop 加速过的 Verilator RTL 仿真。和 `bebop-bemu` 不同，这里会真正跑生成出来的 RTL，所以能抓到时序、接口握手、bank 访问这些纯软件模拟看不出来的问题。代价是更慢，而且第一次要把 Verilog 生成、仿真器编译这两步做完。

推荐顺序：

1. 先用 `bebop-bemu` 把功能跑通。
2. 再用 `bebop-verilator` 对同一条 workload 做 RTL 对照。
3. 改 RTL 或换 config 后，重新走 `verilog` + `build`；只改 workload 时，已有仿真器可以直接 `sim`。

常用 config：

```text
sims.verilator.BuckyballToyVerilatorConfig
sims.verilator.BuckyballPebbleVerilatorConfig
```

生成物默认落在 `arch/build/<config名>/`。


## clean

`bebop-verilator clean` 删除指定 config 的构建目录，也就是 `arch/build/<config名>`。换 config、Verilog 生成异常、或者怀疑构建缓存脏了时用。

用法如下：

```bash
bbdev bebop-verilator --clean '--config sims.verilator.BuckyballToyVerilatorConfig'
```

==参数1 config== `--config` 必填。Scala/Chipyard 侧的仿真配置全名。

==参数2 output-dir== `--output-dir` 可选。指定要清的目录。不写就按 config 推导默认路径。


## verilog

`bebop-verilator verilog` 只做 RTL 导出，不编译仿真器。实际会按 `--config` 调 mill，把 Chisel 生成到 `arch/build/<config名>/`。

用法如下：

```bash
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballPebbleVerilatorConfig'
```

==参数1 config== `--config` 必填。

==参数2 output-dir== `--output-dir` 可选。指定 Verilog 输出目录。


## build

`bebop-verilator build` 用上一步生成的 Verilog 编 bebop 的 Verilator 仿真二进制。要求 `VSRC_PATH` 对应目录已经存在，也就是先跑过 `verilog`。编完后会在 `bebop` 目录写一个 build marker，后面 `sim` 会检查 marker 是否和当前 config / vsrc 对得上，对不上直接报错，避免拿旧 binary 跑新 RTL。

用法如下：

```bash
bbdev bebop-verilator --build '--jobs 16 --config sims.verilator.BuckyballToyVerilatorConfig'
```

==参数1 config== `--config` 必填。

==参数2 jobs== `--jobs` 可选，默认 `16`。传给 `cargo build` 的并行度。


## sim

`bebop-verilator sim` 跑单个 workload。前提是当前 config 已经 `build` 过，且 build marker 没有过期。

实际执行步骤如下：

1. 检查 `arch/build/<config名>` 是否存在。
2. 检查 `bebop/target/debug/bebop` 和 build marker。
3. 在 `bb-tests/output/workloads/src` 里按名字找 ELF。
4. 执行 `bebop run verilator --elf ...`。
5. 日志默认写到 `arch/log/<时间戳>-<binary>`，波形默认写到 `arch/waveform/<时间戳>-<binary>`。

用法如下：

```bash
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --sim '--binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig --itrace --mtrace --pmctrace --ctrace --banktrace'
bbdev bebop-verilator --sim '--binary pebble_conv_im2col_test-singlecore-baremetal --config sims.verilator.BuckyballPebbleVerilatorConfig --no-wave'
```

==参数1 config== `--config` 必填。

==参数2 binary== `--binary` 必填。写 workload 产物名，和 bemu 一样先搜 `bb-tests/output/workloads/src`。

==参数3 log-dir / fst-dir== `--log-dir`、`--fst-dir` 可选。分别指定文本日志和波形目录。

==参数4 no-wave== `--no-wave` 可选。关掉波形，batch 或只关心 pass/fail 时可以开，会快一点。

==参数5 各类 trace== `--itrace`、`--mtrace`、`--pmctrace`、`--ctrace`、`--banktrace` 都是可选开关。需要看指令流、访存、PMC、控制流、bank 访问时再开，全开会慢很多，日志也会更大。


## run

`bebop-verilator run` 是一条龙：`clean → verilog → build → sim`。第一次搭环境、或者确定要把当前 config 整条链路重做时用它。日常反复改 workload 时不要每次都 `run`，太慢；RTL 没变就直接 `sim`。

用法如下：

```bash
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig'
bbdev bebop-verilator --run '--jobs 16 --binary toy_vecunit_matmul_ones-singlecore-baremetal --config sims.verilator.BuckyballToyVerilatorConfig --itrace --mtrace --pmctrace --ctrace --banktrace'
```

参数和 `clean` / `verilog` / `build` / `sim` 那几项基本同一套：`--config`、`--binary` 必填，`--jobs`、各类 trace、`--log-dir`、`--fst-dir`、`--no-wave` 可选。


## batch

`bebop-verilator batch` 按 chip 的回归列表批量跑 nextest。和 bemu 一样，列表在：

```text
examples/chips/<chip>/regression/batch/verilator/workloads-elf.toml
examples/chips/<chip>/regression/batch/verilator/workloads-pk.toml
```

注意：batch 不会帮你重新 `build`。跑之前要保证该 `--config` 已经 `verilog` + `build` 完成，否则会因 `VSRC_PATH` 不存在或仿真器不对而失败。

用法如下：

```bash
bbdev bebop-verilator --clean '--config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --verilog '--config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --build '--jobs 16 --config sims.verilator.BuckyballPebbleVerilatorConfig'
bbdev bebop-verilator --batch '--chip pebble --config sims.verilator.BuckyballPebbleVerilatorConfig --test elf-tests --clean-before'
```

==参数1 chip== `--chip` 必填。决定读哪个 chip 的 regression toml。

==参数2 config== `--config` 必填。决定用哪套已构建好的 Verilator RTL/仿真器。

==参数3 test== `--test` 必填，`elf-tests` 或 `pk-tests`。

==参数4 clean-before== `--clean-before` 可选。清 `bebop/test-artifacts` 后再跑。


## 常见踩坑

1. bemu 过了、verilator 不过：优先怀疑 RTL、接口时序、bank layout，不要先怀疑测试用例本身。这也是为什么要先跑 bemu。
2. `binary not found`：多半是没 `workload --build`，或者 `--chip` 和编出来的产物不是一套。
3. `VSRC_PATH does not exist` / build marker mismatch：Verilog 没生成，或者换了 config 却还在用旧 build。重新 `verilog` + `build`。
4. 切 chip 前先 `bbdev workload --clean`，再按新 chip build，避免 `bb-tests/output` 里残留同名 ELF，batch 列表对不上。
