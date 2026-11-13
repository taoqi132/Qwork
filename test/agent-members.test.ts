import {describe,expect,test} from 'vitest'
import {
  attemptMemberId,excludedMemberId,firstMemberIdOfKind,memberById,memberDisplayName,memberDisplayNameById,
  membersFromKinds,messageDisplayName,messageMemberId,nextMemberId,normalizeMembers,slotMemberId
} from '../src/shared/agent-members'
import type {AgentAttempt,ExcludedAgent,Message} from '../src/shared/types'

describe('member instance identity',()=>{
  test('first instance keeps the kind id and the second uses the -2 slot',()=>{
    expect(slotMemberId('codex',new Set())).toBe('codex')
    expect(slotMemberId('codex',new Set(['codex']))).toBe('codex-2')
    expect(slotMemberId('codex',new Set(['codex','codex-2']))).toBeUndefined()
    expect(nextMemberId('claude',[{id:'claude'}])).toBe('claude-2')
  })
  test('normalization accepts legacy kind strings and renames duplicate ids',()=>{
    expect(membersFromKinds(['codex','claude'])).toEqual([{id:'codex',kind:'codex'},{id:'claude',kind:'claude'}])
    expect(normalizeMembers(['codex','codex',{id:'codex-2',kind:'codex',model:' m/a '}])).toEqual([
      {id:'codex',kind:'codex'},
      {id:'codex-2',kind:'codex'},
      {id:'codex-2',kind:'codex',model:'m/a'}
    ])
  })
  test('display names number same-kind instances in member order',()=>{
    const members=membersFromKinds(['codex','claude']).concat({id:'codex-2',kind:'codex'})
    expect(memberDisplayName(memberById(members,'codex')!,members)).toBe('Codex')
    expect(memberDisplayName(memberById(members,'codex-2')!,members)).toBe('Codex 2')
    expect(memberDisplayName(memberById(members,'claude')!,members)).toBe('Claude Code')
    // A lone second slot is shown as the first remaining instance, without a gap.
    expect(memberDisplayName({id:'codex-2',kind:'codex'},[{id:'codex-2',kind:'codex'}])).toBe('Codex')
  })
  test('legacy fields fall back to the kind and resolve to the first instance',()=>{
    const members=[{id:'codex-2',kind:'codex' as const},{id:'claude',kind:'claude' as const}]
    expect(firstMemberIdOfKind(members,'codex')).toBe('codex-2')
    expect(firstMemberIdOfKind(members,'qwen')).toBe('qwen')
    expect(memberDisplayNameById('codex',undefined,members)).toBe('Codex')
    expect(memberDisplayNameById('missing','claude',members)).toBe('Claude Code')
    const attempt={kind:'codex'} as AgentAttempt
    const excluded={kind:'codex'} as ExcludedAgent
    const message={role:'agent',agent:'codex'} as Message
    expect(attemptMemberId(attempt)).toBe('codex')
    expect(excludedMemberId(excluded)).toBe('codex')
    expect(messageMemberId(message)).toBe('codex')
    expect(messageDisplayName(message,members)).toBe('Codex')
  })
})