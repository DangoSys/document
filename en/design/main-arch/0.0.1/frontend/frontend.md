
# Frontend domain architecture

<div style="background:#f0f0f0;border-radius:8px;padding:16px;display:inline-block"><b>Thanks to</b><br><br><a href="https://github.com/Gekyume777" style="text-decoration:none;color:inherit;margin-right:20px"><img src="https://avatars.githubusercontent.com/u/147403260?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">Patrick.Qian</span></div>


## 1 Introduction

As mentioned earlier, the BB RTL architecture is divided into the frontend domain, memory domain, and architecture domain. From a microarchitecture perspective, the part of a processor responsible for instruction supply is called the frontend. BB's frontend achieves powerful out-of-order issue and in-order retirement through mechanisms such as BAT and Scoreboard, preserving instruction-level parallelism (ILP) on the NPU. BB also exposes diverse configuration options to meet instruction throughput needs in different scenarios. The frontend modules are:

- `GlobalDecoder` translates RoCC instructions into `PostGDCmd`, which the BB frontend understands uniformly.
- `GlobalScheduler` decides whether an instruction can enter the ROB and whether it can be issued to an execution domain.
- `GlobalROB` preserves global order so instructions can execute out of order but still commit in order.
- `BankAliasTable` renames write banks to avoid false dependencies stalling scheduling.
- `BankScoreboard` tracks true data dependencies and prevents reads before writes complete.
- `SubROB` handles micro-instructions. Complex Balls can split one main instruction into a sequence of micro-ops and hand them back to the frontend for unified scheduling.

The figure below shows where the frontend sits globally and how its internal modules connect. Current NPU instruction design is tightly coupled to the RocketChip CPU.

![BB frontend domain overview](ch1-module-connection-v14.svg)

The core goal of this document is to explain, from a dataflow perspective, what happens after the NPU receives instructions from the CPU: how they are decoded, allocated into the ROB, queued, selected for issue, complete, and finally retire from the ROB.


## 2 Instruction preprocessing

### 2.1 Instruction decode

![Instruction lifecycle — decode](life-decode-v2.svg)

The frontend domain accepts `RoCCCommandBB` from the CPU. That packet still carries RoCC formatting and cannot enter global scheduling directly: the scheduler does not care how an instruction is encoded in software; it first needs to know which execution domain it belongs to, which banks it accesses, and whether it changes frontend control flow. `GlobalDecoder` turns `RoCCCommandBB` into `PostGDCmd`. That translation covers three aspects:

- Instruction ownership: `domain_id` distinguishes FRONTEND, MEM, GP, and BALL.
- Data access: `BankAccessInfo` describes up to two read banks and one write bank.
- Frontend control: `isFence` and `isBarrier` mark control instructions that do not enter the ROB.


Decoded `PostGDCmd` is the instruction form all downstream frontend modules share. Bank information is analogous to register information in a CPU instruction. Bank access comes from `funct7[6:4]` and `rs1Data`: the former describes the access pattern; the latter describes where bank ids come from:

<table>
<tr>
<td valign="top">

| `funct7[6:4]` | Bank access pattern |
| --- | --- |
| `000` | No bank access |
| `001` | Read `bank_0` |
| `010` | Write bank |
| `011` | Read `bank_0`, write bank |
| `100` | Read `bank_0`, `bank_1`, write bank |

</td>
<td valign="top">

| `rs1Data` field | Meaning |
| --- | --- |
| `rs1[9:0]` | `bank_0` |
| `rs1[19:10]` | `bank_1` |
| `rs1[29:20]` | `bank_2` |
| `rs1[63:30]` | `iter` |

</td>
</tr>
</table>

Note one encoding difference: for Mem instructions the write bank comes from `bank_0`; for Ball instructions it comes from `bank_2`. The decoder hides that difference; downstream modules only see unified `BankAccessInfo`.

`GlobalDecoder` does not buffer instructions separately. Its input ready follows output ready. When downstream cannot accept, the RoCC entry is backpressured. That keeps the decoder a lightweight preprocessing boundary; real queuing and out-of-order capability live in GlobalROB later.

## 3 Instruction scheduling

### 3.1 ROB allocation

![Instruction lifecycle — allocation](life-alloc-v2.svg)

The ROB (Re-Order Buffer) is the frontend core. After decode, ordinary instructions enter `GlobalScheduler`, which allocates them into `GlobalROB`. To prepare for out-of-order issue, allocation is not a simple FIFO write; it establishes three kinds of state at once: ROB order, bank versions, and dependency occupancy.

