import type {ProgressEvent,Run} from '../shared/types'

export function currentStreams(progress:Record<string,ProgressEvent>,run?:Run):ProgressEvent[]{
  if(!run||run.status!=='running')return []
  return Object.values(progress).filter(event=>event.runId===run.id&&event.stage===run.stage&&!!event.text&&run.activeAgents?.includes(event.agent))
}
