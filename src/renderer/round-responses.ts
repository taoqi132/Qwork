import {responseActivity} from './agent-status'
import type {AgentKind,AgentMember,MemberId,Message,ProgressEvent,Run} from '../shared/types'
import {attemptMemberId,memberDisplayName,messageMemberId} from '../shared/agent-members'

export interface RoundResponse {memberId:MemberId;agent:AgentKind;label:string;text:string;running:boolean;status:string;activity?:string;attemptId?:string}

function streamFor(progress:Record<string,ProgressEvent>,run:Run,member:AgentMember){
  const direct=progress[run.id+member.id]
  if(direct)return direct
  // Legacy progress events were keyed by kind; only safe when the kind has one instance.
  return run.participants.filter(candidate=>candidate.kind===member.kind).length===1?progress[run.id+member.kind]:undefined
}

export function roundResponses(run:Run|undefined,messages:Message[],progress:Record<string,ProgressEvent>):RoundResponse[]{
  if(!run)return []
  return run.participants.flatMap(member=>{
    const attempt=run.attempts?.filter(a=>attemptMemberId(a)===member.id&&a.round===run.round).at(-1)
    const message=attempt?.outputMessageId?messages.find(m=>m.id===attempt.outputMessageId):messages.filter(m=>m.runId===run.id&&messageMemberId(m)===member.id&&m.round===run.round).at(-1)
    const stream=streamFor(progress,run,member)
    const matches=stream?.runId===run.id&&(stream.attemptId?stream.attemptId===attempt?.id:stream.round===run.round&&stream.stage===attempt?.stage)
    if(!attempt&&!message&&!matches)return []
    return [{memberId:member.id,agent:member.kind,label:memberDisplayName(member,run.participants),activity:responseActivity(attempt),text:message?.text||(matches?stream.text.split('[[QWORK_RECEIPT:')[0]:''),running:attempt?.status==='running'&&run.status==='running',status:attempt?.status||'completed',attemptId:attempt?.id}]
  })
}