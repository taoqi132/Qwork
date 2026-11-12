import {AgentDetection} from './agent-detection'
import path from 'node:path'
import { createRequire } from 'node:module'
import { AGENT_KINDS, LABELS, type AgentInfo, type AgentKind, type Runner } from '../shared/types'
import {publicRuntimeSignal,diagnosticFailure} from './runtime-signals'
// Kept as separately attributed compatibility modules; new orchestration is TypeScript.
const requireLegacy=createRequire(path.join(__dirname,'../../package.json'))
const cli=requireLegacy('./legacy/src/agents/cli/cli-adapters.cjs')
const readiness=requireLegacy('./legacy/src/agents/local-agent-readiness.cjs')
const {nativeOpenClawOptions}=requireLegacy('./legacy/src/agents/cli/openclaw-runtime.cjs')
const {workBuddyEnvironment,workBuddySettings}=requireLegacy('./legacy/src/agents/cli/workbuddy-runtime.cjs')
const {networkEnvironment}=requireLegacy('./legacy/src/agents/cli/cli-network-environment.cjs')
const {redactSecrets}=requireLegacy('./legacy/src/security/secret-redaction.cjs')
const {automaticPermissionResponse}=requireLegacy('./legacy/src/agents/agent-permission-policy.cjs')
export const redact=(text:unknown):string=>redactSecrets(String(text||''))
export class AgentService {
  private detected=new Map<AgentKind,any>()
  private infos:AgentInfo[]=AGENT_KINDS.map(kind=>({kind,label:LABELS[kind],installed:false,compatible:false,version:'',credential:'unknown',source:'未检测'}))
  readonly detection:AgentDetection
  constructor(private storageRoot:string,private getWorkBuddyModelId:()=>string=()=> '',private getAllowWeb:()=>boolean=()=>true,private getModels:()=>Partial<Record<AgentKind,string>>=()=>({}),changed:()=>void=()=>{}){this.detection=new AgentDetection(changed)}
  workBuddySettings(){return workBuddySettings({env:process.env,modelId:this.getWorkBuddyModelId()})}
  get catalog(){return structuredClone(this.infos)}
  recordConnection(kind:AgentKind,passed:boolean,error=''){
    const info=this.infos.find(a=>a.kind===kind)
    if(info){info.testedAt=new Date().toISOString();info.error=passed?undefined:error;if(passed){info.credential='ready';info.source='connection-test'}}
  }
  async refresh():Promise<AgentInfo[]>{
    return this.detection.run(()=>this.detect())
  }
  private async detect(){
    const found=await cli.detectAgents({kinds:AGENT_KINDS})
    this.detected=new Map(found.filter((a:any)=>AGENT_KINDS.includes(a.kind)).map((a:any)=>[a.kind,a]))
    this.infos=await Promise.all(AGENT_KINDS.map(async kind=>{
      const a=this.detected.get(kind)
      if(!a)return {kind,label:LABELS[kind],installed:false,compatible:false,version:'',credential:'unknown' as const,source:'未找到 CLI'}
      let credential:any
      try{credential=await readiness.resolveNativeCredentialState(kind,{executable:a.executable,env:process.env,...(kind==='workbuddy'?{modelId:this.getWorkBuddyModelId()}:{})})}catch{credential={state:'unknown',source:'检测未完成'}}
      return {kind,label:LABELS[kind],installed:true,compatible:a.compatibilityState==='compatible',version:a.version||'',credential:credential.state||'unknown',source:credential.source||'未验证'}
    }))
    return this.catalog
  }
  runner:Runner=async input=>{
    const allowWeb=input.allowWeb??this.getAllowWeb()
    const modelId=input.modelId??this.getModels()[input.kind]??''
    const workBuddyModelId=input.kind==='workbuddy'?(input.modelId??this.getWorkBuddyModelId()):''
    const a=this.detected.get(input.kind)
    if(!a)throw new Error(`${LABELS[input.kind]} 未安装，请在设置中重新检测`)
    if(a.compatibilityState!=='compatible')throw new Error(`${LABELS[input.kind]} CLI 版本或协议不兼容`)
    const controller=new AbortController()
    let timedOut=false
    let runtimeFailure:ReturnType<typeof diagnosticFailure>=null
    const abort=()=>controller.abort()
    if(input.signal.aborted)abort();else input.signal.addEventListener('abort',abort,{once:true})
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},input.timeoutMs)
    try{
      let injected:any={}
      if(input.kind==='openclaw'){
        const runtime=await readiness.resolveNativeOpenClawRuntime({executable:a.executable,env:process.env})
        injected=nativeOpenClawOptions({storageRoot:this.storageRoot,workdir:input.workdir,allowWrite:input.allowWrite,allowWeb,runtime,openclawVersion:a.version})
      }
      const credentials=input.kind==='openclaw'?{}:readiness.nativeCredentialEnvironment(input.kind,process.env)
      const buddy=input.kind==='workbuddy'?workBuddyEnvironment({env:process.env,modelId:workBuddyModelId}):{}
      const result=await cli.runAgent(a,input.prompt,input.workdir,{
        model:input.kind==='workbuddy'?workBuddyModelId:modelId,allowWeb,sandbox:input.allowWrite?'workspace-write':'read-only',signal:controller.signal,maxTurns:0,...injected,
        env:{...networkEnvironment(process.env),...credentials,...buddy,...injected.env},
        onActivity:()=>input.onActivity?.(),
        onProgress:()=>input.onActivity?.(),
        onEvent:(event:any)=>{
          if(['reasoning_summary','plan'].includes(event.type))input.onRuntimeEvent?.({type:'status',summary:'已收到中间执行反馈',progress:true})
          if(event.type==='answer_delta')input.onProgress(String(event.text||event.delta||''))
          const signal=publicRuntimeSignal(event,redact)
          if(signal)input.onRuntimeEvent?.(signal)
        },
        onDiagnostic:(detail:string)=>{
          const failure=diagnosticFailure(detail)
          if(failure&&!runtimeFailure){runtimeFailure=failure;input.onRuntimeEvent?.(failure);controller.abort()}
        },
        onPermissionRequest:(request:any)=>{
          input.onRuntimeEvent?.({type:'permission',summary:'CLI 请求工具权限，正在按当前授权范围处理。',progress:true})
          const decision=automaticPermissionResponse(request,{allowWrite:input.allowWrite})
          input.onRuntimeEvent?.({type:'status',summary:'权限请求已按当前授权策略处理。',progress:true})
          return decision
        }
      })
      if(controller.signal.aborted)throw new Error(timedOut?'Agent 执行超时':'任务已停止')
      return {text:redact(result.text)}
    }catch(error:any){
      const reportedFailure=runtimeFailure as ReturnType<typeof diagnosticFailure>
      const code=String(reportedFailure?.code||error.code||error.message||error)
      const labels:Record<string,string>={LOCAL_AGENT_AUTH_REQUIRED:'Agent 需要登录，请在原生 CLI 中完成登录后重试',LOCAL_AGENT_PROCESS_FAILED:'Agent 运行失败，请检查原生 CLI 的模型连接与配置',LOCAL_AGENT_SPAWN_FAILED:'无法启动 Agent 进程，请检查 CLI 安装',LOCAL_AGENT_EMPTY_RESPONSE:'Agent 未返回有效回答',LOCAL_AGENT_EXECUTION_STOPPED:'任务已停止',LOCAL_AGENT_OUTCOME_NON_TERMINAL:'Agent 未完成本次执行，请检查工具权限与运行限制'}
      let message=reportedFailure?.summary||labels[code]||redact(code)
      if(input.kind==='workbuddy'&&['LOCAL_AGENT_AUTH_REQUIRED','LOCAL_WORKBUDDY_PROVIDER_AUTH','AGENT_AUTH_FAILURE'].includes(code))message=workBuddyModelId?`WorkBuddy 自定义模型“${workBuddyModelId}”认证失败，请在 WorkBuddy 中检查该模型的 API 凭据与服务配置；这不一定是客户端未登录。`:'WorkBuddy 当前使用 CLI 默认模型，但认证未通过。若你使用桌面端的自定义模型，请先在此卡片中选择并保存，再测试连接。'
      if(code==='LOCAL_WORKBUDDY_MODEL_UNAVAILABLE')message='所选 WorkBuddy 模型已不可用，请刷新模型列表并重新选择。'
      const safe=new Error(timedOut?`${LABELS[input.kind]} 执行超时`:message)
      Object.defineProperty(safe,'code',{value:code,enumerable:false})
      Object.defineProperty(safe,'diagnostic',{value:redact(error.diagnostic||''),enumerable:false})
      throw safe
    }
    finally{clearTimeout(timer);input.signal.removeEventListener('abort',abort)}
  }
  async shutdown(){await cli.shutdownAcpSessionRuntime()}
}
