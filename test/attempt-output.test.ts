import {expect,test} from 'vitest'
import type {AgentAttempt,Message,Run} from '../src/shared/types'
import {attemptOutput} from '../src/renderer/attempt-output'
test('does not bind a same-kind sibling attempt to the other instance output',()=>{
  const first={id:'a',memberId:'codex',kind:'codex',round:1,stage:'discussing',role:'contributor',startedAt:'2026-11-12T01:00:00Z',outputMessageId:'first'} as AgentAttempt
  const second={id:'b',memberId:'codex-2',kind:'codex',round:1,stage:'discussing',role:'contributor',startedAt:'2026-11-12T01:01:00Z'} as AgentAttempt
  const run={id:'run',participants:[{id:'codex',kind:'codex'},{id:'codex-2',kind:'codex'}],attempts:[first,second]} as Run
  const messages=[{id:'first',runId:'run',memberId:'codex',agent:'codex',round:1,stage:'discussing',collaborationRole:'contributor',createdAt:'2026-11-12T01:00:30Z',text:'first instance output'},{id:'sibling',runId:'run',memberId:'codex',agent:'codex',round:1,stage:'discussing',collaborationRole:'contributor',createdAt:'2026-11-12T01:01:30Z',text:'must not leak'}] as Message[]
  expect(attemptOutput(second,run,messages,{})).toBe('')
  expect(attemptOutput(second,run,messages,{['run'+'codex-2']:{runId:'run',memberId:'codex-2',agent:'codex',round:1,stage:'discussing',attemptId:'b',text:'second live'}} as any)).toBe('second live')
 })
 test('recovers legacy completed output without mixing two calls in the same round',()=>{
 const attempt={id:'a',memberId:'claude',kind:'claude',round:1,stage:'discussing',role:'contributor',startedAt:'2026-11-12T01:00:00Z'} as AgentAttempt
 const next={...attempt,id:'b',startedAt:'2026-11-12T01:10:00Z'}
 const run={id:'run',attempts:[attempt,next]} as Run
 const messages=[{runId:'run',agent:'claude',round:1,stage:'discussing',collaborationRole:'contributor',createdAt:'2026-11-12T01:03:00Z',text:'original output'},{runId:'run',agent:'claude',round:1,stage:'discussing',collaborationRole:'contributor',createdAt:'2026-11-12T01:12:00Z',text:'after clarification'}] as Message[]
 expect(attemptOutput(attempt,run,messages,{})).toBe('original output')
 expect(attemptOutput(next,run,messages,{})).toBe('after clarification')
})
