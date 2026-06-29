# Compiler

> Pending translation. See [中文版](zh/设计文档/主线架构/0.0.1/编译器/Overview.md).

This document describes how the Buddy compilation chain lowers high-level operators to Buckyball intrinsics, then converts them into RISC-V custom instructions. The entry point is typically Linalg or exported MLIR; the exit is LLVM IR with `@llvm.riscv.bb.*` intrinsics, linked into workloads via `buddy-llc -mattr=+buddyext`.

The pipeline goes through a Tile layer for shape alignment and tiling, the Buckyball dialect for operator semantics, Bank SSA for expanding bank dataflow, and assign-physical-banks for binding physical bank IDs. Any pass encountering shape or bank count mismatches will error out directly — no silent degradation.
