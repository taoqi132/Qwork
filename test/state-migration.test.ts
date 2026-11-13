import {expect,test} from 'vitest'
import {migrateState,normalizeGroupInput} from '../src/main/state-migration'
import type {GroupInput} from '../src/shared/types'

const raw={
  version:1,
  settings:{defaultDirectory:'D:/projects'},
  groups:[{
    id:'g',kind:'group',name:'n',goal:'',agents:['codex','codex'],moderator:'codex',summarizer:'codex',executor:'codex',
    excludedAgents:[{kind:'claude',reason:'auth',code:'AUTH',category:'authentication',at:'then',runId:'r'}]
  }],
  runs:[{
    id:'r',status:'running',currentAgent:'codex',activeAgents:['codex'],
    participants:['codex'],attempts:[{id:'a',kind:'codex'}],excludedAgents:[{kind:'claude'}],
    modelOverrides:{codex:'legacy/model'},
    gate:{id:'gate',questions:[{question:'受众？',agents:['codex']}]},
    settings:{id:'g',kind:'group',agents:['codex'],moderator:'codex',summarizer:'codex',executor:'codex'}
  }],
  messages:[{id:'m',role:'agent',agent:'codex',text:'old'},{id:'u',role:'user',text:'ask'}]
}

test('v1 data migrates member instances, roles and every kind-keyed field',()=>{
  const state=migrateState(raw as any)
  expect(state.version).toBe(2)
  expect(state.groups[0].agents).toEqual([{id:'codex',kind:'codex'},{id:'codex-2',kind:'codex'}])
  expect(state.groups[0].moderator).toBe('codex')
  expect(state.groups[0].excludedAgents?.[0].memberId).toBe('claude')
  const migratedRun=state.runs[0]!
  expect(migratedRun.participants).toEqual([{id:'codex',kind:'codex'}])
  expect(migratedRun.attempts?.[0].memberId).toBe('codex')
  expect(migratedRun.excludedAgents?.[0].memberId).toBe('claude')
  expect(migratedRun.modelOverrides).toEqual({codex:'legacy/model'})
  expect(migratedRun.currentMemberId).toBe('codex')
  expect(migratedRun.activeMemberIds).toEqual(['codex'])
  expect(migratedRun.gate?.questions?.[0]?.memberIds).toEqual(['codex'])
  expect(state.messages.map(message=>message.memberId)).toEqual(['codex',undefined])
})

test('migration is idempotent and rejects unsupported versions',()=>{
  const once=migrateState(raw as any)
  expect(migrateState(structuredClone(once) as any)).toEqual(once)
  expect(()=>migrateState({...raw,version:3} as any)).toThrow('工作区数据格式不支持')
  expect(()=>migrateState({...raw,groups:undefined} as any)).toThrow('工作区数据格式不支持')
})

test('legacy group input resolves kind roles to the first instance and normalizes members',()=>{
  const input:GroupInput={name:'',goal:'',kind:'group',agents:['claude','codex','codex'],workdir:'',allowWrite:false,mode:'auto',maxRounds:3,moderator:'codex',summarizer:'claude',executor:'codex',executeAfter:false,recommended:false}
  const normalized=normalizeGroupInput(input)
  expect(normalized.agents).toEqual([{id:'claude',kind:'claude'},{id:'codex',kind:'codex'},{id:'codex-2',kind:'codex'}])
  expect(normalized.moderator).toBe('codex')
  expect(normalized.executor).toBe('codex')
  expect(normalized.summarizer).toBe('codex')
})