# buckyball的指令规则



## 指令长什么样

软件侧统一用 RISC-V `custom-3` opcode 发 Buckyball 指令：

```c
.insn r 0x7b, 3, funct7, x0, rs1, rs2
```

也就是：

| 字段       | 约定                           |
| -------- | ---------------------------- |
| opcode   | `0x7b`，也就是 RISC-V `custom-3` |
| `funct3` | 固定为 `3`                      |
| `rd`     | 固定为 `x0`                     |
| `rs1`    | 放 bank id 和 iter             |
| `rs2`    | 放地址、stride 或这条指令自己的参数        |
| `funct7` | 指令编号，同时带 bank 访问类型           |



## buckyball 通用指令集