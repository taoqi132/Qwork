import type {ProgressEvent,Run} from '../shared/types'

export function currentStreams(progress:Record<string,ProgressEvent>,run?:Run):ProgressEvent[]{
  if(!run||run.status!=='running')return []
  const active=(event:ProgressEvent)=>run.activeMemberIds?.length?run.activeMemberIds.includes(event.memberId||event.agent):!!run.activeAgents?.includes(event.agent)
  return Object.values(progress).filter(event=>event.runId===run.id&&event.stage===run.stage&&!!event.text&&active(event))
}