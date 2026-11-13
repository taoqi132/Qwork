import type {Receipt} from '../shared/types'
import {AgentFault} from './resilience'

export function executionBlocker(receipt:Receipt|null):AgentFault|undefined{
  if(!receipt)return
  const text=[receipt.summary,...receipt.issues,...(receipt.questions||[]).map(q=>q.question)].join('\n')
  if(!receipt.executionIssue&&/(?:未提供|未上传|尚未上传|没有提供|未附|missing attachment|no attachment)/i.test(text))return
  const denied=/(?:工具|读取|文件访问|权限|环境|Read|Bash|PowerShell|tool|file access).{0,45}(?:被拒绝|权限拒绝|拒绝访问|被拦截|无法读取|读取失败|权限不足|不可用|缺失|denied|blocked|unavailable)|(?:无法读取|读取失败).{0,35}(?:本地|附件|文件)|(?:permission|access) (?:denied|blocked)/i.test(text)
  if(receipt.executionIssue||receipt.status==='needs-human'&&(denied||/(?:当前环境|读取工具|文件工具|CLI).{0,45}(?:权限策略拦截|权限受限|无法访问|全部被拒绝)/i.test(text))){
    const issue=receipt.executionIssue||'permission'
    return new AgentFault('AGENT_EXECUTION_BLOCKED',issue==='network'?'network':'permission','该 Agent 报告文件访问或执行工具受阻；保留成员并记录能力限制。',true)
  }
}
