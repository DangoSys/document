# ISA

> Pending translation. See [中文版](zh/设计文档/主线架构/0.0.1/Overview/ISA.md).

This document records Buckyball's general instructions. The instruction execution units are memdomain and frontend. Managed as `+xbuckyballbase` in the LLVM backend. Each specific chip extends various ball instructions on this basis.

| ISA   | Func7 | Rs1 | Rs2 |
| ----- | ----- | --- | --- |
| fence |       |     |     |
| mset  |       |     |     |
| mvin  |       |     |     |
| mvout |       |     |     |
