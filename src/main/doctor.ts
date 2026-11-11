import path from 'node:path'
import fs from 'node:fs'
import { AgentService } from './agents'
const root=path.resolve('work/doctor')
fs.mkdirSync(root,{recursive:true})
async function main(){
  const service=new AgentService(root)
  try{
    const agents=await service.refresh()
    const result={checkedAt:new Date().toISOString(),agents}
    fs.writeFileSync(path.join(root,'status.json'),JSON.stringify(result,null,2))
    console.log(JSON.stringify(result,null,2))
    const requested=process.argv.find(a=>a.startsWith('--test='))?.slice(7)
    if(requested){
      const kind=agents.find(a=>a.kind===requested)?.kind
      if(!kind)throw new Error('未知 Agent')
      const reply=await service.runner({kind,prompt:'This is a user-authorized Qwork connection acceptance test. Reply only QWORK_OK. Do not read files or invoke tools.',workdir:root,allowWrite:false,signal:AbortSignal.timeout(60000),timeoutMs:60000,onProgress:()=>{}})
      const ok=reply.text.includes('QWORK_OK')
      fs.writeFileSync(path.join(root,`live-${kind}.json`),JSON.stringify({kind,ok,checkedAt:new Date().toISOString()},null,2))
      console.log(JSON.stringify({liveTest:kind,ok}))
      if(!ok)process.exitCode=1
    }
  }finally{await service.shutdown()}
}
main().catch(error=>{console.error(error.message);if(error.diagnostic)console.error(error.diagnostic);process.exitCode=1})