Frontend control instructions do not enter the ROB. `FENCE` raises `fenceActive` and waits for the ROB to drain; `BARRIER` first waits for the ROB to drain, then raises `barrier_arrive` until external `barrier_release` returns. Their semantics control frontend boundaries rather than participate in out-of-order execution.

Aside from those two, when an ordinary instruction enters the ROB, `tailPtr` becomes its `rob_id`. One ROB entry holds:

| Field | Role |
| --- | --- |
| `cmd` | Decoder output `PostGDCmd` |
| `renamedBankAccess` | Bank access after BAT rename |
| `rob_id` | Position in GlobalROB |

The important interaction is BAT plus Scoreboard. BAT solves the version problem for identically named banks; Scoreboard answers whether that version is readable now. Together they remove false dependencies between instructions.

![BAT and Scoreboard](bat-scoreboard-clean.svg)

BAT rename boils down to three steps: readers look up the old version, writers get a new version, then the new version is published.

```scala
private val aliasBase = vbankUpper + 1
private def extraAlias(robId: UInt): UInt =
  aliasBase.U(aliasIdLen.W) + robId

val q = io.alloc.raw

// 1. Read banks: look up v2a for the current version
io.alloc_renamed.rd_bank_0_id := mapVbank(q.rd_bank_0_id)
io.alloc_renamed.rd_bank_1_id := mapVbank(q.rd_bank_1_id)

// 2. Write bank: allocate a new version by rob_id
io.alloc_renamed.wr_bank_id   := extraAlias(io.alloc.rob_id)

// 3. On successful alloc: publish the new version
when(io.alloc.valid && q.wr_bank_valid) {
  v2a(toVbankIdx(q.wr_bank_id)) := extraAlias(io.alloc.rob_id)
}
```

First, readers look up the old version: `mapVbank` queries `v2a` and maps the original virtual bank to the current alias. Second, writers get a new version: the write bank does not reuse the original bank id; it gets `extraAlias(rob_id)`. Third, publish the new version: after alloc succeeds, BAT updates `v2a(wr_vbank)` to that alias. The write-rename formula is `new_alias = aliasBase + rob_id`, where `aliasBase = vbankUpper + 1`. Virtual bank numbers only index `v2a` to decide which virtual bank's current version is overwritten; the allocated alias depends only on ROB position.

Without BAT, every instruction writing the same virtual bank would block each other because the scheduler only sees "both are vbank3". After BAT introduces aliases, each write bank gets a new version owned by that ROB entry, and later readers see the latest alias at that time. For example:

| Instruction | Original access | After BAT | Notes |
| --- | --- | --- | --- |
| I0 | write vbank3 | write alias16 | new version of vbank3 |
| I1 | read vbank3 | read alias16 | reads version produced by I0 |
| I2 | write vbank3 | write alias18 | another new version of vbank3 |
| I3 | read vbank3 | read alias18 | reads version produced by I2 |

The frontend no longer judges dependence by bank name; it judges by data version. That creates room for out-of-order issue.

Scoreboard is a state table on renamed aliases. It no longer cares about original vbank names; it cares whether that specific version can be read now. Each alias mainly tracks two states: `bankWrBusy` means the writer for that alias has not finished, so readers must wait; `bankRdCount` counts issued but incomplete readers, describing how many reads are in flight on that alias. At issue time, RTL only checks read-side RAW: if `rd_bank_0` or `rd_bank_1` hits `bankWrBusy`, the instruction cannot issue. Write-side WAW/WAR is no longer blocked by Scoreboard because BAT gives each write an independent alias; writers do not fight over the same name and do not overwrite old versions held by older readers.

Scoreboard marks the write alias busy at alloc. That timing matters: BAT already publishes the new alias to later instructions at alloc; if Scoreboard did not mark busy immediately, a reader could read a version before the writer actually issues. When the instruction completes, Scoreboard clears write busy and decrements the read counts that instruction held.

Allocation therefore is not one action but a synchronized update: the ROB records order, BAT establishes bank versions, and Scoreboard records that the new version is not yet ready.

### 3.2 Instruction issue

![Instruction lifecycle — issue](life-issue-v2.svg)

GlobalROB allows out-of-order issue, but not arbitrarily. Each cycle the ROB scans from `headPtr` and selects the first instruction that satisfies:

```text
valid && !issued && !complete && !scoreboard_hazard && !cfg_hazard
```

