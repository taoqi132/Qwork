import path from 'node:path'
import {createRequire} from 'node:module'
import {AGENT_KINDS,type AgentKind,type CliInstallState,type CliInstallOption} from '../shared/types'
const require=createRequire(path.join(__dirname,'../../package.json'))
const {AgentInstaller,installRecipe,defaultFindCommand}=require('./legacy/src/agents/installer/agent-installer.cjs')
const cli=require('./legacy/src/agents/cli/cli-adapters.cjs')
export const INSTALL_HELP:Record<AgentKind|'node',string>={
 codex:'https://developers.openai.com/codex/cli/',claude:'https://code.claude.com/docs/en/setup',workbuddy:'https://www.codebuddy.cn/docs/cli/installation',openclaw:'https://docs.openclaw.ai/install',qwen:'https://github.com/QwenLM/qwen-code',zcode:'https://zcode.z.ai/',node:'https://nodejs.org/en/download'
}
export const INSTALL_ERRORS:Record<string,string>={
 INSTALL_AGENT_NODE_REQUIRED:'请先安装 Node.js（含 npm），重启 Qwork 后再安装 CLI。',INSTALL_AGENT_BUSY:'已有 CLI 正在安装，请等待或取消。',INSTALL_AGENT_ALREADY_INSTALLED:'已检测到 CLI，请重新检测并检查版本，无需重复安装。',INSTALL_AGENT_PLATFORM_UNSUPPORTED:'当前系统暂不支持快捷安装，请查看官方安装说明。',INSTALL_AGENT_UNSUPPORTED:'该 Agent 暂不支持快捷安装。',INSTALL_AGENT_INTEGRITY_FAILED:'安装包校验未通过或无法访问官方软件源，请查看官方说明。',INSTALL_AGENT_COMMAND_BLOCKED:'本机 npm 安装入口无法验证，请查看官方安装说明。',INSTALL_AGENT_VERIFY_FAILED:'安装进程已结束，但未检测到兼容的 CLI；请重新检测，必要时重启 Qwork。',INSTALL_AGENT_PROCESS_FAILED:'CLI 安装失败，请检查网络、Node.js 环境及目录权限，或查看官方安装说明。',INSTALL_AGENT_FAILED:'CLI 安装失败，请查看官方安装说明。'
}
export function installError(code:string){return INSTALL_ERRORS[code]||INSTALL_ERRORS.INSTALL_AGENT_FAILED}
export class CliInstaller{
 private engine:any
 private platform:string
 private findNpm:()=>Promise<string>
 constructor(private refresh:()=>Promise<unknown>,changed:()=>void,options:Record<string,unknown>={}){
  this.platform=String(options.platform||process.platform)
  this.findNpm=()=>((options.findCommand||defaultFindCommand) as (name:string)=>Promise<string>)(this.platform==='win32'?'npm.cmd':'npm')
  this.engine=new AgentInstaller({detectAgents:()=>cli.detectAgents({kinds:AGENT_KINDS}),...options})
  this.engine.on('changed',(state:CliInstallState)=>{
   changed()
   if(state.phase==='completed')void this.refresh().catch(()=>{}).finally(changed)
  })
 }
 get state():CliInstallState{const state=this.engine.state();return {...state,error:state.errorCode?installError(state.errorCode):''}}
 async catalog():Promise<CliInstallOption[]>{
  const npm=await this.findNpm()
  return AGENT_KINDS.map(kind=>{
   const recipe=installRecipe(kind,this.platform)
   return {kind,packageName:recipe?.packageName||'',version:recipe?.version||'',command:recipe?`npm install --global ${recipe.packageName}@${recipe.version} --registry https://registry.npmjs.org/`:'',supported:!!recipe&&!!npm,reason:!recipe?'该 Agent 暂不支持快捷安装。':!npm?'请先安装 Node.js（含 npm），重启 Qwork 后再安装 CLI。':''}
  })
 }
 async start(kind:AgentKind):Promise<CliInstallState>{
  if(!AGENT_KINDS.includes(kind))throw new Error(INSTALL_ERRORS.INSTALL_AGENT_UNSUPPORTED)
  try{return await this.engine.start(kind)}catch(error:any){throw new Error(installError(error.code))}
 }
 cancel(taskId:string):boolean{return this.engine.cancel(taskId)}
 async shutdown(){this.engine.cancel(this.state.taskId);await this.engine.waitForIdle()}
}
