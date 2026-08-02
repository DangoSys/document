# bebop-bemu

`bebop-bemu` 是纯软件功能模拟。它不跑 RTL，只按指令语义执行 workload，用来先验证测试用例和 ball 的功能行为对不对。日常写 ball、写 ctest 时应该先在这里跑通，再上 Verilator。

每个 chip 有自己的 BEMU 实现，入口在 `examples/chips/<chip>/emu`。命令会按 `--chip` 找到对应的 `Cargo.toml`，再去跑指定 ELF。

跑之前需要先把 workload 编出来：

```bash
bbdev workload --clean
bbdev workload --build '--chip toy'
```

## sim

`bebop-bemu sim` 跑单个 workload。实际执行步骤如下：

1. 按 `--chip` 找到 `examples/chips/<chip>/emu/Cargo.toml`。找不到就直接报错。
2. 在 `bb-tests/output/workloads/src` 里按名字搜 ELF。优先找 `CTest/chips/<chip>` 下的，找不到再找非 chip 专属的同名产物。搜不到同样直接报错。
3. `cargo run` 启动该 chip 的 BEMU，加载 ELF 执行。
4. 日志默认写到 `arch/log/<时间戳>-<binary>-bemu`。

用法如下：

```bash
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-singlecore-baremetal'
bbdev bebop-bemu --sim '--chip toy --binary toy_vecunit_matmul_ones-linux --pk'
bbdev bebop-bemu --sim '--chip pebble --binary pebble_conv_im2col_test-singlecore-baremetal'
```

==参数1 chip== `--chip` 必填。指定用哪个 chip 的 BEMU，比如 `toy`、`pebble`、`goban`。对应目录必须存在 `examples/chips/<chip>/emu/Cargo.toml`。

==参数2 binary== `--binary` 必填。写 workload 产物名即可，不一定要写绝对路径。常见后缀是 `-singlecore-baremetal` 或 `-linux`。名字必须能在 `bb-tests/output/workloads/src` 里搜到，搜不到说明 workload 没编，或者编的是别的 chip。

==参数3 pk== `--pk` 可选。加上以后走 proxy kernel 路径，用来跑 Linux 用户态那类 `-linux` workload。baremetal ELF 不要加这个参数。

==参数4 log-dir== `--log-dir` 可选。指定日志目录。不写就用默认的 `arch/log/...`。


## batch

`bebop-bemu batch` 按 chip 的回归列表批量跑 nextest。测试列表不在命令行里写死，而是读：

```text
examples/chips/<chip>/regression/batch/bemu/workloads-elf.toml
examples/chips/<chip>/regression/batch/bemu/workloads-pk.toml
```

实际执行步骤如下：

1. 校验 `--chip` 和对应 BEMU manifest。
2. 按 `--test` 选 `workloads-elf.toml` 或 `workloads-pk.toml`。文件不存在直接报错。
3. 先 `cargo build --tests` 编 BEMU 测试。
4. 再 `cargo nextest run --test test_bemu`，环境变量里带上 workload toml 和 `bb-tests/output`。

用法如下：

```bash
bbdev bebop-bemu --batch '--chip toy --test elf-tests'
bbdev bebop-bemu --batch '--chip toy --test pk-tests --clean-before'
bbdev bebop-bemu --batch '--chip pebble --test elf-tests --clean-before'
```

==参数1 chip== `--chip` 必填，含义和 `sim` 一样。

==参数2 test== `--test` 必填，只能是 `elf-tests` 或 `pk-tests`。
- `elf-tests` 对应 baremetal 列表 `workloads-elf.toml`
- `pk-tests` 对应 linux/pk 列表 `workloads-pk.toml`

想加回归用例，改对应 toml，不要在命令行里临时拼一长串 binary。

==参数3 clean-before== `--clean-before` 可选。加上会先清掉该 chip BEMU 目录下的 `test-artifacts`，避免旧产物干扰本次 batch。CI 里一般会开。
