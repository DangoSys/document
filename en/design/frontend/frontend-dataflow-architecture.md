# BB Frontend Domain Architecture

> This page is pending translation. See the [中文版](../../zh/设计文档/frontend/frontend_dataflow_architecture.md) for the full content.

## 1 Introduction

The BB RTL architecture is divided into Frontend Domain, Memory Domain, and Architecture Domain. In the microarchitecture perspective, the part of the processor responsible for instruction supply is called the Frontend. BB's Frontend achieves powerful out-of-order issue and in-order retirement through mechanisms like BAT and Scoreboard, ensuring instruction-level parallelism (ILP) for the NPU.
