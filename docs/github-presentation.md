# GitHub presentation kit / GitHub 展示文案

[English README](../README.md) · [中文 README](../README.zh-CN.md)

## About

**EN:** Turn a brief into reviewed answers and files. A Windows desktop workspace for Codex, Claude Code and other local agents, with four collaboration workflows.

**中文：** 让多个 Agent 一起把任务做完：讨论、制作、独立检查，在一个 Windows 工作台里交付最终回答和文件。支持六种本机 CLI、中英文与浅深色主题。

## Tagline / 标语

**Your agents. One brief. A deliverable.**

**给团队一个目标，把最终成果带回来。**

## Topics / 标签

`multi-agent` · `agent-orchestration` · `desktop-app` · `windows` · `electron` · `vue3` · `typescript` · `codex` · `claude-code` · `local-first`

## Release introduction / 发布介绍

**Qwork Preview — Your agents. One brief. A deliverable.**

Bring Codex, Claude Code, WorkBuddy, Zcode, OpenClaw and Qwen Code into one Windows desktop workspace. Choose Roundtable Discussion, Create & Review, Relay Discussion or Independent Analysis to match the task.

Qwork gives the work a clear structure: a shared brief, focused roles, synthesis and production by one owner, and reviews tied to the actual output version. Critical questions are collected for you; native desktop notifications bring you back when a decision is needed. Keep local history, streamed Markdown and deliverables together in a Chinese/English interface with light and dark appearance.

The preview is validated with automated workflow and CLI-process fixtures plus Electron UI acceptance. These are separate from live provider coverage. Agents supply file-reading, generation, rendering and web capabilities. See the validation record before making provider- or format-specific claims.

**中文发布介绍：**

Qwork 将六种本机 Agent CLI 放进同一个 Windows 工作台，提供圆桌讨论、制作检查、接力讨论与独立分析。你负责提出目标和验收成果，Qwork 组织分工、集中关键问题，并将文件与检查说明放在一起。

成果负责人在同一次调用中汇总并按需制作，制作检查支持其余成员全部独立检查。支持流式 Markdown、本地历史、运行中调整轮数、集中澄清、桌面提醒和中英文／浅深色界面。

自动化和界面验收使用隔离夹具，真实提供者覆盖单独记录。文件读取、生成、渲染及搜索取决于 Agent 环境，详见验证记录。

## A short project introduction / 可直接使用的项目介绍

### English

Already using more than one coding agent? Qwork gives them a shared task and a place to work together.

Start with a brief and your materials. Choose a roundtable, a relay, independent analysis, or a creator with reviewers. Follow each member’s role, answer critical questions, and open the final files alongside their review notes.

Built for Windows with Vue 3, TypeScript and Electron. Bring your configured CLIs; model and file capabilities come from their existing environments. Try the source launcher and share a task you would like your agents to finish together.

### 中文

你已经在用好几个 Agent，却还在手动转发回答、整理意见、催它们修改？

Qwork 把这些协作放进一个 Windows 桌面工作台。给团队一个目标和一批资料，选择圆桌讨论、接力讨论、独立分析或制作检查。谁在主持、谁在制作、谁在检查，都能直接看到；关键问题集中问你，成果文件和检查说明留在一起。

沿用已配置的本机 CLI，支持六种 Agent、中英文和浅深色界面。文件能力来自 Agent 与本机工具。欢迎从源码启动，带一个真实任务来试试。

## Publish with accurate assets / 发布素材

- Lead with the delivery screenshot, then show mode selection and clarification. / 首屏展示文件与检查结果，再展示模式选择和澄清交互。
- English README: only use `docs/screenshots/en-*.png`, captured after switching the app to English.
- 中文 README：使用 `docs/screenshots/zh-*.png`。
- Screenshots use simulated agents and are labeled as UI demonstrations. / 截图为模拟 Agent 的真实界面演示，保留说明。
- Rebuild installers from the current source and verify them before uploading. Existing older preview packages do not include every current feature. / 发布前重新构建并验收安装包，旧预览包不包含全部新功能。
- Attach the installer, checksums, and optionally a portable ZIP of the entire `release/win-unpacked/` directory. / 发布附件可含安装包、校验和及完整免安装目录 ZIP。
- Add real repository and release URLs only after publication; do not use placeholder download links. / 仓库与发布页创建后再填写真实链接。

Keep source and documentation in Git, binaries in release assets. Preserve [LICENSE](../LICENSE), [NOTICE](../NOTICE) and upstream attribution. This document does not create a repository or publish a release.
