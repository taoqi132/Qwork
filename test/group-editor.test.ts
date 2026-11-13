import {expect,test} from 'vitest'
import {reactive} from 'vue'
import {copyGroupInput,availableMemberCount} from '../src/renderer/group-editor'
import type {AgentInfo,Group} from '../src/shared/types'

test('opening an existing reactive group produces an independent editable model',()=>{
 const group=reactive({id:'g',name:'Group',goal:'',kind:'group',workdir:'D:/workspace',allowWrite:true,mode:'auto',maxRounds:3,moderator:'codex-2',summarizer:'codex',executor:'codex',executeAfter:true,recommended:false,agents:[{id:'codex',kind:'codex',model:'first'},{id:'codex-2',kind:'codex',model:'second'}]}) as Group
 const copy=copyGroupInput(group)
 expect(copy.moderator).toBe('codex-2')
 expect(copy.agents.map(a=>a.model)).toEqual(['first','second'])
 expect(()=>structuredClone(copy)).not.toThrow()
 copy.agents[1].model='changed';copy.agents.splice(0,1);copy.name='changed'
 expect(group.agents).toHaveLength(2)
 expect(group.agents[1].model).toBe('second')
 expect(group.name).toBe('Group')
})
test('two instances of one installed CLI meet the group member requirement',()=>{
 const members=[{id:'codex',kind:'codex' as const},{id:'codex-2',kind:'codex' as const}]
 const agents=[{kind:'codex',installed:true,compatible:true}] as AgentInfo[]
 expect(availableMemberCount(members,agents)).toBe(2)
 expect(availableMemberCount(members.slice(0,1),agents)).toBe(1)
 expect(availableMemberCount(members,[{...agents[0],compatible:false}])).toBe(0)
 expect(availableMemberCount(members,[])).toBe(0)
})
