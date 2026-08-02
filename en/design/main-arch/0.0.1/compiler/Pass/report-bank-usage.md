# report-bank-usage

`report-bank-usage` is a diagnostic pass; it does not change IR. Code lives at:

```text
compiler/src/Conversion/LowerBuckyball/ReportBankUsagePass.cpp
```

It reads the alloc/release timeline of `buckyball.mset` and reports peak physical bank usage in a function. Input should already have gone through `assign-physical-banks`, because this pass needs constant-form bank IDs.

Output is printed to stderr, in a form like:

```text
[bank-usage] func_name peak=7/16 alloc=12 release=12 leaked=0
```

Where:

- `peak` is the peak number of physical banks in use at once.
- `alloc` is the number of alloc events.
- `release` is the number of release events.
- `leaked` is the number of allocations still unreleased at function end.

Verbose output for each alloc/release:

```bash
buddy-opt input.mlir -report-bank-usage='bank_num=16 verbose=true'
```

This pass strictly checks the `mset` timeline:

- `bank_num <= 0` fails.
- Non-constant bank ID fails.
- Bank ID out of range fails.
- Illegal alloc row/col fails.
- Duplicate alloc on the same base bank fails.
- Overlapping allocs fail.
- Release with no matching alloc fails.
- Unreleased allocations at function end fail.

It fits after `assign-physical-banks` to confirm that a lowering’s bank lifetimes match expectations.
