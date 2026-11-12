import {expect,test} from 'vitest'
import {AgentDetection} from '../src/main/agent-detection'
test('startup, concurrent refresh, failure and retry publish a shared detection state',async()=>{
 const events:string[]=[]
 const detection=new AgentDetection(()=>events.push(detection.state.status))
 expect(detection.state.status).toBe('searching')
 let finish!:(value:number)=>void
 const first=detection.run(()=>new Promise<number>(resolve=>{finish=resolve}))
 const second=detection.run(async()=>{throw Error('must not start a second search')})
 await Promise.resolve();finish(6)
 expect(await first).toBe(6);expect(await second).toBe(6)
 expect(events).toEqual(['searching','ready'])
 await expect(detection.run(async()=>{throw Error('private diagnostic')})).rejects.toThrow('private diagnostic')
 expect(detection.state).toEqual({status:'failed'})
 expect(await detection.run(async()=>3)).toBe(3)
 expect(detection.state.status).toBe('ready')
})
