import type {AgentAttempt,AgentKind,Run} from '../shared/types'

export function latestAttempt(run:Run|undefined,kind:AgentKind){
  return run?.attempts?.filter(a=>a.kind===kind).at(-1)
}

// Use the actual invocation role, including fallbacks, rather than the configured owner.
export function roleStatus(attempt:AgentAttempt|undefined):string{
  switch(attempt?.role){
    case 'moderator':return '正在主持讨论'
    case 'finalizer':return '正在汇总成果'
    case 'producer':return attempt.stage==='discussing'?'正在生成回答':'正在制作文件'
    case 'reviewer':return '正在检查成果'
    default:return '正在参与讨论'
  }
}

export function agentStatus(run:Run|undefined,kind:AgentKind):string{
  const excluded=run?.excludedAgents?.find(a=>a.kind===kind)
  if(excluded)return excluded.category==='manual'?'已移出':'异常已移出'
  if(!run)return '已加入'
  if(run.status==='waiting')return '等待你的决定'
  const attempt=latestAttempt(run,kind)
  if(run.status==='running'&&run.activeAgents?.includes(kind))return roleStatus(attempt)
  if(attempt?.status==='completed')return run.status==='running'&&attempt.round<run.round?'等待本轮安排':'本轮已完成'
  return run.status==='running'?'等待安排':'本次运行已结束'
}

export function activityStatus(attempt:AgentAttempt|undefined):string{
  return attempt?.activity==='tool'?'工具执行中':attempt?.activity==='permission'?'正在处理权限请求':attempt?.activity==='responding'?'正在返回内容':'等待返回'
}
