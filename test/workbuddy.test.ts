import { afterEach, expect, test, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { AgentService } from '../src/main/agents'
const require=createRequire(import.meta.url)
const cli=require('../legacy/src/agents/cli/cli-adapters.cjs')
const before=process.env.CODEBUDDY_CONFIG_DIR
const roots:string[]=[]
afterEach(()=>{vi.restoreAllMocks();if(before===undefined)delete process.env.CODEBUDDY_CONFIG_DIR;else process.env.CODEBUDDY_CONFIG_DIR=before;for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true})})
async function fixture(modelId='demo-model'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qwork-model-'));roots.push(root)
  process.env.CODEBUDDY_CONFIG_DIR=root
  fs.writeFileSync(path.join(root,'models.json'),JSON.stringify({models:[{id:'demo-model',name:'My custom model',apiKey:'fixture-secret-not-real',url:'https://example.com/v1',supportsToolCall:true}]}))
  vi.spyOn(cli,'detectAgents').mockResolvedValue([{kind:'workbuddy',executable:'fixture',version:'2.132.0',compatibilityState:'compatible'}])
  const service=new AgentService(root,()=>modelId);await service.refresh()
  return {root,service,input:{kind:'workbuddy' as const,prompt:'test',workdir:root,allowWrite:false,signal:new AbortController().signal,timeoutMs:5000,onProgress:()=>{}}}
}
test('selected WorkBuddy model participates in readiness and forwards its native configuration',async()=>{
  const {service,input}=await fixture()
  expect(service.catalog.find(a=>a.kind==='workbuddy')?.credential).toBe('ready')
  expect(service.workBuddySettings()).toEqual({modelId:'demo-model',models:[{id:'demo-model',name:'My custom model'}]})
  expect(JSON.stringify(service.workBuddySettings())).not.toContain('fixture-secret')
  const invoke=vi.spyOn(cli,'runAgent').mockResolvedValue({text:'QWORK_OK'})
  await service.runner(input)
  const options=invoke.mock.calls[0][3] as any
  expect(options.env.CODEBUDDY_MODEL).toBe('custom-local:demo-model')
  expect(options.env.CODEBUDDY_API_KEY).toBe('fixture-secret-not-real')
  expect(options.env.CODEBUDDY_BASE_URL).toBe('https://example.com/v1')
})
test('default WorkBuddy authentication error points to model selection rather than claiming desktop logout',async()=>{
  const {service,input}=await fixture('')
  vi.spyOn(cli,'runAgent').mockRejectedValue(Object.assign(new Error('auth'),{code:'LOCAL_AGENT_AUTH_REQUIRED'}))
  await expect(service.runner(input)).rejects.toThrow('选择并保存')
})
test('custom provider authentication failure identifies the selected model and its credentials',async()=>{
  const {service,input}=await fixture()
  vi.spyOn(cli,'runAgent').mockRejectedValue(Object.assign(new Error('auth'),{code:'LOCAL_WORKBUDDY_PROVIDER_AUTH'}))
  await expect(service.runner(input)).rejects.toThrow('demo-model')
})
