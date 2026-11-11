# Qwork 0.1.3

2026-11-11

本版整理了四种协作模式、六种本机 CLI 接入，以及面向最终交付的桌面体验。

- 纯文字任务完成后自动展开最终回答，从开头阅读；文件任务自动打开已有交付面板。
- 制作检查统一使用“检查轮数”，讨论模式使用“讨论轮数”。文件修订策略由系统内部控制。
- 完善关键问题集中澄清、角色状态、异常成员隔离、文件版本检查和制作重试。
- 对话中的文件链接可打开对应成果，展开历史回答定位开头。
- 支持中英文和浅深色主题，附实际切换语言拍摄的演示截图。

## Windows 使用

安装版：运行 `Qwork-Setup-0.1.3-x64.exe`。

免安装版：解压 `Qwork-0.1.3-win-x64-portable.zip`，保留整个目录，双击 `Qwork.exe`。

源码：解压 `Qwork-source-0.1.3.zip`，安装 Node.js 22.12+ 后双击 `Start-Qwork.bat`。

Agent CLI 需另外安装和配置。安装包未配置数字签名。所有模拟测试与真实提供者能力验证的边界见 [验证记录](validation.md)。

## English

Qwork 0.1.3 brings four collaboration workflows and six local CLI adapters into a Windows desktop workspace. Text tasks open the final answer automatically; file tasks reveal the deliverables panel. Review rounds have clear labels without adding extra production settings.

Includes structured clarification, role visibility, fault isolation, version-bound review, production retry, working artifact links, Chinese/English UI and light/dark appearance.

Install the setup EXE, or extract the complete portable ZIP and launch Qwork.exe. Agent CLIs require separate installation and configuration. The binaries are unsigned. See the validation record for fixture versus live provider coverage.
