import { afterEach, describe, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { GroupInput, InvokeInput, Receipt, Runner } from '../src/shared/types'
import { Store, within } from '../src/main/storage'
import { Workflow } from '../src/main/workflow'
import { parseReceipt } from '../src/main/receipts'
import { groupSchema, sendSchema } from '../src/main/validation'
const roots:string[]=[]
afterEach(()=>{for(const p of roots.splice(0))fs.rmSync(p,{recursive:true,force:true})})
const receipt=(status:Receipt['status']='ready',extra:Partial<Receipt>={})=>({text:`有效成果正文\n[[QWORK_RECEIPT:${JSON.stringify({summary:'本阶段完成',status,issues:[],...extra})}]]`})
const version=(prompt:string)=>prompt.match(/候选版本：([a-f0-9]{64})/)?.[1]
function fixture(overrides:Partial<GroupInput>={},runner?:Runner){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qwork-test-'));roots.push(root)
  const store=new Store(path.join(root,'data'),path.join(root,'projects'))
  const input:GroupInput={name:'仅显示的名称',goal:'长期目标',kind:'group',agents:['codex','claude'],workdir:'',allowWrite:false,mode:'auto',maxRounds:6,moderator:'codex',summarizer:'codex',executor:'codex',executeAfter:false,recommended:false,...overrides}
  const group=store.createGroup(input)
  const calls:InvokeInput[]=[]
  const engine=new Workflow(store,async i=>{calls.push(i);return runner?runner(i):receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})},()=>{})
  const start=(text=group.mode==='review'?'制作报告文件':'完成用户任务')=>engine.start({groupId:group.id,text,attachmentIds:[],mode:group.mode})
  return {root,store,group,calls,engine,start}
}
describe('result-centred orchestration',()=>{
  test('new workspace defaults are 30 minutes, 5 discussion rounds and 5 minutes without execution feedback',()=>{
    const f=fixture()
    expect(f.store.state.settings.timeoutMinutes).toBe(30)
    expect(f.store.state.settings.maxRounds).toBe(5)
    expect(f.store.state.settings.noExecutionTimeoutMinutes).toBe(5)
    Object.assign(f.store.state.settings,{timeoutMinutes:45,maxRounds:3,startupTimeoutSeconds:10})
    f.store.save()
    const reopened=new Store(f.store.dataDirectory,f.store.state.settings.defaultDirectory)
    expect(reopened.state.settings.timeoutMinutes).toBe(45)
    expect(reopened.state.settings.maxRounds).toBe(3)
    expect(reopened.state.settings).not.toHaveProperty('startupTimeoutSeconds')
  })

  test('ten selected attachments pass IPC validation, eleven do not',()=>{
    const ids=Array.from({length:11},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`)
    const input={groupId:ids[0],text:'test',mode:'auto',attachmentIds:ids.slice(0,10)}
    expect(sendSchema.safeParse(input).success).toBe(true)
    expect(sendSchema.safeParse({...input,attachmentIds:ids}).success).toBe(false)
  })
  test('single chat does not label an explicitly blocked result completed',async()=>{
    const f=fixture({kind:'direct',agents:['codex']},async()=>receipt('continue',{issues:['关键条件未满足']}))
    const run=f.start();await f.engine.settled(run.id)
    expect(f.store.run(run.id).status).toBe('partial')
    expect(f.store.run(run.id).issues).toEqual(['关键条件未满足'])
  })
  test('production retry preserves current analysis, full decisions and nested draft copies',async()=>{
    let retrying=false
    const f=fixture({mode:'auto',allowWrite:true,executeAfter:true},async i=>{
      if(i.allowWrite){
        const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1]
        if(retrying){
          expect(i.prompt).toContain('APPROVED_ANALYSIS')
          expect(i.prompt).not.toContain('STALE_ANALYSIS')
          expect(i.prompt).toContain('KEEP_USER_DECISION')
          expect(i.prompt).toContain('MERGED_OWNER_PLAN')
          expect(fs.readFileSync(path.join(out,'slides','draft.md'),'utf8')).toBe('draft')
          return receipt()
        }
        fs.mkdirSync(path.join(out,'slides'),{recursive:true});fs.writeFileSync(path.join(out,'slides','draft.md'),'draft')
        return {text:'MERGED_OWNER_PLAN\n'+receipt('continue',{issues:['missing tool']}).text}
      }
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const first=f.start();await f.engine.settled(first.id)
    const base=f.store.state.messages.find(m=>m.runId===first.id&&m.role==='agent')!
    f.store.run(first.id).contextRevision=1
    f.store.state.messages.filter(m=>m.runId===first.id).forEach(m=>m.contextRevision=1)
    f.store.state.messages.push({...base,id:'current',text:'APPROVED_ANALYSIS',contextRevision:1},{...base,id:'old',text:'STALE_ANALYSIS',contextRevision:0},{...base,id:'decision',role:'user',text:'本次决定：KEEP_USER_DECISION'})
    const count=f.calls.length;retrying=true
    const second=f.engine.retryExecution(first.id);await f.engine.settled(second.id)
    expect(f.store.run(second.id).status).toBe('completed')
    expect(f.store.run(second.id).round).toBeGreaterThanOrEqual(1)
    expect(f.calls.slice(count)).toHaveLength(2)
    expect(f.store.state.messages.filter(m=>m.runId===second.id&&m.role==='agent').every(m=>m.stage!=='discussing')).toBe(true)
    const oldFile=f.store.state.artifacts.find(a=>a.runId===first.id)!
    expect(fs.readFileSync(within(f.group.workdir,oldFile.relativePath),'utf8')).toBe('draft')
  })

  test('review clarification invalidates earlier peer approvals and reruns every reviewer',async()=>{
    const f=fixture({mode:'review',agents:['codex','claude','workbuddy'],allowWrite:true,maxRounds:1},async i=>{
      if(i.allowWrite){const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      if(i.kind==='workbuddy'&&!i.prompt.includes('用户对本批关键问题的补充'))return receipt('needs-human',{summary:'核对受众',questions:[{question:'受众是谁？'}]})
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const r=f.start();for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(f.calls.filter(i=>i.kind==='claude')).toHaveLength(1)
    f.engine.decide(r.id,'管理层',f.store.run(r.id).gate!.id);await f.engine.settled(r.id)
    expect(f.calls.filter(i=>i.kind==='claude')).toHaveLength(2)
    expect(f.calls.filter(i=>i.kind==='workbuddy')).toHaveLength(2)
    expect(f.store.run(r.id).status).toBe('completed')
  })
  for(const mode of ['auto','sequential','parallel'] as const)test(`${mode}: global clarification refreshes related analysis in the same round`,async()=>{
    const f=fixture({mode,maxRounds:1},async i=>{
      if(i.prompt.includes('本次角色与要求：\n本阶段只读。')&&i.kind==='claude'&&!i.prompt.includes('受众为管理层'))return receipt('needs-human',{summary:'受众是谁？',questions:[{question:'受众是谁？',scope:'task'}]})
      return receipt()
    })
    const r=f.start();for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(f.store.run(r.id).gate?.kind).toBe('clarification');f.engine.decide(r.id,'受众为管理层',f.store.run(r.id).gate!.id)
    await f.engine.settled(r.id);expect(f.store.run(r.id).status).toBe('completed');expect(f.store.run(r.id).round).toBe(1)
    const codexAnalysis=f.calls.filter(i=>i.kind==='codex'&&i.prompt.includes('本次角色与要求：\n本阶段只读。'))
    expect(codexAnalysis).toHaveLength(2);expect(codexAnalysis[1].prompt).toContain('受众为管理层')
  })
  test('a writer global clarification replans before continuing any file modifications',async()=>{
    let writes=0
    const f=fixture({mode:'auto',allowWrite:true,executeAfter:true,maxRounds:1},async i=>{
      if(i.allowWrite){writes++;const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),writes===1?'draft':'final')
        if(writes===1)return receipt('needs-human',{summary:'受众是谁？',questions:[{question:'受众是谁？'}]})
      }
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read final file'})
    })
    const r=f.start();for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(writes).toBe(1);f.engine.decide(r.id,'管理层',f.store.run(r.id).gate!.id);await f.engine.settled(r.id)
    expect(writes).toBe(2);expect(f.store.run(r.id).status).toBe('completed')
    expect(f.calls.filter(i=>i.prompt.includes('本次角色与要求：\n本阶段只读。'))).toHaveLength(4)
  })
  test('parallel clarification reruns only the asking member without leaking peer answers',async()=>{
    const f=fixture({mode:'parallel'},async i=>{
      const analyzing=i.prompt.includes('本次角色与要求：\n本阶段只读。')
      if(analyzing&&i.kind==='claude')return {text:'PRIVATE_PEER_OPINION\n'+receipt().text}
      if(analyzing&&!i.prompt.includes('用户对本批关键问题的补充'))return receipt('needs-human',{summary:'受众是谁？',questions:[{question:'受众是谁？',scope:'agent',options:['管理层','技术团队']}]})
      if(analyzing){expect(i.prompt).toContain('管理层');expect(i.prompt).not.toContain('PRIVATE_PEER_OPINION')}
      return receipt()
    })
    const r=f.start();for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(f.store.run(r.id).gate?.kind).toBe('clarification')
    f.engine.decide(r.id,'管理层',f.store.run(r.id).gate!.id);await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed');expect(f.store.run(r.id).round).toBe(1)
    const calls=f.calls.filter(i=>i.prompt.includes('本次角色与要求：\n本阶段只读。'))
    expect(calls.filter(i=>i.kind==='codex')).toHaveLength(2);expect(calls.filter(i=>i.kind==='claude')).toHaveLength(1)
  })
  test('writing clarification waits for an explicit user answer before continuing existing files',async()=>{
    let writes=0
    const f=fixture({mode:'review',allowWrite:true,maxRounds:1},async i=>{
      if(i.allowWrite){writes++;const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),writes===1?'draft':'final')
        if(writes===1)return receipt('needs-human',{summary:'受众是谁？',questions:[{question:'受众是谁？'}]})
        expect(i.prompt).toContain('先检查本次成果目录中的已有阶段文件');expect(i.prompt).toContain('管理层')
      }
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read final file'})
    })
    const r=f.start();for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(writes).toBe(1);expect(f.store.run(r.id).gate?.resumeWrite).toBe(true);expect(f.store.state.artifacts).toHaveLength(1)
    f.engine.decide(r.id,'管理层',f.store.run(r.id).gate!.id);await f.engine.settled(r.id)
    expect(writes).toBe(2);expect(f.store.run(r.id).status).toBe('completed')
  })
  test('persistent questions stop with partial results and do not eject a healthy agent',async()=>{
    const f=fixture({mode:'sequential'},async()=>receipt('needs-human',{summary:'请补充受众'}))
    const r=f.start();let previous=''
    for(let count=0;count<2;count++){
      for(let n=0;n<100&&(!f.store.run(r.id).gate||f.store.run(r.id).gate!.id===previous);n++)await new Promise(resolve=>setTimeout(resolve,5))
      const gate=f.store.run(r.id).gate!;expect(gate.id).not.toBe(previous)
      if(previous)expect(()=>f.engine.decide(r.id,'旧问题的答案',previous)).toThrow('已变化')
      previous=gate.id;f.engine.decide(r.id,'受众为管理层',gate.id)
    }
    await f.engine.settled(r.id);expect(f.store.run(r.id).status).toBe('partial');expect(f.group.agents).toHaveLength(2)
  })
  for(const allFail of [false,true])test(`reviewer errors are explicit and quorum is preserved: ${allFail}`,async()=>{
    const f=fixture({mode:'review',agents:['codex','claude','workbuddy'],allowWrite:true,maxRounds:1},async i=>{
      if(i.kind==='workbuddy'||allFail&&i.kind==='claude')throw new Error('review process failed')
      if(i.allowWrite){const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).degraded).toBe(true)
    expect(f.store.run(r.id).status).toBe(allFail?'partial':'completed')
    expect(f.store.state.artifacts[0].checked).toBe(!allFail)
    expect(f.group.agents).not.toContain('workbuddy')
  })
  for(const mode of ['auto','sequential','parallel'] as const)test(`${mode}: one owner call synthesizes and produces after analysis`,async()=>{
    const f=fixture({mode,executeAfter:true,allowWrite:true,executor:'claude'},async i=>{
      if(i.allowWrite){expect(i.kind).toBe('claude');expect(i.prompt).toContain('在同一次调用中先整合');const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed')
    expect(f.calls).toHaveLength(mode==='parallel'?4:5)
    expect(f.store.run(r.id).attempts?.some(a=>a.role==='finalizer')).toBe(false)
    expect(f.calls.filter(i=>i.allowWrite)).toHaveLength(1)
  })
  test('review uses every non-creator member as an independent reviewer',async()=>{
    const f=fixture({mode:'review',agents:['codex','claude','workbuddy'],allowWrite:true,maxRounds:1},async i=>{
      if(i.allowWrite){const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read actual file'})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed')
    expect(f.calls.filter(i=>i.allowWrite).map(i=>i.kind)).toEqual(['codex'])
    const checks=f.calls.filter(i=>!i.allowWrite)
    expect(checks.map(i=>i.kind)).toEqual(['claude','workbuddy']);expect(checks[0].prompt).toBe(checks[1].prompt)
    expect(f.store.run(r.id).verification).toContain('WorkBuddy');expect(f.store.state.artifacts[0].checked).toBe(true)
  })
  for(const invalid of ['disagree','wrong-version'] as const)test(`a reviewer ${invalid} blocks review delivery`,async()=>{
    const f=fixture({mode:'review',agents:['codex','claude','workbuddy'],allowWrite:true,maxRounds:1},async i=>{
      if(i.allowWrite){const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      if(i.kind==='workbuddy')return receipt(invalid==='disagree'?'continue':'approve',{issues:invalid==='disagree'?['critical issue']:[],reviewedVersion:'wrong',verification:'read file'})
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.store.state.artifacts[0].checked).toBe(false)
  })
  test('a critical production blocker stops the owner without replaying writes',async()=>{
    const f=fixture({mode:'parallel',executeAfter:true,allowWrite:true},async i=>i.allowWrite?receipt('continue',{issues:['need source data']}):receipt())
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.calls.filter(i=>i.allowWrite)).toHaveLength(1)
    expect(f.calls.some(i=>version(i.prompt))).toBe(false)
  })
  test('agent model selections are frozen for the entire task',async()=>{
    const f=fixture();f.store.state.settings.agentModels={codex:'fixture/model-a',claude:'fixture/model-b'}
    const r=f.start();f.store.state.settings.agentModels.codex='changed'
    await f.engine.settled(r.id)
    expect(f.calls.filter(i=>i.kind==='codex').every(i=>i.modelId==='fixture/model-a')).toBe(true)
    expect(f.calls.find(i=>i.kind==='claude')?.modelId).toBe('fixture/model-b')
  })
  test('web permission is frozen at task start and included in the task prompt',async()=>{
    const f=fixture();f.store.state.settings.allowWeb=false
    const r=f.start();f.store.state.settings.allowWeb=true
    await f.engine.settled(r.id)
    expect(f.store.run(r.id).allowWeb).toBe(false)
    expect(f.calls.every(i=>i.allowWeb===false&&i.prompt.includes('本次未授权原生联网工具'))).toBe(true)
  })
  test('a plain review question waits for output choice before launching and can answer without writing',async()=>{
    const f=fixture({mode:'review',allowWrite:true,maxRounds:2},async i=>receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'检查回答是否切题'}))
    const r=f.start('杭州哪个区的软件行业更发达？')
    for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(f.calls).toHaveLength(0)
    expect(f.store.run(r.id).gate?.options).toEqual(['仅回答并检查','制作文件并检查'])
    f.engine.decide(r.id,'仅回答并检查');await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed');expect(f.store.run(r.id).delivery).toBe('text')
    expect(f.calls).toHaveLength(2);expect(f.calls.every(i=>!i.allowWrite)).toBe(true)
    expect(f.store.state.artifacts).toHaveLength(0)
  })
  test('running round limits are validated and affect the next iteration',async()=>{
    let resume:()=>void=()=>{}
    const blocked=new Promise<void>(resolve=>resume=resolve)
    const f=fixture({maxRounds:6},async i=>{await blocked;return receipt(i.prompt.includes('你是只读主持者')?'continue':'ready',{issues:i.prompt.includes('你是只读主持者')?['blocker']:[]})})
    const r=f.start()
    expect(f.store.run(r.id).round).toBe(1)
    for(const n of [1,0,9,2.5])expect(()=>f.engine.adjustRounds(r.id,n)).toThrow()
    f.engine.adjustRounds(r.id,2);expect(f.store.run(r.id).maxRounds).toBe(2)
    expect(f.group.maxRounds).toBe(6)
    resume();await f.engine.settled(r.id)
    expect(f.store.run(r.id).round).toBe(2)
    expect(()=>f.engine.adjustRounds(r.id,3)).toThrow()
  })
  test('accepting unresolved discussion synthesizes and produces in one owner call',async()=>{
    const f=fixture({maxRounds:1,allowWrite:true,executeAfter:true},async i=>{
      if(i.prompt.includes('你是只读主持者'))return receipt('continue',{issues:['unresolved evidence']})
      if(i.allowWrite){expect(i.prompt).toContain('用户已明确接受阶段风险继续');expect(i.prompt).toContain('在同一次调用中先整合');const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'result.md'),'result')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const r=f.start()
    for(let n=0;n<100&&!f.store.run(r.id).gate;n++)await new Promise(resolve=>setTimeout(resolve,5))
    expect(f.store.run(r.id).gate?.kind).toBe('partial');f.engine.decide(r.id,'接受风险继续')
    await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed')
    expect(f.calls.filter(i=>i.allowWrite)).toHaveLength(1)
    expect(f.store.run(r.id).attempts?.filter(a=>a.role==='finalizer')).toHaveLength(0)
  })
  test('consensus exits at round 1 instead of using all six rounds',async()=>{
    const f=fixture();const r=f.start();await f.engine.settled(r.id)
    const run=f.store.run(r.id);expect(run.status).toBe('completed');expect(run.round).toBe(1)
    expect(f.calls.filter(c=>c.prompt.includes('候选版本：'))).toHaveLength(0)
    expect(f.calls.every(c=>!c.allowWrite)).toBe(true)
    const messages=f.store.state.messages.filter(m=>m.runId===r.id&&m.role==='agent')
    expect(messages.filter(m=>m.collaborationRole==='moderator')).toHaveLength(1)
    expect(messages.filter(m=>m.agent==='codex'&&m.collaborationRole==='contributor')).toHaveLength(1)
  })
  test('missing receipts never count as consensus and stop at configured limit',async()=>{
    const f=fixture({maxRounds:2},async()=>({text:'我觉得没问题'}));const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.store.run(r.id).round).toBe(2)
  })
  test('moderator blockers prevent synthesis',async()=>{
    const f=fixture({maxRounds:1},async i=>receipt(i.prompt.includes('你是只读主持者')?'continue':'ready',{issues:i.prompt.includes('你是只读主持者')?['missing evidence']:[]}));const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial')
  })
  test('parallel participants receive an identical frozen prompt',async()=>{
    const f=fixture({mode:'parallel'});const r=f.start();await f.engine.settled(r.id)
    expect(f.calls[0].prompt).toBe(f.calls[1].prompt)
    expect(f.store.run(r.id).round).toBe(1)
    expect(f.store.run(r.id).maxRounds).toBe(1)
    expect(f.calls).toHaveLength(3)
    expect(f.store.run(r.id).verification).toContain('未经全员共识')
  })
  test('sequential participants see committed predecessor replies',async()=>{
    const f=fixture({mode:'sequential'});const r=f.start();await f.engine.settled(r.id)
    expect(f.calls[1].prompt).toContain('有效成果正文')
    expect(f.calls[0].prompt).not.toContain('有效成果正文')
  })
  test('group display name is absent from prompts; goal remains present',async()=>{
    const f=fixture();const r=f.start();await f.engine.settled(r.id)
    expect(f.calls.every(c=>!c.prompt.includes('仅显示的名称'))).toBe(true)
    expect(f.calls[0].prompt).toContain('长期目标')
  })
  test('review requires actual files, not a claim that files were made',async()=>{
    const f=fixture({mode:'review',allowWrite:true,maxRounds:2});const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.store.state.artifacts).toHaveLength(0)
  })
  test('one producer writes and a different read-only reviewer accepts the current file version',async()=>{
    const f=fixture({mode:'review',allowWrite:true,maxRounds:3},async i=>{
      if(i.allowWrite){const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(out,'report.md'),'真实文件')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'已读取 Markdown 文件内容'})
    });const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed');expect(f.calls).toHaveLength(2)
    expect(f.calls[0].allowWrite).toBe(true);expect(f.calls[1].allowWrite).toBe(false)
    expect(f.calls[0].kind).not.toBe(f.calls[1].kind);expect(f.store.state.artifacts[0].checked).toBe(true)
  })
  test('file mutation during review invalidates approval',async()=>{
    const f=fixture({mode:'review',allowWrite:true,maxRounds:1},async i=>{
      const out=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1]
      fs.writeFileSync(path.join(out,'report.md'),i.allowWrite?'version1':'unexpected-version2')
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'checked'})
    });const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.store.state.artifacts[0].checked).toBe(false)
  })
  test('cancellation settles a waiting human gate without launching another turn',async()=>{
    const f=fixture({},async()=>receipt('needs-human',{summary:'请选择受众'}));const r=f.start()
    await new Promise(resolve=>setTimeout(resolve,20));expect(f.store.run(r.id).status).toBe('waiting')
    await f.engine.stop(r.id);expect(f.store.run(r.id).status).toBe('cancelled');expect(f.store.run(r.id).gate).toBeUndefined()
  })
  test('busy group cannot start a second task',async()=>{
    const f=fixture({},i=>new Promise((_resolve,reject)=>i.signal.addEventListener('abort',()=>reject(new Error('cancelled')))))
    const r=f.start();expect(()=>f.start()).toThrow('正在运行');await f.engine.stop(r.id)
  })
  test('failed peer cannot silently disappear from consensus',async()=>{
    const f=fixture({},async i=>{if(i.kind==='claude')throw new Error('auth required');return receipt()});const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.group.agents).not.toContain('claude');expect(f.store.run(r.id).excludedAgents?.[0].kind).toBe('claude')
  })
  test('attachment passes a file path without extracting contents',async()=>{
    const f=fixture();const source=path.join(f.root,'source.pdf');fs.writeFileSync(source,'OPAQUE_PRIVATE_CONTENT')
    const a=f.store.importAttachment(f.group.id,source)
    const r=f.engine.start({groupId:f.group.id,text:'读取附件',attachmentIds:[a.id],mode:'auto'});await f.engine.settled(r.id)
    expect(f.calls[0].prompt).toContain('source.pdf');expect(f.calls[0].prompt).not.toContain('OPAQUE_PRIVATE_CONTENT')
    expect(f.store.resolveAttachment(a)).not.toBe(source)
  })
  test('changed attachment cannot be supplied under a previous fingerprint',()=>{
    const f=fixture();const source=path.join(f.root,'source.txt');fs.writeFileSync(source,'v1');const a=f.store.importAttachment(f.group.id,source)
    fs.writeFileSync(f.store.resolveAttachment(a),'v2')
    expect(()=>f.engine.start({groupId:f.group.id,text:'read',attachmentIds:[a.id],mode:'auto'})).toThrow('附件已改变')
  })
  test('restart marks an unfinished run interrupted instead of silently rerunning writes',async()=>{
    const f=fixture();const r=f.start();await f.engine.settled(r.id)
    f.store.run(r.id).status='running';f.store.save()
    const recovered=new Store(f.store.dataDirectory,path.join(f.root,'projects'))
    expect(recovered.run(r.id).status).toBe('interrupted')
  })
  test('rejects path traversal and out-of-team roles at boundaries',()=>{
    const f=fixture()
    expect(()=>within(f.group.workdir,'../outside')).toThrow('授权目录')
    expect(()=>groupSchema.parse({...f.group,moderator:'qwen'})).toThrow()
    expect(()=>sendSchema.parse({groupId:f.group.id,text:'',attachmentIds:[],mode:'auto'})).toThrow()
  })
  test('malformed receipts stay unapproved and protocol text is hidden',()=>{
    const parsed=parseReceipt('visible\n[[QWORK_RECEIPT:{bad}]]')
    expect(parsed.receipt).toBeNull();expect(parsed.text).toBe('visible')
  })
  test('retry execution preserves discussion and launches production/checking only',async()=>{
    let writeFiles=false
    const f=fixture({mode:'auto',allowWrite:true,executeAfter:true},async i=>{
      if(i.allowWrite&&writeFiles){const output=i.prompt.match(/本次唯一成果目录：([^\n]+)/)![1];fs.writeFileSync(path.join(output,'final.md'),'done')}
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt),verification:'read file'})
    })
    const first=f.start();await f.engine.settled(first.id);expect(f.store.run(first.id).status).toBe('partial')
    const count=f.calls.length;writeFiles=true
    const retry=f.engine.retryExecution(first.id);await f.engine.settled(retry.id)
    expect(f.store.run(retry.id).status).toBe('completed');expect(f.calls.slice(count)).toHaveLength(2)
    expect(f.store.state.messages.filter(m=>m.runId===retry.id).some(m=>m.stage==='discussing')).toBe(false)
  })
  test('a failed participant is removed and a three-agent group continues with explicit degraded provenance',async()=>{
    const f=fixture({agents:['codex','claude','workbuddy']},async i=>{
      if(i.kind==='workbuddy')throw Object.assign(new Error('authentication failed'),{code:'AUTH'})
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})
    })
    const r=f.start();await f.engine.settled(r.id)
    const run=f.store.run(r.id)
    expect(run.status).toBe('completed');expect(run.degraded).toBe(true)
    expect(run.participants).toContain('workbuddy');expect(f.group.agents).toEqual(['codex','claude'])
    expect(run.excludedAgents?.[0].category).toBe('authentication')
    expect(run.attempts?.filter(a=>a.kind==='workbuddy')).toHaveLength(1)
    expect(run.verification).toContain('缩减团队')
  })
  test('a failed read-only moderator is replaced by a remaining member',async()=>{
    const f=fixture({agents:['codex','claude','workbuddy'],moderator:'workbuddy'},async i=>{
      if(i.kind==='workbuddy'&&i.prompt.includes('你是只读主持者'))throw new Error('process crashed')
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('completed');expect(f.group.moderator).toBe('codex')
    expect(f.calls.some(i=>i.kind==='codex'&&i.prompt.includes('你是只读主持者'))).toBe(true)
  })
  test('a failed producer is not silently retried under a different writer',async()=>{
    const f=fixture({agents:['codex','claude','workbuddy'],allowWrite:true,executeAfter:true},async i=>{
      if(i.allowWrite)throw new Error('writer crashed after possible writes')
      return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})
    })
    const r=f.start();await f.engine.settled(r.id)
    expect(f.store.run(r.id).status).toBe('partial');expect(f.calls.filter(i=>i.allowWrite)).toHaveLength(1)
    expect(f.group.agents).not.toContain('codex')
  })
  test('cancelling the whole task does not kick healthy agents',async()=>{
    const f=fixture({},i=>new Promise((_resolve,reject)=>i.signal.addEventListener('abort',()=>reject(new Error('cancelled')))))
    const r=f.start();await new Promise(resolve=>setTimeout(resolve,10));await f.engine.stop(r.id)
    expect(f.group.agents).toEqual(['codex','claude']);expect(f.store.run(r.id).excludedAgents).toHaveLength(0)
  })
  test('manually removing one active agent aborts that member and retains per-round failure history',async()=>{
    const f=fixture({agents:['codex','claude','workbuddy']},i=>i.kind==='workbuddy'?new Promise((_resolve,reject)=>i.signal.addEventListener('abort',()=>reject(i.signal.reason))):Promise.resolve(receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})))
    const r=f.start();await new Promise(resolve=>setTimeout(resolve,10));f.engine.removeAgent(r.id,'workbuddy');await f.engine.settled(r.id)
    const run=f.store.run(r.id)
    expect(run.status).toBe('completed');expect(run.excludedAgents?.[0].category).toBe('manual')
    expect(run.attempts?.find(a=>a.kind==='workbuddy')?.events.some(e=>e.type==='removed')).toBe(true)
  })
  test('state persistence failure does not leave a ghost task or start any CLI',()=>{
    const f=fixture();f.store.save=()=>{throw new Error('disk full')}
    expect(()=>f.start()).toThrow('运行记录保存失败')
    expect(f.calls).toHaveLength(0);expect(f.store.state.runs).toHaveLength(0);expect(f.engine.busy(f.group.id)).toBe(false)
    expect(f.group.agents).toEqual(['codex','claude'])
  })
  test('per-round process events survive restart and are never reconstructed from answer text',async()=>{
    const f=fixture({},async i=>{i.onRuntimeEvent?.({type:'tool_start',summary:'开始调用工具',detail:'Read material',progress:true});i.onRuntimeEvent?.({type:'tool_result_summary',summary:'工具执行已返回',progress:true});return receipt(version(i.prompt)?'approve':'ready',{reviewedVersion:version(i.prompt)})})
    const r=f.start();await f.engine.settled(r.id)
    const recovered=new Store(f.store.dataDirectory,f.store.state.settings.defaultDirectory)
    expect(recovered.run(r.id).attempts?.some(a=>a.events.some(e=>e.type==='tool'))).toBe(true)
    expect(recovered.run(r.id).attempts?.[0].round).toBe(1)
  })
})
