# Buckyball instruction rules



## What instructions look like

Software uses the RISC-V `custom-3` opcode uniformly to issue Buckyball instructions:

```c
.insn r 0x7b, 3, funct7, x0, rs1, rs2
```

Buckyball instructions uniformly use RISC-V R-type instructions, sent from the CPU to the NPU through the RoCC protocol.

![](riscv-isa.svg)

Each instruction therefore exposes the following usable fields:

| Field    | Total width | Convention |
| -------- | ----------- | ---------- |
| `funct7` | 7           | Upper 3 bits are defined by Buckyball; lower 4 bits are freely assigned by the user to distinguish instructions |
| `rs1`    | 64          | This register is uniformly defined by Buckyball |
| `rs2`    | 64          | This register is freely assigned by the user |
| `rd`     | 64          | Return-value register; reserved for now, fixed to `x0` |

To define a custom instruction, follow Buckyball's conventions on `funct7` and `rs1` so Buckyball can recognize it and apply unified optimization and scheduling.

### Funct7 conventions


### Rs1 conventions

<table>
<tr>
<th style="text-align:center; background:#e8f4fd; padding:4px 12px;">63:48</th>
<th style="text-align:center; background:#fde8e8; padding:4px 8px;">47</th>
<th style="text-align:center; background:#fde8e8; padding:4px 8px;">46</th>
<th style="text-align:center; background:#fde8e8; padding:4px 8px;">45</th>
<th style="text-align:center; background:#e8fde8; padding:4px 12px;">44:30</th>
<th style="text-align:center; background:#fdf8e8; padding:4px 12px;">29:15</th>
<th style="text-align:center; background:#f0e8fd; padding:4px 12px;">14:0</th>
</tr>
<tr>
<td style="text-align:center; padding:6px 12px;"><code>iter</code><br><sub>16-bit</sub></td>
<td style="text-align:center; padding:6px 8px;"><code>WR</code></td>
<td style="text-align:center; padding:6px 8px;"><code>RD1</code></td>
<td style="text-align:center; padding:6px 8px;"><code>RD0</code></td>
<td style="text-align:center; padding:6px 12px;"><code>bank_2</code><br><sub>15-bit</sub></td>
<td style="text-align:center; padding:6px 12px;"><code>bank_1</code><br><sub>15-bit</sub></td>
<td style="text-align:center; padding:6px 12px;"><code>bank_0</code><br><sub>15-bit</sub></td>
</tr>
</table>



## Buckyball general instruction set
