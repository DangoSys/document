# Ball Simulation, Verification, and Evaluation

We have now written a systolic-array Ball. The next question is how to evaluate whether the Ball behaves as expected, and its PPA (performance, area, and power), so we can guide the next round of optimization.

# Ball design flow

Mature chip design usually iterates in small steps on an existing architecture, so most of the system has a golden reference (before a change there were no bugs; after the change a bug appears, making it easy to localize the problem).

For a newly implemented Ball, however, the RTL is often uncertain and unlikely to be correct on the first try. Test cases may also be wrong, and some instructions or design choices may only prove incorrect once you actually run tests. So for a Ball built from scratch, you need a layered progression where implementations cross-check against golden references.

# ctest and bebop: getting correct test cases

In the previous section, to keep things approachable and avoid too many concepts at once, our flow was spec→workload→rtl. Here we extend it to:

spec→workload→bebop→rtl

bebop is Buckyball's software simulator. It hides hardware timing details and ensures functional correctness.

The purpose of adding workload→bebop is to verify that test cases are correct: if a workload passes on bebop but fails on RTL, the problem is in the RTL.
