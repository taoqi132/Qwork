import {LABELS,type AgentAttempt,type AgentKind,type AgentMember,type ExcludedAgent,type MemberId,type Message} from './types'

/** First instance id equals the kind so legacy role values stay valid. */
export function slotMemberId(kind:AgentKind,used:ReadonlySet<MemberId>):MemberId|undefined{
  if(!used.has(kind))return kind
  const second=`${kind}-2`
  return used.has(second)?undefined:second
}

export function nextMemberId(kind:AgentKind,members:Pick<AgentMember,'id'>[]):MemberId|undefined{
  return slotMemberId(kind,new Set(members.map(member=>member.id)))
}

export function normalizeMembers(raw:(AgentKind|AgentMember)[]):AgentMember[]{
  const used=new Set<MemberId>()
  return raw.map(entry=>{
    const source:{id?:MemberId;kind:AgentKind;model?:string}=typeof entry==='string'?{id:entry,kind:entry}:{id:entry.id,kind:entry.kind,model:entry.model}
    const kind=source.kind
    let id=source.id||kind
    if(used.has(id))id=slotMemberId(kind,used)||id
    used.add(id)
    const model=typeof source.model==='string'?source.model.trim():''
    return {...source,id,kind,...(model?{model}:{})}
  })
}

export function membersFromKinds(kinds:AgentKind[]):AgentMember[]{
  return kinds.map(kind=>({id:kind,kind}))
}

export function memberById(members:AgentMember[],id:MemberId|undefined):AgentMember|undefined{
  return id?members.find(member=>member.id===id):undefined
}

export function firstMemberIdOfKind(members:AgentMember[],kind:AgentKind):MemberId{
  return members.find(member=>member.kind===kind)?.id||kind
}

/** Same-kind instances are numbered in member order: Codex, Codex 2. */
export function memberDisplayName(member:AgentMember,members:AgentMember[]):string{
  const same=members.filter(candidate=>candidate.kind===member.kind)
  const index=same.findIndex(candidate=>candidate.id===member.id)
  return index<=0?LABELS[member.kind]:`${LABELS[member.kind]} ${index+1}`
}

export function memberDisplayNameById(id:MemberId|undefined,kind:AgentKind|undefined,members:AgentMember[]):string{
  // Legacy records stored the kind as their id, so fall back to the first instance of that kind.
  const member=memberById(members,id)||members.find(candidate=>candidate.kind===id)||(kind?members.find(candidate=>candidate.kind===kind):undefined)
  if(member)return memberDisplayName(member,members)
  return kind?LABELS[kind]:String(id||'')
}

export function attemptMemberId(attempt:AgentAttempt):MemberId{
  return attempt.memberId||attempt.kind
}

export function messageMemberId(message:Message):MemberId|undefined{
  return message.memberId||message.agent
}

export function excludedMemberId(excluded:ExcludedAgent):MemberId{
  return excluded.memberId||excluded.kind
}

export function messageDisplayName(message:Message,members:AgentMember[]):string{
  return memberDisplayNameById(messageMemberId(message),message.agent,members)
}