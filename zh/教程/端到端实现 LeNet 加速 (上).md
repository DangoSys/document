# 端到端实现 LeNet 加速 (上篇: workload分析 与 编译器)


上一节我们的设计流程从spec→workload→rtl拓展为spec→workload→bebop→rtl。
这一节让我们来继续延长这个设计的链条。

model→profiling→spec→compiler→test case→bebop→rtl