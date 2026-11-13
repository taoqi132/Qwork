export const AGENT_KINDS = ['codex', 'claude', 'workbuddy', 'zcode', 'openclaw', 'qwen'] as const
export type AgentKind = typeof AGENT_KINDS[number]
export const LABELS: Record<AgentKind, string> = {codex:'Codex',claude:'Claude Code',workbuddy:'WorkBuddy',zcode:'Zcode',openclaw:'OpenClaw',qwen:'Qwen Code'}
export type MemberId = string
export interface AgentMember {id:MemberId;kind:AgentKind;model?:string}
export type Mode = 'review' | 'parallel' | 'sequential' | 'auto'
export type RunStatus = 'running' | 'waiting' | 'completed' | 'partial' | 'failed' | 'cancelled' | 'interrupted'
export type Stage = 'preparing' | 'discussing' | 'summarizing' | 'producing' | 'checking' | 'finished'
export interface CliInstallOption {kind:AgentKind;packageName:string;version:string;command:string;supported:boolean;reason:string}
export interface CliInstallState {error?:string;taskId:string;kind:AgentKind|'';phase:'idle'|'checking'|'downloading'|'installing'|'verifying'|'completed'|'cancelled'|'failed';canCancel:boolean;errorCode:string}
export interface AgentInfo {kind:AgentKind; label:string; installed:boolean; compatible:boolean; version:string; credential:'ready'|'missing'|'unknown'; source:string; error?:string; testedAt?:string}
export interface Settings {agentModels?:Partial<Record<AgentKind,string>>;allowWeb?:boolean;themePreference?:'system'|'light'|'dark';defaultDirectory:string; maxRounds:number; locale:'zh'|'en'; timeoutMinutes:number; workBuddyModelId?:string;languagePreference?:'system'|'zh'|'en';noExecutionTimeoutMinutes?:number}
export type FaultCategory='authentication'|'network'|'rate-limit'|'permission'|'startup-timeout'|'idle-timeout'|'progress-timeout'|'timeout'|'process'|'protocol'|'manual'|'storage'
export interface AgentFaultInfo {code:string;category:FaultCategory;message:string;retryable:boolean}
export interface ExcludedAgent {memberId:MemberId;kind:AgentKind;reason:string;code:string;category:FaultCategory;at:string;runId:string}
export interface TraceEvent {id:string;at:string;type:'started'|'response'|'tool'|'permission'|'status'|'warning'|'failure'|'completed'|'removed';summary:string;detail?:string;code?:string}
export interface AgentAttempt {contextRevision?:number;inputSummary?:string;outputMessageId?:string;id:string;memberId:MemberId;kind:AgentKind;modelId?:string;round:number;stage:Stage;role:string;status:'running'|'completed'|'failed'|'cancelled'|'interrupted';startedAt:string;updatedAt:string;lastActivityAt:string;lastProgressAt:string;finishedAt?:string;responseChars:number;events:TraceEvent[];fault?:AgentFaultInfo;droppedEvents:number;cleanup?:'settled'|'unconfirmed';activity?:'waiting'|'responding'|'tool'|'permission'}
export interface RuntimeSignal {type:'status'|'tool_start'|'tool_update'|'tool_result_summary'|'warning'|'permission'|'failure';summary:string;detail?:string;code?:string;category?:FaultCategory;fatal?:boolean;progress?:boolean}
export interface WatchdogPolicy {executionIdleMs:number}
export interface WorkBuddySettings {modelId:string;models:{id:string;name:string}[]}
export interface Group {id:string; name:string; goal:string; kind:'group'|'direct'; agents:AgentMember[]; workdir:string; allowWrite:boolean; mode:Mode; maxRounds:number; moderator:MemberId; summarizer:MemberId; executor:MemberId; executeAfter:boolean; recommended:boolean; createdAt:string; updatedAt:string;excludedAgents?:ExcludedAgent[]}
export interface Attachment {id:string; groupId:string; name:string; size:number; relativePath:string; sha256:string; importedAt:string}
export interface Artifact {id:string; runId:string; name:string; relativePath:string; size:number; sha256:string; checked:boolean}
export interface Message {contextRevision?:number;id:string; groupId:string; runId:string; role:'user'|'agent'|'system'; agent?:AgentKind; memberId?:MemberId; stage:Stage; round:number; text:string; summary:string; createdAt:string; error?:boolean;collaborationRole?:string}
export interface Gate {id:string; runId:string; message:string; kind:'decision'|'stalled'|'partial'|'clarification';options?:string[];questions?:{scope?:'task'|'agent';question:string;options?:string[];agents:AgentKind[];memberIds?:MemberId[]}[];resumeWrite?:boolean}
export interface Run {pendingSupplements?:string[];recoveryContext?:string;contextRevision?:number;clarificationBatches?:number;modelOverrides?:Partial<Record<MemberId,string>>;allowWeb?:boolean;delivery?:'text'|'files';id:string; groupId:string; mode:Mode; status:RunStatus; stage:Stage; round:number; maxRounds:number; task:string; attachmentIds:string[]; participants:AgentMember[]; startedAt:string; finishedAt?:string; summary:string; issues:string[]; currentAgent?:AgentKind;currentMemberId?:MemberId; version?:string; gate?:Gate; error?:string; verification:string; settings:Group; outputRelative:string;activeAgents?:AgentKind[];activeMemberIds?:MemberId[];lastStage?:Stage;locale?:'zh'|'en';attempts?:AgentAttempt[];excludedAgents?:ExcludedAgent[];degraded?:boolean;watchdog?:WatchdogPolicy;callTimeoutMs?:number}
export interface State {version:2; settings:Settings; groups:Group[]; attachments:Attachment[]; messages:Message[]; runs:Run[]; artifacts:Artifact[]}
export interface AgentDetectionState {status:'searching'|'ready'|'failed'}
export interface Snapshot extends State {cliInstall?:CliInstallState;agents:AgentInfo[];agentDetection?:AgentDetectionState}
export interface Receipt {executionIssue?:'permission'|'file-access'|'tool-unavailable'|'network';questions?:{scope?:'task'|'agent';question:string;options?:string[]}[];summary:string; status:'continue'|'ready'|'approve'|'needs-human'; issues:string[]; nextAgents:AgentKind[]; reviewedVersion?:string; verification?:string}
export interface InvokeInput {readPaths?:string[];modelId?:string;allowWeb?:boolean;kind:AgentKind; prompt:string; workdir:string; allowWrite:boolean; signal:AbortSignal; timeoutMs:number; onProgress:(text:string)=>void;onActivity?:()=>void;onRuntimeEvent?:(event:RuntimeSignal)=>void}
export interface InvokeResult {text:string}
export type Runner = (input:InvokeInput)=>Promise<InvokeResult>
export interface ProgressEvent {round?:number;attemptId?:string;runId:string; agent:AgentKind; memberId?:MemberId; stage:Stage; text:string;reset?:boolean}
export interface SendInput {groupId:string; text:string; attachmentIds:string[]; mode:Mode}
export type GroupInput = {name:string;goal:string;kind:'group'|'direct';agents:(AgentKind|AgentMember)[];workdir:string;allowWrite:boolean;mode:Mode;maxRounds:number;moderator:MemberId;summarizer:MemberId;executor:MemberId;executeAfter:boolean;recommended:boolean}
export interface ApiResult<T> {ok:boolean; data?:T; error?:string}
export interface DesktopApi {
  supplement(runId:string,text:string):Promise<void>;
  setGroupRounds(groupId:string,maxRounds:number):Promise<void>;
  adjustRounds(runId:string,maxRounds:number):Promise<void>;
  removeAgent(runId:string,memberId:MemberId):Promise<void>;
  workBuddySettings():Promise<WorkBuddySettings>; setWorkBuddyModel(modelId:string):Promise<WorkBuddySettings>;
  get():Promise<Snapshot>; refresh():Promise<Snapshot>; settings(input:Settings):Promise<Snapshot>;
  pickDirectory():Promise<string|null>; createGroup(input:GroupInput):Promise<Group>;
  updateGroup(id:string,input:GroupInput):Promise<Group>; renameGroup(id:string,name:string):Promise<void>;
  deleteGroup(id:string):Promise<void>; pickAttachments(groupId:string):Promise<Attachment[]>;
  importFiles(groupId:string,files:File[]):Promise<Attachment[]>; pasteAttachments(groupId:string):Promise<Attachment[]>;
  discardAttachment(id:string):Promise<void>; send(input:SendInput):Promise<Run>; stop(runId:string):Promise<void>;
  decide(runId:string,response:string,gateId?:string):Promise<void>; openArtifact(id:string):Promise<void>;
  retryExecution(runId:string):Promise<Run>;
  openOutput(runId:string):Promise<void>; exportReport(runId:string):Promise<void>; diagnostics():Promise<void>;
  cliInstallOptions():Promise<CliInstallOption[]>; installCli(kind:AgentKind):Promise<CliInstallState>; cancelCliInstall(taskId:string):Promise<boolean>; openInstallHelp(kind:AgentKind|'node'):Promise<void>;
  testAgent(kind:AgentKind):Promise<string>;
  onAttention(fn:(runId:string)=>void):()=>void;
  onChanged(fn:(snapshot:Snapshot)=>void):()=>void; onProgress(fn:(event:ProgressEvent)=>void):()=>void;
}
