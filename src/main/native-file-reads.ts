import path from 'node:path'

// Document bytes remain inside native CLI tools. Authorize complete commands,
// never Python/Bash prefixes; -I ignores Python environment and user modules.
export function nativeFileReads(paths:string[]){
  return [...new Set(paths)].filter(filename=>path.extname(filename).toLowerCase()==='.docx').map(filename=>{
    const encoded=Buffer.from(filename,'utf8').toString('base64')
    const code=`import base64;import zipfile;import sys;z=zipfile.ZipFile(base64.b64decode('${encoded}').decode('utf-8'));i=z.getinfo('word/document.xml');assert i.file_size<=16777216;sys.stdout.buffer.write(z.read(i))`
    return {path:filename,command:`python -I -B -c "${code}"`}
  })
}
