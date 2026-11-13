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
test('same-kind instances only show the active member stream',()=>{
  const run={id:'run',stage:'discussing',status:'running',participants:[{id:'codex',kind:'codex'},{id:'codex-2',kind:'codex'}],activeMemberIds:['codex-2']} as Run
  const progress={'runcodex':{runId:'run',memberId:'codex',agent:'codex',stage:'discussing',text:'first'},'runcodex-2':{runId:'run',memberId:'codex-2',agent:'codex',stage:'discussing',text:'second'}} as Record<string,ProgressEvent>
  expect(currentStreams(progress,run).map(e=>e.text)).toEqual(['second'])
  expect(currentStreams(progress,{...run,activeMemberIds:['codex']}).map(e=>e.text)).toEqual(['first'])
})
