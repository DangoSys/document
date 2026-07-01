# buckyball的指令规则



## 指令长什么样

软件侧统一用 RISC-V `custom-3` opcode 发 Buckyball 指令：

```c
.insn r 0x7b, 3, funct7, x0, rs1, rs2
```

buckyball的指令统一使用RISC-V的R型指令，通过RoCC协议由CPU发给NPU。

![](riscv-isa.svg)

也就是每条指令包含以下可利用的字段：

| 字段       | 总位宽 | 约定                                     |
| -------- | --- | -------------------------------------- |
| `funct7` | 7   | 高3bit由buckyball约定。低4bit为用户自由分配用于区分不同指令 |
| `rs1`    | 64  | 该寄存器统一由buckyball约定                     |
| `rs2`    | 64  | 该寄存器为用户自由分配                            |
| `rd`     | 64  | 该寄存器传输返回值，暂时预留，固定为 `x0`                |

也就是自定义一条指令，需要遵循buckyball在`fuct7`与`rs1`的约定即可被buckyball识别并统一进行优化和调度。

### Funct7的约定


### Rs1 的约定

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



## buckyball 通用指令集