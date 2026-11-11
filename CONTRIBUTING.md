# Contributing / 参与贡献

[English README](README.md) · [中文说明](README.zh-CN.md)

## Start locally / 本地开发

Use Node.js 22.12+ and npm. Run `npm ci` and `npm run dev`, or open `Start-Qwork.bat`. See [architecture](docs/architecture.md) before changing runtime boundaries.

使用 Node.js 22.12+ 与 npm，运行 `npm ci`、`npm run dev`，或双击根目录 BAT。修改执行边界前请先阅读[架构说明](docs/architecture.md)。

## Scope / 贡献方向

- Reproducible Windows CLI compatibility fixes / 可复现的 Windows CLI 兼容修复。
- Clearer deliverables, review states and recovery / 成果展示、检查状态与失败恢复。
- Capability verification for real agent environments / 真实 Agent 环境的能力验证。
- Accessibility and language support / 无障碍与多语言体验。

Keep attachment handling to copies, paths and fingerprints. Do not add document parsing, plaintext credentials, arbitrary renderer shell access or automatic replay of unknown write operations.

附件仅管理副本、路径和哈希。不要引入正文解析、明文凭据、渲染器任意 shell 接口，或自动重放结果未知的写操作。

## Before opening a PR / 提交前

```powershell
npm run typecheck
npm test
npm run test:legacy
npm run build
npm run smoke
```

Report what you ran and what remains unverified. UI smoke tests use a fixture provider; real model acceptance must be labeled separately. The extended `test:upstream` suite has known unresolved Windows/platform cases.

说明运行过的检查及未验证范围。界面冒烟使用夹具，真实模型验收必须单独标注。扩展 `test:upstream` 仍有已知 Windows/平台用例未解决。

Preserve Apache-2.0 notices and mark modifications to legacy files. Never submit credentials, native CLI configuration, personal documents, node_modules, release binaries or work/ data. A contribution is offered under the repository's Apache-2.0 license.

保留 Apache-2.0 声明，并标记 legacy 文件修改。不提交凭据、原生 CLI 配置、私人文件、依赖、发布二进制和 work/ 数据。贡献采用仓库的 Apache-2.0 许可。
