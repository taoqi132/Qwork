import type {AgentInfo,AgentMember,Group,GroupInput} from '../shared/types'

// Copy editable values explicitly: Vue proxies cannot be structured-cloned,
// and model edits must not mutate the live snapshot before Save.
export function copyGroupInput(group:Group):Omit<GroupInput,'agents'> & {agents:AgentMember[]}{
 const {name,goal,kind,workdir,allowWrite,mode,maxRounds,moderator,summarizer,executor,executeAfter,recommended}=group
 return {name,goal,kind,workdir,allowWrite,mode,maxRounds,moderator,summarizer,executor,executeAfter,recommended,agents:group.agents.map(({id,kind,model})=>({id,kind,...(model!==undefined?{model}:{})}))}
}

export function availableMemberCount(members:AgentMember[],agents:AgentInfo[]):number{
 const ready=new Set(agents.filter(agent=>agent.installed&&agent.compatible).map(agent=>agent.kind))
 return members.filter(member=>ready.has(member.kind)).length
}
