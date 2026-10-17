---
name: code-reviewer
description: 对一段代码或整个仓库做结构化审查——标注问题、分级严重程度、给出修复建议。当用户提到「审查代码 / review / 帮我看看这段代码」时触发。
version: 1.2.0
author: demo-hub
license: MIT
allowed-tools: read, shell
---

# Code Reviewer（演示市场技能）

示例技能包，用于验证技能市场的「索引 → 安装 → 搜索 → 出现在 / 菜单」闭环。

## 工作流程
1. 读取目标代码或 diff。
2. 按 安全 / 正确性 / 性能 / 风格 四维给出评审。
3. 输出带严重级别（🔴高 / 🟡中 / 🟢低）的建议清单。
