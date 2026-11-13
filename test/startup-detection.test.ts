import {afterEach,expect,test,vi} from 'vitest'
import {createRequire} from 'node:module'
import {AgentService} from '../src/main/agents'
const require=createRequire(import.meta.url)
const cli=require('../legacy/src/agents/cli/cli-adapters.cjs')
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers()})
test('startup publishes completed agents while slower probes are still running',async()=>{
 let finish!:(value:unknown[])=>void
 vi.spyOn(cli,'detectAgents').mockImplementation(({kinds}:any)=>kinds[0]==='claude'?new Promise(resolve=>finish=resolve):Promise.resolve([]))
 const changed=vi.fn(),service=new AgentService('fixture',undefined,undefined,undefined,changed)
 const pending=service.refresh()
 await vi.waitFor(()=>expect(service.catalog.find(a=>a.kind==='codex')?.source).toBe('未找到 CLI'))
 expect(service.detection.state.status).toBe('searching')
 expect(service.catalog.find(a=>a.kind==='claude')?.source).toBe('未检测')
 finish([]);await pending
 expect(service.detection.state.status).toBe('ready')
 expect(changed).toHaveBeenCalled()
})
test('one hanging CLI times out without blocking startup or publishing late executable results',async()=>{
 vi.useFakeTimers()
 let finish!:(value:unknown[])=>void
 vi.spyOn(cli,'detectAgents').mockImplementation(({kinds}:any)=>kinds[0]==='claude'?new Promise(resolve=>finish=resolve):Promise.resolve([]))
 const service=new AgentService('fixture')
 const pending=service.refresh()
 await vi.advanceTimersByTimeAsync(20000)
 await pending
 expect(service.detection.state.status).toBe('ready')
 expect(service.catalog.find(a=>a.kind==='claude')?.source).toBe('检测超时')
 finish([]);await vi.advanceTimersByTimeAsync(1)
 expect(service.catalog.find(a=>a.kind==='claude')?.source).toBe('检测超时')
})
