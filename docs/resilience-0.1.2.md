# Qwork 0.1.2：协作可视化与故障处理

新建群聊的工作目录写入授权默认勾选，创建前仍清楚展示授权范围。讨论和审查继续使用只读权限。关闭授权但仍要求制作文件、人数不足、审查模式人数不正确或轮数无效时，弹框说明需要修改的内容。已有群聊保留原授权选择。

协作页面通过成员节点、动态连线和阶段轨道显示实际进度。节点区分等待返回、正在返回、工具执行、权限处理、完成和异常移出。点击成员打开执行记录侧栏，可筛选轮次，查看角色、阶段、耗时、返回字符数、公开工具事件和错误代码；运行期间也可以手动停止并移出成员。

## 异常检测与处置

- 明确认证错误、网络错误、限流、进程退出或协议失败：收到后停止本次调用，记录原因并移出当前群聊。
- 启动无反馈：默认 90 秒；无新活动：默认 180 秒；有活动但没有实质进展：默认 300 秒。三项可在设置中调整，单次调用总时限仍然有效。持续心跳不会无限延长没有进展的任务。
- 剩余至少两位成员：可继续讨论，失败的只读主持或汇总角色可交给剩余成员；界面明确标记团队缩减，成果认可只属于剩余成员。
- 剩余不足两位：停止群聊，保留阶段成果，补充成员后创建后续任务。
- 制作文件的执行者失败：保留文件并停止制作，不自动更换写入者重复执行，以免产生重复或覆盖。
- 用户取消整个任务：不将健康成员判为故障。应用重启后，未完成调用标为中断，不自动恢复写入。
- 状态保存失败：停止运行；调用开始前的保存失败会回滚新任务，不启动 CLI。记录采用临时文件、同步落盘与原子替换。
- 发出取消后最多等待 2.5 秒确认适配器返回；未确认清理完成时明确记录，并阻止直接重试制作。它不等同于操作系统已确认所有后代进程退出。

执行事件按调用最多保存 100 条，保留启动记录和最近事件；超过后有明确提示。只采集 CLI 已公开的执行事件，不保存内部思维、原始提示词、原始工具参数或 stderr。stderr 只在主进程内部用于已知故障分类，前端展示安全摘要。旧版本没有采集的历史过程无法补回。CLI 没有提供细节时，只能显示收到的活动与超时原因，不推测内部状态。

异常成员会从该群聊后续任务的成员列表移除，原任务保留最初参与者和移出记录。修复原生 CLI 的模型、凭据或连接后，可在群聊设置中重新加入。

## English

New groups visibly enable workspace write authorization by default. Discussion and review remain read-only. Invalid group settings open a corrective dialog.

The collaboration map shows every original participant, live phase, public execution activity and removed members. Click a member for per-round call history, duration, tool events, response counts and fault codes. Active members can also be stopped and removed manually.

Known fatal CLI errors fail fast. Configurable startup, inactivity and no-progress deadlines default to 90, 180 and 300 seconds; the overall call limit still applies. Heartbeats alone cannot reset the progress deadline. Failed members are removed from subsequent group calls. Two or more survivors can continue with an explicit reduced-team notice; fewer than two stop the group. Read-only roles may be reassigned. A failed writer is never automatically replayed by another writer.

Cancellation does not blame healthy members. Restart marks unfinished calls interrupted. Persistence errors stop execution; initial persistence failure rolls back the new task before launching a CLI. Abort cleanup has a bounded wait and records unconfirmed cleanup, which blocks direct production retry.

Traces retain at most 100 public events per call. They exclude private reasoning, raw prompts, raw tool arguments and stderr. Historical events that were never collected cannot be reconstructed. A CLI that emits no detailed events remains subject to the watchdog, without invented explanations.

Validation: 52 Qwork tests, TypeScript checks, production build, 34 legacy credential/permission tests (10 platform skips), and actual Electron UI acceptance with isolated mock agents. The UI suite includes a three-member authentication-failure scenario, automatic removal, surviving-team completion and the failure trace drawer. This does not establish the cause of any earlier real WorkBuddy hang or verify all live providers.
