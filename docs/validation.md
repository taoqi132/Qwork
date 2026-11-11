# 当前源码验证记录 / Source validation

日期：2026-11-11（Asia/Shanghai）。本文记录当前源码；已有 0.1.2 预览二进制早于近期功能，不能视为最新安装包。

## 已完成的本地验证

- 101 项 Qwork 测试通过：四模式、冻结输入、主持推进、合并汇总与制作、多检查者、错版认可、文件变化、取消与恢复、成员异常、澄清重处理、上下文更新、旧认可失效、通知去重及撤回。
- 最近补充验收：实际调用角色显示、紧凑表头与附件区域、对话文件链接匹配与版本校验、无效链接提示、展开回答定位开头。文件打开测试走校验流程后拦截系统调用，不启动外部 Office 应用。
- Vue/TypeScript 类型检查与 Vite/Electron 主进程、preload 生产构建通过。
- 六种 CLI 的本地进程夹具通过。夹具验证启动、协议结果和取消；不等于六个真实服务商均已联通。
- 迁移凭据／权限回归 34 项通过，10 项因平台条件跳过。
- Electron 隔离界面验收通过：四模式、最新角色设置、多成员制作检查、流式展示入口、附件与成果、改名删除、主题与语言、三个设置菜单、模型 ID 保存、动态轮数、集中澄清及通知导航事件。
- 2026-11-11 重新截取中英文界面。每张截图前校验实际应用语言；分别创建中文、英文演示任务，避免英文 README 混用中文界面或历史内容。

## 截图与通知验证边界

README 图片来自真实 Electron 界面，使用模拟 Agent 和演示文件。英文截图实际切换英文设置后生成，不是图片翻译。它们展示产品界面，不证明真实 PPT 制作、视觉审查或事实核验已经通过。

通知创建、去重、撤回与过期点击由测试覆盖；Electron 验收模拟通知点击的导航事件，不发送测试 Windows 通知。实际系统横幅受 Windows 通知权限及勿扰设置影响。

## 历史真实模型检查（2026-11-10）


| Agent | 本机状态 | 实际模型连接 |
| --- | --- | --- |
| Codex | 已安装，版本 0.167.0，协议兼容，检测到配置 | 只读连接验收超时，未判定通过 |
| Claude Code | 已安装，版本 2.1.241，协议兼容 | 实际返回 QWORK_OK，通过 |
| WorkBuddy | 已安装，版本 2.132.0，协议兼容 | 配置状态未确认，未做模型请求验收 |
| Zcode | 未检测到 | 未验证 |
| OpenClaw | 未检测到 | 未验证；本地夹具与隔离目录回归已测试 |
| Qwen Code | 未检测到 | 未验证 |

因此不声称六种真实提供者、真实多 Agent PPT 制作或版式审查已经全部实测通过。模拟全流程与真实模型连接分开记录。


## 打包与上游回归

历史版本曾完成打包后 ASAR 启动，以及隔离安装、启动、卸载检查。这次文档更新没有重新发布安装包。发布当前源码前，应重新构建并验收二进制，安装包未配置数字签名。

扩展上游测试 `npm run test:upstream` 仍含非目标 CLI、POSIX 信号及生命周期假设，曾出现失败和挂起；未声称全量通过。

## 重跑

```powershell
npm run typecheck
npm test
npm run test:legacy
npm run build
npm run smoke
npm run screenshots
```

`npm run screenshots` 在 `work/docs-capture/` 中生成双语截图；检查后复制到 `docs/screenshots/`。中间日志、夹具数据与构建结果不提交 Git。

## English scope

The current source passes 101 Qwork tests, TypeScript checks, production builds and isolated Electron acceptance. Credential/permission regression: 34 passed, 10 platform skips. Screenshots are actual localized UI with simulated agents. Live provider coverage is historical and incomplete; this does not establish a real multi-agent PPT workflow. Native notification lifecycle and navigation are tested without sending OS test banners. Older installers predate current features and must be rebuilt and verified before distribution.

## 核心复查

本次流程、CLI 与 UI 复查及已修复问题见[核心功能检查记录](core-audit-2026-11-11.md)。

## 0.1.3 发布验收

101 项测试、类型检查、构建、迁移回归和 Electron 隔离验收通过。纯文字任务自动展开最终回答；有文件时展开原交付面板。制作检查的轮数文案已明确，未增加额外修订设置。

打包程序验收：Windows x64 0.1.3 的实际 win-unpacked/Qwork.exe 从 ASAR 启动成功，四模式、六种 CLI 清单与 IPC 正常，使用隔离用户数据，未调用模型。NSIS 安装包已构建，本轮未在当前用户环境执行安装／卸载，以免替换现有安装。
