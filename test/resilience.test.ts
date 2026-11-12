import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {AgentFault,classifyFault,monitoredInvoke,newAttempt,trace} from '../src/main/resilience'
import {publicRuntimeSignal,diagnosticFailure} from '../src/main/runtime-signals'
import type {InvokeInput,Runner} from '../src/shared/types'
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers())
function setup(runner:Runner){
 const controller=new AbortController(),attempt=newAttempt('workbuddy',2,'discussing','contributor')
 const input:InvokeInput={kind:'workbuddy',prompt:'not stored in trace',workdir:'.',allowWrite:false,signal:controller.signal,timeoutMs:60000,onProgress:()=>{}}
 const pending=monitoredInvoke(runner,input,attempt,{executionIdleMs:100},()=>{})
 return {controller,attempt,pending}
}
const silent:Runner=input=>new Promise((_resolve,reject)=>input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true}))
test('startup silence terminates a hung agent independently of the global timeout',async()=>{
 const f=setup(silent),assertion=expect(f.pending).rejects.toMatchObject({code:'AGENT_NO_EXECUTION_TIMEOUT'})
 await vi.advanceTimersByTimeAsync(100);await assertion
 expect(f.attempt.status).toBe('failed');expect(f.attempt.fault?.category).toBe('idle-timeout');expect(f.attempt.cleanup).toBe('settled')
})
test('an agent that goes silent after initial activity hits the inactivity limit',async()=>{
 const f=setup(input=>{input.onActivity?.();return silent(input)}),assertion=expect(f.pending).rejects.toMatchObject({code:'AGENT_NO_EXECUTION_TIMEOUT'})
 await vi.advanceTimersByTimeAsync(200);await assertion
})
test('heartbeats alone cannot keep a stalled invocation alive indefinitely',async()=>{
 const f=setup(input=>new Promise((_resolve,reject)=>{
  const heartbeat=setInterval(()=>input.onActivity?.(),30)
  input.signal.addEventListener('abort',()=>{clearInterval(heartbeat);reject(input.signal.reason)},{once:true})
 })),assertion=expect(f.pending).rejects.toMatchObject({code:'AGENT_NO_EXECUTION_TIMEOUT'})
 await vi.advanceTimersByTimeAsync(300);await assertion
})
test('a fatal runtime authentication event fails immediately and records its cause',async()=>{
 const f=setup(input=>{const pending=silent(input);input.onRuntimeEvent?.({type:'failure',summary:'auth failed',code:'AUTH',category:'authentication',fatal:true});return pending})
 await expect(f.pending).rejects.toMatchObject({code:'AUTH'});expect(f.attempt.fault?.category).toBe('authentication')
 expect(f.attempt.events.some(e=>e.code==='AUTH')).toBe(true)
})
test('ordinary process failures retain the real category instead of being mistaken for manual removal',async()=>{
 const f=setup(async()=>{throw Object.assign(new Error('invalid API key'),{code:'LOCAL_AGENT_AUTH_REQUIRED'})})
 await expect(f.pending).rejects.toThrow('API key');expect(f.attempt.fault?.category).toBe('authentication')
})
test('user cancellation is not recorded as an agent failure',async()=>{
 const f=setup(silent),assertion=expect(f.pending).rejects.toThrow('任务已停止')
 await vi.advanceTimersByTimeAsync(1);f.controller.abort();await assertion
 expect(f.attempt.status).toBe('cancelled');expect(f.attempt.fault).toBeUndefined()
})
test('a runner that ignores abort cannot keep the orchestration waiting forever',async()=>{
 const f=setup(()=>new Promise(()=>{})),assertion=expect(f.pending).rejects.toMatchObject({code:'AGENT_NO_EXECUTION_TIMEOUT'})
 await vi.advanceTimersByTimeAsync(3000);await assertion;expect(f.attempt.cleanup).toBe('unconfirmed')
})
test('actual progress resets the progress deadline, while trace output stays bounded',async()=>{
 const f=setup(input=>new Promise(resolve=>{
  const events=setInterval(()=>input.onRuntimeEvent?.({type:'tool_result_summary',summary:'file checked',progress:true}),80)
  setTimeout(()=>{clearInterval(events);input.onProgress('answer');resolve({text:'done'})},600)
 }))
 await vi.advanceTimersByTimeAsync(600);await expect(f.pending).resolves.toEqual({text:'done'});expect(f.attempt.responseChars).toBe(6)
 for(let i=0;i<200;i++)trace(f.attempt,'tool','event')
 expect(f.attempt.events).toHaveLength(100);expect(f.attempt.events[0].type).toBe('started');expect(f.attempt.droppedEvents).toBeGreaterThan(0)
})
test('public process traces exclude internal reasoning and raw tool arguments',()=>{
 expect(publicRuntimeSignal({type:'reasoning_summary',summary:'private thoughts'},s=>s)).toBeNull()
 const signal=publicRuntimeSignal({type:'tool_start',title:'Read document',summary:'C:\\private\\file.txt'},s=>s)!
 expect(signal.detail).not.toContain('private');expect(signal.progress).toBe(true)
})
test('known stderr failures are classified without publishing stderr content',()=>{
 const signal=diagnosticFailure('HTTP 401 Unauthorized Authorization: secret')!
 expect(signal.category).toBe('authentication');expect(JSON.stringify(signal)).not.toContain('secret')
 expect(diagnosticFailure('ordinary warning')).toBeNull();expect(classifyFault(new AgentFault('x','network','offline',true)).retryable).toBe(true)
 expect(diagnosticFailure('reading lines 401 through 429')).toBeNull()
})

 test('ongoing tool execution updates count as feedback without a final answer',async()=>{
  const f=setup(input=>new Promise(resolve=>{
   const timer=setInterval(()=>input.onRuntimeEvent?.({type:'tool_update',summary:'tool running'}),50)
   setTimeout(()=>{clearInterval(timer);resolve({text:'done'})},500)
  }))
  await vi.advanceTimersByTimeAsync(500);await expect(f.pending).resolves.toEqual({text:'done'})
 })
 test('total execution limit still stops an agent with continuous tool feedback',async()=>{
  const input:InvokeInput={kind:'codex',prompt:'test',workdir:'.',allowWrite:false,signal:new AbortController().signal,timeoutMs:300,onProgress:()=>{}}
  const attempt=newAttempt('codex',1,'producing','producer')
  const pending=monitoredInvoke(i=>new Promise((_resolve,reject)=>{
   const timer=setInterval(()=>i.onRuntimeEvent?.({type:'tool_update',summary:'running'}),30)
   i.signal.addEventListener('abort',()=>{clearInterval(timer);reject(i.signal.reason)})
  }),input,attempt,{executionIdleMs:100},()=>{})
  const assertion=expect(pending).rejects.toMatchObject({code:'AGENT_TIMEOUT'})
  await vi.advanceTimersByTimeAsync(300);await assertion
 })
