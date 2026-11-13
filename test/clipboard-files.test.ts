import {expect,test} from 'vitest'
import {clipboardFilePaths} from '../src/main/clipboard-files'
test('decodes Windows copied file lists without executing or reading their content',()=>{
 const list=Buffer.from('D:\\资料\\合同.docx\0D:\\资料\\计划.pdf\0\0','utf16le')
 expect(clipboardFilePaths(list)).toEqual(['D:\\资料\\合同.docx','D:\\资料\\计划.pdf'])
 const header=Buffer.alloc(20);header.writeUInt32LE(20);header.writeUInt32LE(1,16)
 expect(clipboardFilePaths(Buffer.concat([header,list]),true)).toHaveLength(2)
 expect(clipboardFilePaths(Buffer.alloc(10),true)).toEqual([])
 expect(clipboardFilePaths(Buffer.from('relative.md\0','utf16le'))).toEqual([])
})
