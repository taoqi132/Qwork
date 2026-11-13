import {test,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {nativeFileReads} from '../src/main/native-file-reads'
const require=createRequire(import.meta.url)
const cli=require('../legacy/src/agents/cli/cli-adapters.cjs')
test('native document commands read DOCX without modifying it and grant only exact commands',()=>{
 const root=fs.mkdtempSync(path.resolve('work','native-read-'))
 try{
  const filename=path.join(root,"资料 ' & $ 合同.docx")
  const encoded=Buffer.from(filename).toString('base64')
  execFileSync('python',['-I','-B','-c',`import zipfile;import base64;z=zipfile.ZipFile(base64.b64decode('${encoded}').decode(),'w');z.writestr('word/document.xml','<document>fixture body</document>');z.close()`])
  const before=fs.readFileSync(filename)
  const reads=nativeFileReads([filename,filename,path.join(root,'other.txt')])
  expect(reads).toHaveLength(1)
  const command=reads[0].command,code=command.slice(command.indexOf('"')+1,-1)
  expect(execFileSync('python',['-I','-B','-c',code],{encoding:'utf8'})).toContain('fixture body')
  expect(fs.readFileSync(filename)).toEqual(before)
  expect(fs.readdirSync(root)).toHaveLength(1)
  for(const kind of ['claude','workbuddy']){
   const spec=cli.invocation(kind,'fixture',root,'',{sandbox:'read-only',readCommands:[command]})
   const allowed=spec.args[spec.args.indexOf('--allowedTools')+1]
   expect(allowed.split(',')).toContain(`Bash(${command})`)
   expect(allowed.split(',')).not.toContain('Bash')
   expect(allowed).not.toContain('python:*')
  }
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
