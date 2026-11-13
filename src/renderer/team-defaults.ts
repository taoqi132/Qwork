import type {AgentInfo,AgentKind,Mode} from '../shared/types'

export const MODERATOR_PRIORITY:AgentKind[]=['claude','codex','workbuddy','qwen','zcode','openclaw']
export const OWNER_PRIORITY:AgentKind[]=['codex','claude','workbuddy','qwen','zcode','openclaw']

function ranked(agents:AgentInfo[],priority:AgentKind[]):AgentKind[]{
  return agents.filter(a=>a.installed&&a.compatible&&a.credential!=='missing').slice().sort((a,b)=>
    Number(b.credential==='ready')-Number(a.credential==='ready')||priority.indexOf(a.kind)-priority.indexOf(b.kind)
  ).map(a=>a.kind)
}

export function defaultRoles(agents:AgentInfo[]){
  const executor=ranked(agents,OWNER_PRIORITY)[0]||'codex'
  const moderator=ranked(agents,MODERATOR_PRIORITY).find(kind=>kind!==executor)||executor
  return {executor,moderator,summarizer:executor}
}

/** Deterministic preferences, not claims about the user's configured models. */
export function recommendTeam(available:AgentInfo[],mode:Mode,direct=false){
  const order=ranked(available,OWNER_PRIORITY),roles=defaultRoles(available)
  const count=direct?1:mode==='auto'||mode==='parallel'?3:2
  const preferred=direct||mode==='parallel'?order:[roles.executor,roles.moderator,...order]
  const agents=[...new Set(preferred)].filter(k=>order.includes(k)).slice(0,count)
  return {agents,...defaultRoles(available.filter(a=>agents.includes(a.kind)))}
}
