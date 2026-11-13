import {afterEach,expect,test,vi} from 'vitest'
import {createRequire} from 'node:module'
import {CliInstaller} from '../src/main/cli-installer'
const require=createRequire(import.meta.url)
const {installRecipe,prepareInstallCommand,installEnvironment}=require('../legacy/src/agents/installer/agent-installer-contract.cjs')
afterEach(()=>vi.restoreAllMocks())
function fixture(overrides:Record<string,unknown>={}){
 let installed=false
 const runProcess=vi.fn(async()=>{installed=true})
 const refresh=vi.fn(async()=>{}),changed=vi.fn()
 const installer=new CliInstaller(refresh,changed,{
  platform:'darwin',findCommand:async()=>'/usr/bin/npm',
  detectAgents:async()=>installed?[{kind:'codex',version:installRecipe('codex','darwin').version,compatibilityState:'compatible'}]:[],
  verifyNpmIntegrity:async()=>{},runProcess,...overrides
 })
 return {installer,runProcess,refresh,changed}
}
test('installs only a pinned package, verifies it, then refreshes Qwork detection',async()=>{
 const f=fixture()
 await f.installer.start('codex')
 await vi.waitFor(()=>expect(f.installer.state.phase).toBe('completed'))
 expect(f.runProcess).toHaveBeenCalledWith('/usr/bin/npm',['install','--global',`@openai/codex@${installRecipe('codex','darwin').version}`,'--registry','https://registry.npmjs.org/'],expect.anything())
 expect(f.refresh).toHaveBeenCalledTimes(1)
 await f.installer.shutdown()
})
test('Windows runs a verified npm launcher through node with fixed arguments and no shell',async()=>{
 const f=fixture({platform:'win32',findCommand:async()=>String.raw`C:\Program Files\nodejs\npm.cmd`,readCommandFile:()=>String.raw`"%~dp0\node_modules\npm\bin\npm-cli.js"`,commandPathExists:()=>true})
 await f.installer.start('codex')
 await vi.waitFor(()=>expect(f.installer.state.phase).toBe('completed'))
 expect(f.runProcess).toHaveBeenCalledWith(String.raw`C:\Program Files\nodejs\node.exe`,[String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`,'install','--global',`@openai/codex@${installRecipe('codex','win32').version}`,'--registry','https://registry.npmjs.org/'],expect.anything())
 await f.installer.shutdown()
})
test('failed integrity prevents execution and completion is never inferred',async()=>{
 const f=fixture({verifyNpmIntegrity:async()=>{throw Error('mismatch')}})
 await f.installer.start('codex')
 await vi.waitFor(()=>expect(f.installer.state.phase).toBe('failed'))
 expect(f.installer.state.errorCode).toBe('INSTALL_AGENT_INTEGRITY_FAILED')
 expect(f.runProcess).not.toHaveBeenCalled();expect(f.refresh).not.toHaveBeenCalled()
})
test('an installation is failed if the command exits but no compatible CLI appears',async()=>{
 const f=fixture({detectAgents:async()=>[]})
 await f.installer.start('codex')
 await vi.waitFor(()=>expect(f.installer.state.phase).toBe('failed'))
 expect(f.installer.state.errorCode).toBe('INSTALL_AGENT_VERIFY_FAILED')
 expect(f.refresh).not.toHaveBeenCalled()
})
test('cancellation is task-bound and a second installation cannot overlap',async()=>{
 const f=fixture({runProcess:(_command:string,_args:string[],{signal}:any)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{name:'AbortError'}))))})
 await f.installer.start('codex')
 await vi.waitFor(()=>expect(f.installer.state.phase).toBe('installing'))
 await expect(f.installer.start('claude')).rejects.toThrow('已有 CLI')
 expect(f.installer.cancel('wrong-task')).toBe(false)
 expect(f.installer.cancel(f.installer.state.taskId)).toBe(true)
 await f.installer.shutdown()
 expect(f.installer.state.phase).toBe('cancelled')
})
test('no npm and unsupported agents fail before a process is launched',async()=>{
 const f=fixture({findCommand:async()=>''})
 await expect(f.installer.start('codex')).rejects.toThrow('Node.js')
 await expect(f.installer.start('zcode')).rejects.toThrow('暂不支持')
 await expect(f.installer.start('hermes' as any)).rejects.toThrow('暂不支持')
 expect(installRecipe('hermes','win32')).toBeNull()
 expect(f.runProcess).not.toHaveBeenCalled()
 const catalog=await f.installer.catalog()
 expect(catalog).toHaveLength(6)
 expect(catalog.find(a=>a.kind==='codex')?.reason).toContain('Node.js')
 expect(catalog.find(a=>a.kind==='zcode')?.supported).toBe(false)
})
test('Windows npm launcher is validated and credentials are stripped from installers',()=>{
 expect(()=>prepareInstallCommand('C:\\untrusted.cmd',[],{platform:'win32'})).toThrow('BLOCKED')
 expect(()=>prepareInstallCommand('C:\\node\\npm.cmd',[],{platform:'win32',readFileFn:()=> 'echo unexpected',existsFn:()=>true})).toThrow('BLOCKED')
 const env=installEnvironment('win32',{PATH:'C:\\node',CODEBUDDY_API_KEY:'private',OPENAI_API_KEY:'private',API_TOKEN:'private',SystemRoot:'C:\\Windows'})
 expect(JSON.stringify(env)).not.toContain('private')
})
