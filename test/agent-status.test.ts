import {describe,it,expect} from 'vitest'
import type {AgentAttempt,Run} from '../src/shared/types'
import {agentStatus,activityStatus} from '../src/renderer/agent-status'

const attempt=(role:string,status='running')=>({kind:'claude',role,status,stage:'discussing',activity:'tool'} as AgentAttempt)
const run=(attempts:AgentAttempt[],extra:Partial<Run>={})=>({status:'running',activeAgents:['claude'],attempts,...extra} as Run)
describe('current collaboration role',()=>{
  it('changes from contributor to moderator within the same discussion stage',()=>{
    expect(agentStatus(run([attempt('contributor')]),'claude')).toBe('正在参与讨论')
    const current=run([attempt('contributor','completed'),attempt('moderator')])
    expect(agentStatus(current,'claude')).toBe('正在主持讨论')
    expect(activityStatus(current.attempts!.at(-1))).toBe('工具执行中')
  })
  it('distinguishes text production, files, synthesis and independent review',()=>{
    expect(agentStatus(run([attempt('producer')]),'claude')).toBe('正在生成回答')
    expect(agentStatus(run([{...attempt('producer'),stage:'producing'}]),'claude')).toBe('正在制作文件')
    expect(agentStatus(run([attempt('finalizer')]),'claude')).toBe('正在汇总成果')
    expect(agentStatus(run([attempt('reviewer')]),'claude')).toBe('正在检查成果')
  })
  it('does not show an active role after waiting, completion or exclusion',()=>{
    expect(agentStatus(run([attempt('moderator')],{status:'waiting'}),'claude')).toBe('等待你的决定')
    expect(agentStatus(run([attempt('moderator','completed')],{status:'completed'}),'claude')).toBe('本轮已完成')
    expect(agentStatus(run([attempt('moderator')],{excludedAgents:[{kind:'claude',category:'manual'} as any]}),'claude')).toBe('已移出')
  })
})

it('does not mark a previous-round contribution as completed in the current round',()=>{
 expect(agentStatus(run([{...attempt('contributor','completed'),round:1}],{round:2,activeAgents:['codex']}),'claude')).toBe('等待本轮安排')
})
