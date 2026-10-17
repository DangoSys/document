# What is a Ball and how to write one

## What is a Ball?

A Ball is a compute module that Buckyball can integrate and schedule through a common interface. A vector unit, matrix engine, transpose unit, or format converter can all be Balls. The framework does not depend on the Ball's internal pipeline; it depends on a small contract:

- receive a decoded command through `cmdReq`;
- read and write MemDomain banks through `BankRead` and `BankWrite`;
- return the original ROB identity through `cmdResp`;
- report its state through `BallStatus`.

Frontend and BallDomain handle dispatch and dependency tracking. A Ball owns its data path and control state, while sharing the Core's scheduler and memory domain with other Balls.

## Ball contents

A usable Ball normally contains parameters, RTL, a BEMU functional model, an ISA wrapper, workloads, and verification. Compiler passes can be added later. The repository's `examples/balls/transpose` is a complete small example:

```text
configs/       Ball parameters
arch/src/      RTL and the Blink wrapper
emu/src/       BEMU semantics and latency model
workloads/     ISA header, C tests, and MLIR tests
verify/        UVM sequences, scoreboard, coverage, and testbench
```

## TransposeBall

TransposeBall reads a matrix from one bank and writes its transpose to another. Its instruction layout is defined in `workloads/isa/transpose.h`:

```text
rs1[9:0]    input bank (bank0)
rs1[29:20]  output bank (bank2)
rs1[63:30]  iter, the number of input rows
rs2[7:0]    element width, 8 or 32
```

The input and output banks must be allocated and different. The column counts must match and `iter` must be positive. The RTL and BEMU check the same conditions so an invalid command does not silently diverge between models.

`TransposeBall.scala` is the integration wrapper. It connects `BlinkIO`, bank channels, status, and completion signals, then instantiates `Transpose.scala`. The inner module implements the state machine:

```text
idle → sRead → sWrite → complete
```

It locks the command in `idle`, reads rows in `sRead`, writes transposed rows in `sWrite`, and returns the saved `rob_id` in `complete`. Assertions cover bank identity, column values, element width, and reserved instruction bits.

The BEMU implementation in `emu/src/transpose.rs` decodes the same fields, performs the operation in a temporary array, and writes the same bank layout. It does not model RTL cycles; it provides a simple functional reference for the workload.

## Write and run the first test

The C test prepares the banks, moves input data in, issues the Ball instruction, moves the result out, and compares it with a software transpose:

```c
bb_mem_alloc(src, 1, N_GROUPS);
bb_mem_alloc(dst, 1, N_GROUPS);
bb_mvin((uintptr_t)input_matrix, src, ROWS, 1);
bb_transpose(src, dst, ROWS, ELEM_BITS);
bb_mvout((uintptr_t)output_matrix, dst, ROWS, 1);
bb_mem_release(src);
bb_mem_release(dst);
```

Run the same workload through the layers:

```bash
bbdev config --install
bbdev workload --build '--chip pebble'
bbdev bebop-bemu --sim '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal'
bbdev bebop-verilator --run '--chip pebble --binary pebble-pebble-ctest-transpose_i8_16x16_test-baremetal --no-wave'
```

After the workload passes, run the Ball UVM environment. Check the current Ball ID for the selected Verilator configuration:

```bash
bbdev uvm --build '--ball=transpose'
bbdev uvm --run '--ball=transpose' -- '+BID=0'
```

When adding a new Ball, define the instruction and bank layout first, keep the ISA header, BEMU, and RTL in sync, add a small C test before a large regression, and only add compiler lowering after the direct instruction path is stable.
