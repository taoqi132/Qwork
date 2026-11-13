import type {AgentAttempt,Group,MemberId,Run} from '../shared/types'
import {attemptMemberId,excludedMemberId} from '../shared/agent-members'

export function latestAttempt(run:Run|undefined,memberId:MemberId){
  return run?.attempts?.filter(a=>attemptMemberId(a)===memberId).at(-1)
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

export function agentStatus(run:Run|undefined,memberId:MemberId):string{
  const excluded=run?.excludedAgents?.find(a=>excludedMemberId(a)===memberId)
  if(excluded)return excluded.category==='manual'?'已移出':'异常已移出'
  if(!run)return '已加入'
  if(run.status==='waiting')return '等待你的决定'
  const attempt=latestAttempt(run,memberId),member=run.participants.find(candidate=>candidate.id===memberId)
  const active=run.activeMemberIds?.length?run.activeMemberIds.includes(memberId):!!member&&!!run.activeAgents?.includes(member.kind)
  if(run.status==='running'&&active)return roleStatus(attempt)
  if(attempt?.status==='completed')return run.status==='running'&&attempt.round<run.round?'等待本轮安排':'本轮已完成'
  return run.status==='running'?'等待安排':'本次运行已结束'
}

export function activityStatus(attempt:AgentAttempt|undefined):string{
  return attempt?.activity==='tool'?'工具执行中':attempt?.activity==='permission'?'正在处理权限请求':attempt?.activity==='responding'?'正在输出':'等待响应'
}

export const roleLabels:Record<string,string>={contributor:'讨论成员',moderator:'讨论主持人',finalizer:'成果负责人',producer:'制作者',reviewer:'检查者'}
export function agentRoles(group:Group,run:Run|undefined,memberId:MemberId){
 const g=run?.settings||group,mode=run?.mode||g.mode,roles:string[]=[]
 const members=run?.participants||g.agents
 if(!members.some(member=>member.id===memberId))return roles
 if(mode==='review'){roles.push(memberId===g.executor?'producer':'reviewer')}
 else{
  roles.push('contributor')
  if(mode!=='parallel'&&memberId===g.moderator)roles.push('moderator')
  if(memberId===g.executor)roles.push(g.executeAfter?'producer':'finalizer')
  const candidates=members.filter(member=>member.id!==g.executor&&!run?.excludedAgents?.some(excluded=>excludedMemberId(excluded)===member.id))
  const checker=mode!=='parallel'?(candidates.find(member=>member.id===g.moderator)||candidates[0]):candidates[0]
  if(g.executeAfter&&checker?.id===memberId)roles.push('reviewer')
 }
 const actual=latestAttempt(run,memberId)?.role
 if(actual&&!roles.includes(actual)&&roleLabels[actual])roles.push(actual)
 return roles
}
export function responseActivity(attempt:AgentAttempt|undefined){
 if(attempt?.activity==='responding')return '正在输出'
 if(attempt?.activity==='tool')return '工具执行中'
 if(attempt?.activity==='permission')return '等待授权'
 return attempt?.events?.some(e=>e.type==='status'&&e.summary!=='已启动本轮 Agent 调用')?'处理中':'等待响应'
}