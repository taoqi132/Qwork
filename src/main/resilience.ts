import {randomUUID} from 'node:crypto'
import type {AgentAttempt,AgentFaultInfo,FaultCategory,InvokeInput,InvokeResult,Runner,RuntimeSignal,WatchdogPolicy} from '../shared/types'

export class AgentFault extends Error implements AgentFaultInfo{
 constructor(readonly code:string,readonly category:FaultCategory,message:string,readonly retryable=false){super(message);this.name='AgentFault'}
}
export class TeamUnavailable extends Error{constructor(message='剩余可用成员不足，已保留阶段成果。请补充成员后继续。'){super(message);this.name='TeamUnavailable'}}
export function classifyFault(error:unknown):AgentFaultInfo{
 if(error instanceof AgentFault)return {code:error.code,category:error.category,message:error.message,retryable:error.retryable}
 const input=error as {code?:string;message?:string;category?:FaultCategory}
 const message=String(input?.message||error||'Agent 执行失败'),code=String(input?.code||'AGENT_PROCESS_FAILED')
 if(/auth|unauthor|credential|api.?key|认证|凭据|登录|401|403/i.test(code+' '+message))return {code,category:'authentication',message,retryable:false}
 if(/429|rate.?limit|限流/i.test(code+' '+message))return {code,category:'rate-limit',message,retryable:true}
 if(/timeout|超时/i.test(code+' '+message))return {code,category:'timeout',message,retryable:true}
 if(/permission|denied|权限|拒绝/i.test(code+' '+message))return {code,category:'permission',message,retryable:false}
 if(/network|ECONN|ENOTFOUND|网络|连接失败/i.test(code+' '+message))return {code,category:'network',message,retryable:true}
 return {code,category:'process',message,retryable:false}
}
export function newAttempt(kind:InvokeInput['kind'],round:number,stage:AgentAttempt['stage'],role:string):AgentAttempt{
 const time=new Date().toISOString()
 return {id:randomUUID(),kind,round:Math.max(1,round),stage,role,status:'running',activity:'waiting',startedAt:time,updatedAt:time,lastActivityAt:time,lastProgressAt:time,responseChars:0,events:[],droppedEvents:0}
}
export function trace(attempt:AgentAttempt,type:AgentAttempt['events'][number]['type'],summary:string,detail?:string,code?:string){
 const at=new Date().toISOString();attempt.updatedAt=at
 attempt.events.push({id:randomUUID(),at,type,summary:summary.slice(0,300),...(detail?{detail:detail.slice(0,1200)}:{}),...(code?{code}:{})})
 if(attempt.events.length>100){attempt.events.splice(1,1);attempt.droppedEvents++}
}

