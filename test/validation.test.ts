import {describe,expect,test} from 'vitest'
import {AGENT_KINDS,type AgentMember} from '../src/shared/types'
import {groupSchema} from '../src/main/validation'

const base={name:'n',goal:'g',kind:'group' as const,agents:['codex','claude'],workdir:'',allowWrite:false,mode:'auto' as const,maxRounds:3,moderator:'codex',summarizer:'codex',executor:'codex',executeAfter:false,recommended:false}
const parse=(overrides:Record<string,unknown>) => groupSchema.safeParse({...base,...overrides})

describe('group member validation',()=>{
  test('accepts legacy kinds and two instances of the same Agent',()=>{
    expect(groupSchema.parse(base).agents).toEqual([{id:'codex',kind:'codex'},{id:'claude',kind:'claude'}])
    const parsed=parse({agents:[{id:'codex',kind:'codex',model:'m/a'},{id:'codex-2',kind:'codex'},{id:'claude',kind:'claude'}],moderator:'codex-2',executor:'codex-2',summarizer:'codex-2'})
    expect(parsed.success).toBe(true)
    if(parsed.success)expect(parsed.data.agents.map(member=>member.id)).toEqual(['codex','codex-2','claude'])
  })
  test('rejects a third instance and invalid instance ids',()=>{
    expect(parse({agents:['codex','codex','codex','claude']}).success).toBe(false)
    expect(parse({agents:['codex','claude','workbuddy','zcode','openclaw','qwen','codex']}).success).toBe(true)
    expect(parse({agents:[{id:'codex-3',kind:'codex'},{id:'claude',kind:'claude'}]}).success).toBe(false)
  })
  test('accepts all eleven permitted instances without a total member cap',()=>{
    const agents=AGENT_KINDS.flatMap<AgentMember>(kind=>kind==='openclaw'?[{id:kind,kind}]:[{id:kind,kind},{id:`${kind}-2`,kind}])
    const result=parse({agents,moderator:'claude-2',executor:'codex-2',summarizer:'codex-2'})
    expect(result.success).toBe(true)
    if(result.success)expect(result.data.agents).toHaveLength(11)
    expect(parse({agents:[...agents,{id:'qwen-3',kind:'qwen'}]}).success).toBe(false)
  })
  test('rejects OpenClaw copies and models on CLIs without --model',()=>{
    expect(parse({agents:['openclaw','openclaw']}).success).toBe(false)
    expect(parse({agents:[{id:'zcode',kind:'zcode',model:'anything'},{id:'claude',kind:'claude'}]}).success).toBe(false)
    expect(parse({agents:[{id:'openclaw',kind:'openclaw',model:'anything'},{id:'claude',kind:'claude'}]}).success).toBe(false)
  })
  test('rejects invalid model strings for text model CLIs',()=>{
    expect(parse({agents:[{id:'codex',kind:'codex',model:'bad model'},{id:'claude',kind:'claude'}]}).success).toBe(false)
    expect(parse({agents:[{id:'codex',kind:'codex',model:'vendor/model-1:beta'},{id:'claude',kind:'claude'}]}).success).toBe(true)
  })
  test('roles must belong to a selected instance and direct chats stay single-member',()=>{
    expect(parse({moderator:'qwen'}).success).toBe(false)
    expect(parse({agents:['codex'],moderator:'codex',executor:'codex',summarizer:'codex'}).success).toBe(false)
    expect(parse({kind:'direct',agents:['codex']}).success).toBe(true)
    expect(parse({kind:'direct',agents:['codex','claude'],moderator:'codex',executor:'codex',summarizer:'codex'}).success).toBe(false)
  })
})