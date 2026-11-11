import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
const temp=path.resolve('work/test-temp')
fs.mkdirSync(temp,{recursive:true})
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,TEMP:temp,TMP:temp,TMPDIR:temp}})
process.exitCode=await new Promise(resolve=>child.on('exit',code=>resolve(code??1)))
