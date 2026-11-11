import dictionary from './en.json'
import type {Locale} from './locale'
export function translate(text:string,language:Locale,values:Record<string,string|number>={}):string{
 let output=language==='en'?(dictionary as Record<string,string>)[text]||text:text
 if(language==='en'){
  output=output.replace(/^正在进行第 (\d+) 轮讨论$/,'Discussion round $1').replace(/^第 (\d+) 轮 \/ 最多 (\d+) 轮$/,'Round $1 / up to $2')
  output=output.replace(/^(.+) 执行超时$/,'$1 invocation timed out')
    .replace(/^(.+) 未安装，请在设置中重新检测$/,'$1 is not installed. Detect agents again in Settings.')
    .replace(/^(.+) CLI 版本或协议不兼容$/,'$1 CLI version or protocol is incompatible.')
    .replace(/^附件已改变或不可用：(.+)$/,'Attachment changed or unavailable: $1')
    .replace(/^(.+) 执行失败：(.+)$/,'$1 failed: $2')
    .replace(/^WorkBuddy 自定义模型“(.+)”认证失败，请在 WorkBuddy 中检查该模型的 API 凭据与服务配置；这不一定是客户端未登录。$/,'WorkBuddy custom model "$1" authentication failed. Check its API credentials and provider settings in WorkBuddy; desktop sign-in may still be valid.')
 }
 return output.replace(/\{(\w+)\}/g,(match,key)=>values[key]===undefined?match:String(values[key]))
}
