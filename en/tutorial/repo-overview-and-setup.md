### What is Buckyball

Buckyball is a general-purpose open-source architecture framework for DSA. DSA, or Domain-Specific Architecture, refers to architectures specifically optimized for a particular class of computational tasks—for example, dedicated accelerators designed for machine learning, graph computing, signal processing, or scientific computing, such as systolic array implementations for accelerating Transformers. Buckyball's goal is not to define one fixed accelerator, but to provide unified architecture abstractions, interface specifications, and system support so that different domain-specific architectures can be seamlessly integrated into the same system and be efficiently scheduled, verified, and executed.

### Why do we need such a framework?

In many cases, the core compute logic of a DSA does not occupy much area on a chip or FPGA, but bringing it to production requires handling instruction interfacing, task scheduling, memory access, synchronization mechanisms, software stacks, test verification, performance analysis, efficient simulation, and many other system-level concerns. These costs recur across projects and significantly raise the barrier from DSA design to usability. Buckyball aims to consolidate these common system capabilities into a reusable, extensible open-source mainline, so researchers and developers can focus more on their own DSA designs while making it easier to publish, integrate into the system, and collaborate with other accelerators.

We hope Buckyball helps you build your DSA projects faster and at higher quality, sharing infrastructure along the way.

### Environment setup

Either way, we need to get buckyball running first.

> [!tip] Environment requirements
> Any Linux system, plus reliable access to GitHub (a stable network connection matters!)

Let's install everything in one go.

1. Install Nix.

This tool manages our environment and ensures that installs from this repository stay consistent whether you set up today or ten years from now. This step requires sudo and is the only one that does.

```bash
sudo curl -fsSL https://install.determinate.systems/nix | sh -s -- install
```

When you see this, Nix installation is complete:

![image.png|697](image1-1.png)


2. Install the repository

```bash
git clone https://github.com/DangoSys/buckyball.git
cd buckyball
./scripts/nix/build-all.sh
```

When you see this, the repository install is complete:

![image.png](image1-2.png)

3. Verify the install by running:

```bash
bbdev bebop-verilator --run '--binary toy_vecunit_matmul_ones-baremetal --itrace --mtrace --pmctrace --ctrace --banktrace'
```

If it completes with output like the following, the repository is set up (the first run may take a while because it performs additional setup):

![image.png](image1-3.png)

This run invokes the vector acceleration unit for matrix multiply—your Buckyball journey starts here.
