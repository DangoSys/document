# What is a Ball & How to Write One

<div style="background:#f0f0f0;border-radius:8px;padding:16px;display:inline-block"><b>Thanks to</b><br><br><a href="https://github.com/Mikemy666" style="text-decoration:none;color:inherit;margin-right:20px"><img src="https://avatars.githubusercontent.com/u/140929282?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">Bohan Wang</span></a> <a href="https://github.com/shirohasuki" style="text-decoration:none;color:inherit"><img src="https://avatars.githubusercontent.com/u/68776527?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">shiroha</span></a></div>


## What is a Ball

In Buckyball, a Ball is a DSA accelerator module that the system can integrate and schedule uniformly. Each Ball implements a specific class of compute capability—vector compute, matrix compute, data movement, format conversion, and so on—but from the system's perspective they all interact through the unified Blink interface. Buckyball does not need to understand how each Ball computes internally; it only needs to know how the Ball receives commands, accesses memory, signals completion, and exposes necessary state. Through this abstraction, different DSAs can plug into the same system in the same way. The framework handles instruction dispatch, connection management, and scheduling coordination, while Ball developers can focus on accelerator logic.

## Write a Ball first

A Ball involves many pieces, including but not limited to:

For this tutorial we only cover the first three—the minimum needed to run one operator end to end.

- ==Test cases==
- ==Simulator golden reference model==
- ==RTL code==
- Compiler passes
- Verification test code
- …

### Simplest example: a systolic array

This section gives beginners background on systolic arrays and implements the simplest OS dataflow.
