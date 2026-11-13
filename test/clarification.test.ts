import {expect,test,vi} from 'vitest'
import {collectQuestions} from '../src/main/clarification'
import {DecisionNotifications} from '../src/main/decision-notifications'
test('same questions are merged without losing agents or available choices',()=>{
 const receipt={summary:'audience',status:'needs-human' as const,issues:[],nextAgents:[],questions:[{question:'受众是谁？',options:['管理层']}]}
 const result=collectQuestions([{agent:'codex',receipt},{agent:'claude',receipt:{...receipt,questions:[{question:'受众 是谁?',options:['技术团队']}]}}])
 expect(result).toHaveLength(1);expect(result[0].agents).toEqual(['codex','claude']);expect(result[0].memberIds).toEqual([]);expect(result[0].options).toEqual(['管理层','技术团队'])
})
test('same-kind instances stay separate question sources while kinds are deduplicated',()=>{
 const receipt={summary:'audience',status:'needs-human' as const,issues:[],nextAgents:[],questions:[{question:'受众是谁？'}]}
 const result=collectQuestions([{agent:'codex',memberId:'codex',receipt},{agent:'codex',memberId:'codex-2',receipt}])
 expect(result).toHaveLength(1);expect(result[0].agents).toEqual(['codex']);expect(result[0].memberIds).toEqual(['codex','codex-2'])
})
test('native notifications are deduplicated, withdrawn, and cannot activate stale gates',()=>{
 let click=()=>{};const toast={on:vi.fn((_event:string,fn:()=>void)=>{click=fn}),show:vi.fn(),close:vi.fn()}
 const create=vi.fn(()=>toast),activate=vi.fn(),notifier=new DecisionNotifications(create,activate)
 notifier.sync([{id:'gate',runId:'run'}]);notifier.sync([{id:'gate',runId:'run'}])
 expect(create).toHaveBeenCalledTimes(1);click();expect(activate).toHaveBeenCalledWith('run')
 notifier.sync([]);expect(toast.close).toHaveBeenCalledTimes(1);activate.mockClear();click();expect(activate).not.toHaveBeenCalled()
})
test('a native notification failure does not fail the task or spam retries',()=>{
 const create=vi.fn(()=>{throw new Error('notification unavailable')});const notifier=new DecisionNotifications(create,()=>{})
 expect(()=>{notifier.sync([{id:'gate',runId:'run'}]);notifier.sync([{id:'gate',runId:'run'}])}).not.toThrow()
 expect(create).toHaveBeenCalledTimes(1)
})