Scoreboard checks true RAW dependence on renamed banks. When reading an alias, if that alias's writer has not finished, the reader cannot issue; multiple readers of the same ready alias are allowed. WAW and WAR name dependence is already removed by BAT's write-alias mechanism, so Scoreboard does not conservatively block on original virtual banks.

Besides ordinary data dependence, the ROB also checks configuration hazards. `MSET` and `MMIO_SET` change bank mapping or MMIO binding, so when a younger instruction overlaps an older configuration-related instruction, it cannot pass even if Scoreboard shows no data RAW.

On issue, the ROB fills in `op1_col`, `op2_col`, and `wr_col`. Column information comes from committed `MSET` values stored in `bankCols`. Decode only identifies bank ids; issue adds the internal bank column for the execution domain.

The scheduler routes `GlobalSchedIssue` to Ball, Mem, and GP based on `domain_id`. If SubROB has issuable micro-ops, main ROB issue pauses so the micro-op path gets priority. That prevents the main path from constantly cutting ahead of an internal sequence split from a complex instruction.

The small flow below shows how out-of-order issue happens. Assume the ROB holds four instructions: `I0` not ready, `I1` and `I2` ready, `I3` depends on `I2`:

| Cycle | ROB state | Scoreboard | Issue result | Notes |
| --- | --- | --- | --- | --- |
| T0 | I0, I1, I2, I3 valid | I0 waits on alias10; I1/I2 ready; I3 waits on alias12 | issue I1 | scan skips I0, picks earliest ready |
| T1 | I0 waiting; I2 ready; I3 waiting | I2 ready | issue I2 | I2 is younger than I0 but has no deps, can pass |
| T2 | I2 complete | alias12 released | issue I3 | I3 issues once the true version is ready |
| T3 | I0 ready | alias10 released | issue I0 | older instruction eventually issues; commit still ordered |

"Out of order" here applies only to issue and complete; commit remains controlled by the ROB head.

### 3.3 Instruction complete

![Instruction lifecycle — complete](life-complete-v2.svg)

When an execution domain finishes, it returns `GlobalSchedComplete` on one of the Ball, Mem, or GP completion ports. The scheduler arbitrates the three paths into one completion stream, then writes back to main ROB or SubROB based on `is_sub`.

A normal completion packet carries `rob_id`. GlobalROB marks the entry complete and tells Scoreboard to release that entry's read counts and write busy. With default `rs_out_of_order_response = true`, completions may return out of order; as long as the `rob_id` entry was issued, it can be marked complete.

If `rs_out_of_order_response` is off, the scheduler additionally requires the completing entry to be at `head_ptr`, forcing in-order completion. That mode is more conservative but reduces freedom for execution-domain responses.

Micro-op completion does not write the main ROB directly. The execution domain returns `is_sub=true` and `sub_rob_id`. SubROB locates the slot in the current row with `sub_rob_id = row_id * 4 + slot_id` and marks that slot done. Only when all valid slots in the current row are done does SubROB advance to the next row. After all rows finish, SubROB signals `masterComplete(masterRobId)` back to the main ROB.

### 3.4 Instruction commit

![Instruction lifecycle — commit](life-commit-v2.svg)

Complete is not commit. Complete means the execution domain returned; commit means the instruction can retire in global order. GlobalROB commit always starts at `headPtr`, committing consecutive complete entries and stopping at the first incomplete one.

Commit does four things:

1. Clear valid, issued, and complete on ROB entries.
2. Tell BAT to release metadata for the corresponding ROB alias.
3. If the committed instruction is `MSET`, update `bankCols`.
4. Advance `headPtr`.

When BAT releases an alias it does not unconditionally restore the old mapping. It restores the old alias only if the virtual bank still points at that ROB entry's new alias. That prevents an older write commit from overwriting a newer version established by a younger write.

GlobalROB lifecycle in summary: allocation establishes order and versions; issue may pass not-yet-ready older entries; complete releases dependence resources; commit restores global order and reclaims metadata.

## 4 Micro-instruction handling

### 4.1 Instruction split

![Micro-instruction lifecycle — split](micro-life-split-v2.svg)

A normal instruction is one `PostGDCmd` and one main ROB entry. Micro-instructions are internal operations a complex Ball generates while executing a main instruction. They still use `PostGDCmd`. After the main instruction issues to a Ball, the Ball splits it into micro-ops and feeds them back through `ball_subrob_req_i` into frontend SubROB. SubROB turns Ball-generated rows into a per-slot micro-op issue stream. It is not another GlobalROB or a submodule of GlobalROB; it is an independent micro-op window serving the expansion sequence of a single main instruction.

