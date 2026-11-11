import { afterEach, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { AGENT_KINDS } from '../src/shared/types'
const require=createRequire(import.meta.url)
const cli=require('../legacy/src/agents/cli/cli-adapters.cjs')
const {nativeOpenClawOptions}=require('../legacy/src/agents/cli/openclaw-runtime.cjs')
const roots:string[]=[]
for(const allowWeb of [true,false])test(`remaining native web adapters apply ${allowWeb}`,()=>{
 const codex=cli.invocation('codex','fixture','C:\\workspace','',{allowWeb})
 expect(codex.args).toContain(`web_search="${allowWeb?'live':'disabled'}"`)
 const qwen=cli.invocation('qwen','fixture','C:\\workspace','',{allowWeb})
 expect(qwen.args).toContain(allowWeb?'--allowed-tools':'--exclude-tools');expect(qwen.args).toContain('web_search,web_fetch')
 const zcode=cli.invocation('zcode','fixture','C:\\workspace','',{allowWeb})
 expect(zcode.args.includes('--disallowed-tools')).toBe(!allowWeb)
 expect(zcode.args).not.toContain('--allowed-tools')
})
for(const kind of ['codex','claude','qwen'])test(`${kind}: selected model is forwarded as a separate argument`,()=>{
 const spec=cli.invocation(kind,'fixture','C:\\workspace','',{model:'custom/model-1'})
 expect(spec.args[spec.args.indexOf('--model')+1]).toBe('custom/model-1')
})
test('OpenClaw disables web tools in its isolated native configuration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'qwork-web-'));roots.push(root)
 const runtime={model:'fixture/model',provider:{id:'fixture',apiKey:'fixture-test-key',baseUrl:'https://example.com/v1',api:'openai-completions',model:{id:'model',name:'fixture',input:['text'],contextWindow:8000,maxTokens:1000}}}
 const opts=nativeOpenClawOptions({storageRoot:root,workdir:root,allowWeb:false,runtime})
 const config=JSON.parse(fs.readFileSync(opts.env.OPENCLAW_CONFIG_PATH,'utf8'))
 expect(config.tools.allow).not.toContain('web_search');expect(config.tools.deny).toContain('web_fetch')
 expect(config.tools.web.search.enabled).toBe(false)
})
for(const kind of ['claude','workbuddy'])for(const allowWeb of [true,false])test(`${kind}: web authorization ${allowWeb} is narrow and independent of edits`,()=>{
 const spec=cli.invocation(kind,'fixture','C:\\workspace','',{sandbox:'read-only',allowWeb})
 const flag=allowWeb?'--allowedTools':'--disallowedTools'
 const at=spec.args.indexOf(flag)
 expect(at).toBeGreaterThan(0);expect(spec.args[at+1]).toBe('WebSearch,WebFetch')
 expect(spec.args[at+2]).toBe('--permission-mode')
 expect(spec.args[spec.args.indexOf('--permission-mode')+1]).toBe('plan')
 expect(spec.args).not.toContain('--dangerously-skip-permissions')
})
afterEach(async()=>{await cli.shutdownAcpSessionRuntime();for(const p of roots.splice(0))fs.rmSync(p,{recursive:true,force:true})})
const output:Record<string,string>={
  codex:JSON.stringify({type:'thread.started',thread_id:'fixture'})+'\n'+JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'QWORK_OK'}})+'\n'+JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}),
  claude:JSON.stringify({type:'result',subtype:'success',result:'QWORK_OK',session_id:'fixture'}),
  workbuddy:JSON.stringify({type:'result',subtype:'success',result:'QWORK_OK',session_id:'fixture'}),
  qwen:JSON.stringify({type:'result',subtype:'success',result:'QWORK_OK',session_id:'fixture'}),
  zcode:JSON.stringify({sessionId:'fixture',response:'QWORK_OK',projection:{status:'idle',turnCount:1}}),
  openclaw:JSON.stringify({payloads:[{text:'QWORK_OK'}],meta:{aborted:false,completion:{stopReason:'stop',finishReason:'stop'}}})
}
for(const kind of AGENT_KINDS)test(`${kind}: launches a real local fixture process and parses a terminal result`,async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qwork-adapter-'));roots.push(root)
  const executable=path.join(root,`${kind}.cjs`)
  fs.writeFileSync(executable,`#!/usr/bin/env node\nprocess.stdin.resume();setTimeout(()=>{process.stdout.write(${JSON.stringify(output[kind]+'\n')});process.exit(0)},120)`)
  fs.chmodSync(executable,0o755)
  let injected:any={}
  if(kind==='openclaw')injected=nativeOpenClawOptions({storageRoot:root,workdir:root,runtime:{model:'fixture/model',provider:{id:'fixture',apiKey:'fixture-secret-not-a-real-key',baseUrl:'https://example.com/v1',api:'openai-completions',model:{id:'model',name:'fixture',input:['text'],contextWindow:8000,maxTokens:1000}}}})
  const result=await cli.runAgent({kind,executable,name:'fixture'},'Reply QWORK_OK without tools',root,{...injected,sandbox:'read-only',invocationTransport:kind==='openclaw'?'legacy':undefined,signal:AbortSignal.timeout(5000)})
  expect(result.text).toContain('QWORK_OK');expect(result.outcome).toBe('completed')
},10000)
test('Windows Node scripts keep prompt arguments separate from the executable',()=>{
  const prepared=cli.prepareCommand('C:\\agent fixtures\\codex.cjs',['hello & echo unsafe'],{platform:'win32',existsFn:()=>false})
  expect(prepared.command).toBe('node.exe');expect(prepared.args).toEqual(['C:\\agent fixtures\\codex.cjs','hello & echo unsafe'])
})
test('cancelling a real fixture CLI settles and terminates the child process',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'qwork-cancel-'));roots.push(root)
  const executable=path.join(root,'codex.cjs'),pidFile=path.join(root,'pid.txt')
  fs.writeFileSync(executable,`#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.stdin.resume();setInterval(()=>{},1000)`)
  fs.chmodSync(executable,0o755)
  const controller=new AbortController()
  const pending=cli.runAgent({kind:'codex',executable},'test',root,{sandbox:'read-only',signal:controller.signal})
  const rejected=expect(pending).rejects.toThrow('LOCAL_AGENT_EXECUTION_STOPPED')
  for(let n=0;n<100&&!fs.existsSync(pidFile);n++)await new Promise(r=>setTimeout(r,20))
  controller.abort();await rejected
  expect(fs.existsSync(pidFile)).toBe(true)
  const pid=Number(fs.readFileSync(pidFile,'utf8'))
  for(let n=0;n<100;n++){
    try{process.kill(pid,0)}catch{break}
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  expect(()=>process.kill(pid,0)).toThrow()
},10000)
