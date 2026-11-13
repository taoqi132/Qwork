import type {AgentAttempt,Message,ProgressEvent,Run} from '../shared/types'
import {attemptMemberId,messageMemberId} from '../shared/agent-members'

export function attemptOutput(attempt:AgentAttempt,run:Run|undefined,messages:Message[],progress:Record<string,ProgressEvent>):string{
  const memberId=attemptMemberId(attempt)
  const saved=attempt.outputMessageId?messages.find(m=>m.id===attempt.outputMessageId):undefined
  if(saved)return saved.text
  if(!run)return ''
  // Older records may lack outputMessageId. Bind the fallback to this member call's interval.
  const next=run.attempts?.find(a=>attemptMemberId(a)===memberId&&a.startedAt>attempt.startedAt)
  const legacy=messages.filter(m=>m.runId===run.id&&messageMemberId(m)===memberId&&m.round===attempt.round&&m.stage===attempt.stage&&(!m.collaborationRole||m.collaborationRole===attempt.role)&&m.createdAt>=attempt.startedAt&&(!next||m.createdAt<next.startedAt)).at(-1)
  if(legacy)return legacy.text
  const stream=progress[run.id+memberId]
  return stream?.attemptId===attempt.id?stream.text.split('[[QWORK_RECEIPT:')[0]:''
}