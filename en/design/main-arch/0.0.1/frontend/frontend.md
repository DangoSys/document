# BB Frontend Domain Architecture

> Pending translation. See [中文版](前端域架构.md).

## 1 Introduction

The BB RTL architecture is divided into Frontend Domain, Memory Domain, and Architecture Domain. In the microarchitecture perspective, the part of the processor responsible for instruction supply is called the Frontend. BB's Frontend achieves powerful out-of-order issue and in-order retirement through mechanisms like BAT and Scoreboard, ensuring instruction-level parallelism (ILP) for the NPU.

- `GlobalDecoder` translates RoCC instructions into `PostGDCmd` understood uniformly by the BB frontend.
- `GlobalScheduler` decides whether an instruction can enter the ROB and be issued to an execution domain.
- `GlobalROB` maintains global order, allowing out-of-order execution with in-order commit.
- `BankAliasTable` handles write-bank renaming to avoid false dependencies stalling the scheduler.
