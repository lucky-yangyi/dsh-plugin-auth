---
name: pr-review-helper
description: 在 dsh 工作台里对一个 GitHub Pull Request 做结构化审查——列出风险点、给出修改建议、生成审查评语。当用户提到「审查 PR / review / 帮我看这个 PR」时触发。
version: 1.0.0
author: demo-hub
license: MIT
allowed-tools: read, shell
---

# PR Review Helper（演示市场技能）

这是 `@my/dsh-plugin-auth` 技能市场（对标 WorkBuddy SkillHub）的一个**示例技能包**，
仅用于本地验证「索引 → 安装 → 出现在 / 菜单 → 卸载/升级」的完整闭环。

## 触发方式
在输入框键入 `/pr-review-helper `，或直接说「帮我 review 一下这个 PR」。

## 工作流程
1. 从用户提供的 PR 链接或 diff 中提取变更文件清单。
2. 对每一处变更做风险分级（高/中/低）。
3. 输出结构化的审查意见：风险点、建议、是否阻塞合并。
4. 生成一段可直接粘贴到 GitHub 的审查评语（中文）。

## 注意事项
- 这是演示包，不包含真实的 git/网络调用；实际接入时在此处调用 gh CLI 或平台 API。
- 用户可在市场面板里一键卸载（只删 `<slug>__hub` 目录，不影响手工技能）。
