import {expect,test} from 'vitest'
import type {Message,ProgressEvent,Run} from '../src/shared/types'
import {roundResponses} from '../src/renderer/round-responses'
test('keeps completed peers, orders tabs by participants and binds streams to attempts',()=>{
 const run={id:'run',round:1,status:'running',participants:[{id:'codex',kind:'codex'},{id:'claude',kind:'claude'}],attempts:[{id:'a',memberId:'codex',kind:'codex',round:1,status:'running',stage:'discussing'},{id:'b',memberId:'claude',kind:'claude',round:1,status:'completed',stage:'discussing',outputMessageId:'reply'}]} as Run
 const messages=[{id:'reply',runId:'run',memberId:'claude',agent:'claude',round:1,role:'agent',text:'completed analysis'}] as Message[]
 const progress={'runcodex':{runId:'run',round:1,agent:'codex',stage:'discussing',attemptId:'a',text:'live text'}} as Record<string,ProgressEvent>
 expect(roundResponses(run,messages,progress).map(r=>[r.agent,r.running,r.text])).toEqual([['codex',true,'live text'],['claude',false,'completed analysis']])
 expect(roundResponses({...run,status:'completed'},messages,progress).every(r=>!r.running)).toBe(true)
 expect(roundResponses({...run,round:2},messages,progress)).toEqual([])
 expect(roundResponses(run,messages,{'runcodex':{...progress.runcodex,attemptId:'old'}})[0].text).toBe('')
})

test('two instances of the same kind keep separate messages and streams',()=>{
 const run={id:'run',round:1,status:'running',participants:[{id:'codex',kind:'codex'},{id:'codex-2',kind:'codex'}],attempts:[{id:'a',memberId:'codex',kind:'codex',round:1,status:'completed',stage:'discussing',outputMessageId:'first'},{id:'b',memberId:'codex-2',kind:'codex',round:1,status:'running',stage:'discussing'}]} as Run
 const messages=[{id:'first',runId:'run',memberId:'codex',agent:'codex',round:1,role:'agent',text:'first instance'}] as Message[]
 const progress={'runcodex-2':{runId:'run',memberId:'codex-2',agent:'codex',round:1,stage:'discussing',attemptId:'b',text:'second instance live'}} as Record<string,ProgressEvent>
 const responses=roundResponses(run,messages,progress)
 expect(responses.map(r=>[r.memberId,r.label,r.text])).toEqual([['codex','Codex','first instance'],['codex-2','Codex 2','second instance live']])
})

test('responding label requires output activity, not just a running invocation',()=>{
 const run={id:'r',round:1,status:'running',participants:[{id:'codex',kind:'codex'}],attempts:[{id:'a',memberId:'codex',kind:'codex',round:1,status:'running',stage:'discussing',events:[]}]} as unknown as Run
 const state=()=>roundResponses(run,[],{})[0].activity
 expect(state()).toBe('等待响应')
 run.attempts![0].events.push({id:'e',at:'',type:'status',summary:'已收到中间执行反馈'})
 expect(state()).toBe('处理中')
 run.attempts![0].activity='tool';expect(state()).toBe('工具执行中')
 run.attempts![0].activity='responding';expect(state()).toBe('正在输出')
})