import {expect,test} from 'vitest'
import type {Run,ProgressEvent} from '../src/shared/types'
import {currentStreams} from '../src/renderer/live-streams'
test('moderation never displays a completed peers old discussion stream',()=>{
  const run={id:'run',stage:'discussing',status:'running',activeAgents:['claude']} as Run
  const progress={codex:{runId:'run',agent:'codex',stage:'discussing',text:'old analysis'},claude:{runId:'run',agent:'claude',stage:'discussing',text:'current moderation'}} as Record<string,ProgressEvent>
  expect(currentStreams(progress,run).map(e=>e.text)).toEqual(['current moderation'])
  expect(currentStreams(progress,{...run,status:'waiting'})).toEqual([])
  expect(currentStreams(progress,{...run,id:'other'})).toEqual([])
})
