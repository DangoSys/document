# Repository Overview and Environment Setup

> Pending translation. See [中文版](仓库概览与环境搭建.md).

## What is Buckyball?

Buckyball is a general-purpose open-source architecture framework for DSA (Domain-Specific Architecture). DSA refers to architectures specifically optimized for a particular class of computational tasks, such as accelerators designed for machine learning, graph computing, signal processing, or scientific computing — for example, systolic array implementations for accelerating Transformers.

Buckyball's goal is not to define one fixed accelerator, but to provide a unified architecture abstraction, interface specification, and system support so that different domain-specific architectures can be seamlessly integrated into the same system and be efficiently scheduled, verified, and executed.

## Why do we need such a framework?

In many cases, the core compute logic area of a DSA on a chip or FPGA is not large, but when it comes to real deployment, you need to handle instruction interfacing, task scheduling, memory access, synchronization mechanisms, software stacks, test verification, performance analysis, and efficient simulation — a massive amount of system-level work. These costs recur across different projects, significantly raising the barrier from DSA design to usability.

Buckyball aims to consolidate these common system capabilities into a reusable, extensible open-source mainline, so researchers and developers can focus more on their own DSA designs while making it easier to publish, integrate, and collaborate with other accelerators.