Splitting solves how to express complex instructions. One high-level loop instruction may include configure, move-in, preload, compute, move-out, release, and more. Exposing every step in software makes the stream fragmented; hiding everything inside one Ball prevents the frontend from scheduling cross-domain ops uniformly. SubROB is the compromise: software still sends the main instruction; the Ball expands micro-ops internally and returns them to the frontend, which keeps issuing them under the same protocol.

SubROB's basic unit is `SubRobRow` with four issue slots per row. Slots within a row can advance in parallel; rows define ordering boundaries that must be respected. That schedules dependent micro-ops in order and independent ones in parallel, similar to a four-wide out-of-order CPU.

![SubROB row window](subrob-row-window-v6.svg)

In the structure above, each slot has `valid` and `cmd: PostGDCmd`. At row level, `ball_id` and `master_rob_id` are carried. `ball_id` locks which Ball SubROB serves; `master_rob_id` writes back to the main ROB after all micro-ops finish.

### 4.2 Micro-instruction scheduling

![Micro-instruction lifecycle — schedule](micro-life-schedule-v2.svg)

As noted, SubROB is a multi-row sequence with four issue slots: out of order within a row, in order across rows. Ingest, issue, complete, and retire are driven by a state machine; this section explains its transitions and outputs.

SubROB has locking rules on write: when empty, it accepts the first row from any Ball and records `lockedBallId` and `masterRobId`; when occupied, it accepts only subsequent rows from the same Ball with the same `masterRobId`. That prevents micro-ops from different complex instructions from interleaving in one SubROB window.


```text
SubROB state machine

               rowCount > 0
  +--------+ --------------> +----------+   SRAM read req   +-----------+
  | sIdle  |                 | sReadReq | ---------------> | sReadWait |
  +--------+ <-------------- +----------+                  +-----------+
      ^       masterComplete fire                                |
      |                                                          | data valid
      |                                                          v
  +-------------+     all rows done      +-----------+   issue valid slots
  | sWaitMaster | <--------------------- | sWaitSlots| <----------------+
  +-------------+                        +-----------+                  |
        ^                                      ^                        |
        | all slots done                       | wait subComplete        |
        +--------------------------------------+                        |
                                       current row all slots issued     |
                                                                         v
                                                                    +-----------+
                                                                    | sReadResp |
                                                                    +-----------+
```

The state machine has two phases. Phase one fetches a row: `sReadReq` sends a SyncReadMem read; `sReadWait` waits for the synchronous read return. Phase two processes the row: `sReadResp` each cycle picks the first unissued valid slot in the current row; after all valid slots issue, enter `sWaitSlots` and wait for completion; after all rows finish, enter `sWaitMaster` and send `masterComplete` to the main ROB.

On micro-op issue, SubROB generates `GlobalSchedIssue`. The scheduler routes by the micro-op's own `domain_id` to Ball, Mem, or GP. Execution domains only need to return `is_sub` and `sub_rob_id` unchanged in the completion packet.

The row example below shows 4-slot scheduling:

| Cycle | Current row | Slot state | SubROB action | Return/advance |
| --- | --- | --- | --- | --- |
| T0 | row0 | s0/s1/s2/s3 valid | issue s0 | wait for s0 complete |
| T1 | row0 | s1/s2/s3 not issued | issue s1 | s0 may complete out of order |
| T2 | row0 | s2/s3 not issued | issue s2 | if s1 completes first, mark s1 done only |
| T3 | row0 | s3 not issued | issue s3 | four slots may complete out of order |
| T4 | row0 | all issued | wait for all valid slots done | advance to row1 when collected |
| T5 | row1 | s0/s1/s2 valid | issue row1.s0 | repeat |
| Tend | all rows done | - | send `masterComplete` | main ROB marks main instruction complete |

Understand "out of order" at row boundaries: slots in one row have no ordering enforced by SubROB; they can issue to different domains and complete in any order. Rows are strictly sequential: the next row starts only after all valid slots in the current row are done. Encoders put dependent micro-ops in different rows to express boundaries explicitly; SubROB tracks each slot with `sub_rob_id = row_id * 4 + slot_id` and finally collapses to one main ROB completion.

This lets complex instructions split finely without breaking main ROB semantics: SubROB owns micro-op lifetime; GlobalROB still owns global commit order.
