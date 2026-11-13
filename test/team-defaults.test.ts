import {expect,test} from 'vitest'
import {AGENT_KINDS,type AgentInfo} from '../src/shared/types'
import {recommendTeam} from '../src/renderer/team-defaults'
const agents=AGENT_KINDS.map(kind=>({kind,installed:true,compatible:true,credential:'ready'})) as AgentInfo[]
test('each mode uses a small team with separate ownership and moderation',()=>{
 for(const mode of ['auto','parallel','sequential','review'] as const){
  const team=recommendTeam(agents,mode)
  expect(team.agents).toEqual(mode==='auto'||mode==='parallel'?['codex','claude','workbuddy']:['codex','claude'])
  expect(team.executor).toBe('codex');expect(team.moderator).toBe('claude')
 }
})
test('recommendations use only available agents and prefer configured ones',()=>{
 const mixed=agents.map(a=>({...a,installed:a.kind!=='codex',credential:a.kind==='claude'?'missing':a.kind==='workbuddy'?'unknown':'ready'})) as AgentInfo[]
 const team=recommendTeam(mixed,'auto')
 expect(team.agents).toEqual(['qwen','zcode','openclaw'])
 expect(team.executor).toBe('qwen');expect(team.moderator).toBe('zcode')
 expect(recommendTeam(agents.filter(a=>['claude','workbuddy'].includes(a.kind)),'auto').agents).toEqual(['claude','workbuddy'])
 expect(recommendTeam([],'auto').agents).toEqual([])
})
test('all combinations of installed CLIs have valid deterministic roles and no duplicate members',()=>{
 for(let mask=0;mask<64;mask++)for(const mode of ['auto','sequential','review','parallel'] as const){
  const available=agents.filter((_,i)=>mask&(1<<i)),team=recommendTeam(available,mode)
  expect(new Set(team.agents).size).toBe(team.agents.length)
  expect(team.agents.every(k=>available.some(a=>a.kind===k))).toBe(true)
  if(team.agents.length){expect(team.agents).toContain(team.executor);expect(team.agents).toContain(team.moderator)}
  if(team.agents.length>1)expect(team.executor).not.toBe(team.moderator)
 }
 expect(recommendTeam(agents,'auto',true).agents).toEqual(['codex'])
})
