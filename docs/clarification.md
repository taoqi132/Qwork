# 需求澄清与桌面提醒

只有会实质改变目标、范围、正确性或交付形式的缺失信息才需要用户决定。普通偏好采用合理默认值并简短说明。Agent 通过 `needs-human` 回执报告关键问题，可附选项；没有结构化问题的旧回执仍可使用 summary 提问。应用不通过正文中是否有问号来猜测暂停。

同批调用结束后集中展示问题，按规范化文本合并重复问题、保留提问成员和可选答案，不另调用模型合并语义相近的问题。用户可选建议答案或填写每个问题。局部问题只重新调用相关成员；影响受众、目标等全局条件的问题默认使相关旧分析失效。全局要求变化后，会刷新相关分析；检查阶段出现问题则重新核对所有检查者的意见，旧认可不会直接复用。独立分析重新处理时保留原始冻结输入，并附用户补充，不暴露同批成员回答。澄清不额外增加显示的讨论轮数。

写入调用请求澄清时，已有阶段文件保留并展示。按钮明确标为“提交补充并继续制作”，必须由用户明确提交后才能继续。模型被要求先检查已有成果，避免重放操作；模型是否始终正确执行这一要求仍取决于原生 CLI。全局要求变化且已有团队分析时，先重新分析再继续制作；发生进程故障或未确认退出时，原有禁止自动重试写入的规则仍有效。

每次调用最多两批补充，同一任务最多三批；持续缺少关键信息时以阶段成果结束，不把健康 Agent 移出群聊。每次提交绑定当前问题 ID，旧弹窗回答不能误用到后续问题。取消与重启不自动恢复写入。补充答案作为用户决定保存，后续提示完整携带。

需要决定时创建一次 Windows 通知，并在后台闪烁任务栏；通知不包含问题原文或文件路径。点击通知会恢复、聚焦 Qwork 并打开对应任务的当前弹窗。问题解决后撤回旧通知，旧通知不再导航。系统通知不可用不影响应用内弹窗；实际横幅显示受 Windows 通知权限及勿扰设置影响。

验证包含工作流重处理、全局上下文更新、旧检查认可失效、写入前等待明确提交、取消、重复提问上限及通知去重/撤回。Electron 冒烟使用模拟 Agent 验证问题合并、选项填写及通知导航事件；不发送测试系统通知，也不声称真实六 CLI 的原生提问工具均已经端到端验证。

## English

Critical missing requirements trigger structured clarification; optional preferences use stated defaults. Batch questions are collected and deduplicated by normalized text. Local questions rerun the relevant agents. Task-wide answers invalidate affected analyses, while review clarifications refresh every reviewer’s approval. Independent analyses retain their original frozen input without leaking peer replies. User answers are persisted and included in subsequent prompts.

Writing resumes only after the user explicitly submits the clarification with a creation-specific button. Existing drafts are preserved and inspected before continuing; native tool behavior still governs actual side effects. Clarification is bounded, stale gate IDs are rejected, and failed writers are not automatically replayed.

Each pending gate creates one native Windows notification without sensitive question content. Clicking restores the app and opens the correct task. Resolved notifications are withdrawn. OS notification errors do not affect in-app decisions. Windows notification permissions and Do Not Disturb control banner visibility. Tests use isolated mock agents and mocked native notification lifecycle events.
