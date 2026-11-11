import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import electron from 'electron'
const output=path.resolve(process.argv[2]||'work/smoke')
await mkdir(output,{recursive:true})
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const child=spawn(electron,['.',`--qwork-smoke=${output}`,...(process.argv.includes('--docs')?['--qwork-docs']:[])],{env,stdio:'inherit',windowsHide:true})
const timer=setTimeout(()=>{child.kill();console.error('Electron smoke test timed out');process.exitCode=1},150000)
const code=await new Promise(resolve=>child.on('exit',resolve));clearTimeout(timer)
if(code!==0){try{console.error(await readFile(path.join(output,'failure.txt'),'utf8'))}catch{}process.exitCode=1}
else console.log(await readFile(path.join(output,'result.json'),'utf8'))
