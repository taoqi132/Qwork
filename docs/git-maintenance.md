# 本地 Git 与手动发布

此目录为独立 Qwork Git 仓库，分支为 main。源码、测试、文档、截图和来源声明纳入版本控制；依赖、运行记录、构建目录、安装包与本机配置均忽略。

## 第一次推送

在 GitHub 创建空仓库，不要预先添加 README、License 或 .gitignore。然后在本目录运行下面命令，将 YOUR_REPOSITORY_URL 替换为你创建的真实仓库地址：

```powershell
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
git push origin v0.1.3
```

## 后续维护

```powershell
git status
npm run check
npm run smoke
git add src test docs README.md README.zh-CN.md
git diff --cached
git commit -m "Describe the change"
git push
```

按实际修改选择文件，版本升级时同时更新 package.json 与 package-lock.json。发布二进制放 GitHub Releases 附件，不提交 Git；仓库 About 和介绍可使用 [GitHub 展示文案](github-presentation.md)。

`git archive` 源码包只包含已提交文件。模型连接测试会实际请求提供者；自动化 smoke 使用隔离模拟环境。