/** Watches an invocation independently of CLI cooperation. No raw prompts/stdout or reasoning are retained. */
export async function monitoredInvoke(runner:Runner,input:InvokeInput,attempt:AgentAttempt,policy:WatchdogPolicy,publish:()=>void,register?:(controller:AbortController)=>void):Promise<InvokeResult>{
 const own=new AbortController();register?.(own)
 let fault:AgentFault|undefined,settled=false,pending=false,replyRecorded=false,lastPublished=0,nativeSettled=false
 let native:Promise<InvokeResult>|undefined
 let rejectAbort:(reason:unknown)=>void=()=>{}
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject})
 function fail(error:AgentFault){if(settled||fault)return;fault=error;own.abort(error);rejectAbort(error)}
 function notify(force=false){
  if(settled)return
  if(!force&&Date.now()-lastPublished<400){pending=true;return}
  pending=false;lastPublished=Date.now()
  try{publish()}catch{fail(new AgentFault('STATE_WRITE_FAILED','storage','运行记录保存失败，已停止执行，避免产生无法追踪的写入。'))}
 }
 function activity(progress=false){
  if(settled)return
  const at=new Date().toISOString();attempt.lastActivityAt=at
  if(progress)attempt.lastProgressAt=at
 }
 const abortFromParent=()=>{own.abort(input.signal.reason);rejectAbort(new Error('任务已停止'))}
 const abortFromOwn=()=>{if(!fault&&!input.signal.aborted&&own.signal.reason instanceof AgentFault){fault=own.signal.reason;rejectAbort(fault)}}
 own.signal.addEventListener('abort',abortFromOwn,{once:true})
 if(input.signal.aborted)abortFromParent();else input.signal.addEventListener('abort',abortFromParent,{once:true})
 trace(attempt,'started','已启动本轮 Agent 调用');notify(true)
 const started=Date.now()
 const timer=setInterval(()=>{
  const now=Date.now()
  if(now-started>=input.timeoutMs)fail(new AgentFault('AGENT_TIMEOUT','timeout','已超过单次调用总时限。',true))
  else if(now-Date.parse(attempt.lastProgressAt)>=policy.executionIdleMs)fail(new AgentFault('AGENT_NO_EXECUTION_TIMEOUT','idle-timeout','超过设定时间未收到工具执行或中间回复，已停止该 Agent。',true))
  else if(pending)notify(true)
 },Math.min(1000,policy.executionIdleMs,input.timeoutMs))
 try{
  native=Promise.resolve().then(()=>{
   if(own.signal.aborted)throw own.signal.reason||new Error('任务已停止')
   return runner({...input,signal:own.signal,onActivity:()=>{activity();input.onActivity?.();notify()},onProgress:text=>{
    if(settled)return
    activity(!!text);attempt.responseChars+=text.length
    if(text)attempt.activity='responding'
    if(text&&!replyRecorded){replyRecorded=true;trace(attempt,'response','开始收到 Agent 回复')}
    input.onProgress(text);notify()
   },onRuntimeEvent:(event:RuntimeSignal)=>{
    if(settled)return
    activity(event.progress===true||['tool_start','tool_update','tool_result_summary'].includes(event.type))
    if(event.type==='tool_start'||event.type==='tool_update')attempt.activity='tool'
    else if(event.type==='permission')attempt.activity='permission'
    else if(event.type==='tool_result_summary'||event.type==='status')attempt.activity='waiting'
    const type=event.type==='failure'?'failure':event.type==='warning'?'warning':event.type==='permission'?'permission':event.type.startsWith('tool')?'tool':'status'
    trace(attempt,type,event.summary,event.detail,event.code);notify(true)
    input.onRuntimeEvent?.(event)
    if(event.fatal)fail(new AgentFault(event.code||'AGENT_RUNTIME_FAILURE',event.category||'process',event.summary))
   }})
  }).finally(()=>{nativeSettled=true})
  const result=await Promise.race([aborted,native])
  if(own.signal.aborted)throw fault||own.signal.reason||new Error('任务已停止')
  attempt.status='completed';trace(attempt,'completed','本轮调用已完成');return result
 }catch(error){
  own.abort(fault||error)
  if(native&&!nativeSettled){
   let timer:ReturnType<typeof setTimeout>|undefined
   try{await Promise.race([native.catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,2500)})])}finally{if(timer)clearTimeout(timer)}
  }
  attempt.cleanup=nativeSettled?'settled':'unconfirmed'
  if(!nativeSettled)trace(attempt,'warning','未能确认原生进程退出，请检查进程后再重新执行写入任务。')
  attempt.status=input.signal.aborted?'cancelled':'failed'
  if(!input.signal.aborted)attempt.fault=classifyFault(fault||error)
  trace(attempt,input.signal.aborted?'status':'failure',input.signal.aborted?'本轮调用已取消':attempt.fault!.message,undefined,attempt.fault?.code)
  throw fault||error
 }finally{
  settled=true;clearInterval(timer);input.signal.removeEventListener('abort',abortFromParent);own.signal.removeEventListener('abort',abortFromOwn)
  attempt.finishedAt=new Date().toISOString();attempt.updatedAt=attempt.finishedAt
  try{publish()}catch{throw new AgentFault('STATE_WRITE_FAILED','storage','运行记录保存失败，已停止执行，避免产生无法追踪的写入。')}
 }
}
