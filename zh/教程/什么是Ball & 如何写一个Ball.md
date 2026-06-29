<div style="background:#f0f0f0;border-radius:8px;padding:16px;display:inline-block"><b>Thanks to</b><br><br><a href="https://github.com/Mikemy666" style="text-decoration:none;color:inherit;margin-right:20px"><img src="https://avatars.githubusercontent.com/u/140929282?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">Bohan Wang</span></a> <a href="https://github.com/shirohasuki" style="text-decoration:none;color:inherit"><img src="https://avatars.githubusercontent.com/u/68776527?v=4" width="48" height="48" style="border-radius:50%;vertical-align:middle"> <span style="vertical-align:middle">shiroha</span></a></div>


## 什么是ball

在 Buckyball 中，Ball 是一个可以被系统统一集成和调度的 DSA 加速器模块。每个 Ball 负责实现某一类特定计算能力，例如向量计算、矩阵计算、数据搬运或格式转换等；但从系统角度看，它们都通过统一的 Blink 接口与外部交互。也就是说，Buckyball 并不需要理解每个 Ball 内部具体怎么计算，只需要知道它如何接收命令、访问存储、返回完成信息，以及暴露必要的状态。通过这种抽象，不同类型的 DSA 可以以相同的方式接入同一个系统，由框架负责指令分发、连接管理和调度协同，而 Ball 的开发者则可以把主要精力放在自己的加速器逻辑上。

## 先写一个ball

一个ball包含的内容很多，包括但不限于下面列举的这些。

不过我们这次只学习完成前三个，也就是跑通一个算子的最小单元。

- ==测试用例==
- ==模拟器 Golden Reference Model==
- ==RTL代码==
- 编译器Pass
- 验证测试代码
- …

### 以最简单的脉动阵列为例

这节给初学者补充下脉动阵列的基础知识，实现最简单的 OS 数据流的