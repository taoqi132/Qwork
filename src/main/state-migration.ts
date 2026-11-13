import type {AgentMember,ExcludedAgent,Group,GroupInput,MemberId,Message,Run,State} from '../shared/types'
import {normalizeMembers} from '../shared/agent-members'

type RawState=Omit<State,'version'|'groups'|'runs'|'messages'> & {
  version:number
  groups:any[]
  runs:any[]
  messages:any[]
}

function roleId(members:AgentMember[],value:unknown):MemberId{
  const id=String(value||'')
  if(members.some(member=>member.id===id))return id
  return members.find(member=>member.kind===id)?.id||members[0]?.id||id
}

function migrateExcluded(list:unknown):ExcludedAgent[]|undefined{
  if(!Array.isArray(list))return undefined
  return list.map(item=>({...item,memberId:item.memberId||item.kind}))
}

export function migrateGroup(raw:any):Group{
  const agents=normalizeMembers(Array.isArray(raw.agents)?raw.agents:[])
  return {
    ...raw,
    agents,
    moderator:roleId(agents,raw.moderator),
    summarizer:roleId(agents,raw.executor??raw.summarizer),
    executor:roleId(agents,raw.executor),
    ...(raw.excludedAgents?{excludedAgents:migrateExcluded(raw.excludedAgents)}:{})
  }
}

export type NormalizedGroupInput=Omit<GroupInput,'agents'> & {agents:AgentMember[]}

export function normalizeGroupInput(input:GroupInput):NormalizedGroupInput{
  const agents=normalizeMembers(input.agents)
  const executor=roleId(agents,input.executor)
  return {
    ...input,
    agents,
    moderator:roleId(agents,input.moderator),
    executor,
    summarizer:executor
  }
}

function migrateModels(run:any,participants:AgentMember[]):Record<MemberId,string>{
  const legacy=run.modelOverrides&&typeof run.modelOverrides==='object'?run.modelOverrides:{}
  const next:Record<MemberId,string>={}
  for(const member of participants){
    const memberModel=typeof member.model==='string'?member.model.trim():''
    if(memberModel)next[member.id]=memberModel
    else if(typeof legacy[member.id]==='string')next[member.id]=legacy[member.id]
    else if(typeof legacy[member.kind]==='string')next[member.id]=legacy[member.kind]
  }
  return next
}

export function migrateRun(raw:any):Run{
  const participants=normalizeMembers(Array.isArray(raw.participants)&&raw.participants.length?raw.participants:[])
  const gate=raw.gate&&typeof raw.gate==='object'?{...raw.gate,questions:Array.isArray(raw.gate.questions)?raw.gate.questions.map((question:any)=>({...question,memberIds:question.memberIds||question.agents||[]})):raw.gate.questions}:raw.gate
  return {
    ...raw,
    participants,
    settings:migrateGroup(raw.settings),
    gate,
    modelOverrides:migrateModels(raw,participants),
    currentMemberId:raw.currentMemberId||raw.currentAgent,
    activeMemberIds:raw.activeMemberIds||raw.activeAgents||[],
    attempts:Array.isArray(raw.attempts)?raw.attempts.map((attempt:any)=>({...attempt,memberId:attempt.memberId||attempt.kind})):raw.attempts,
    excludedAgents:migrateExcluded(raw.excludedAgents)
  }
}

function migrateMessage(raw:any):Message{
  return {...raw,...(raw.role==='agent'&&raw.agent&&!raw.memberId?{memberId:raw.agent}:{})}
}

export function migrateState(raw:RawState):State{
  if(raw.version!==1&&raw.version!==2)throw new Error('工作区数据格式不支持，请保留原文件后联系维护者')
  if(!Array.isArray(raw.groups)||!Array.isArray(raw.runs)||!Array.isArray(raw.messages))throw new Error('工作区数据格式不支持，请保留原文件后联系维护者')
  return {
    ...raw,
    version:2,
    groups:raw.groups.map(migrateGroup),
    runs:raw.runs.map(migrateRun),
    messages:raw.messages.map(migrateMessage)
  }
}