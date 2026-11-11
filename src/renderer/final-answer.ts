import type {Message,Run} from '../shared/types'

export function finalAnswer(run:Run,messages:Message[]):Message|undefined{
  const answers=messages.filter(m=>m.runId===run.id&&m.role==='agent'&&(m.contextRevision||0)===(run.contextRevision||0))
  return answers.filter(m=>m.collaborationRole==='finalizer'||m.collaborationRole==='producer').at(-1)||answers.filter(m=>m.collaborationRole!=='reviewer'&&m.collaborationRole!=='moderator').at(-1)
}
