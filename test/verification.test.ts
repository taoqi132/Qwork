import {expect,test} from 'vitest'
import {formatVerification} from '../src/renderer/verification'
test('inline inspection receipts become a list with explicit limitations',()=>{
 expect(formatVerification('实际执行：1) 读取文件；2) 检查内容。未能检查：未渲染页面。')).toBe('实际执行：\n\n1. 读取文件\n2. 检查内容。\n\n**未能检查：** 未渲染页面。')
})
test('existing Markdown and ordinary version numbers stay intact',()=>{
 const text='## 检查\n\n- 已读取\n- 未渲染\n\n版本 1.2，sha256 abc123。'
 expect(formatVerification(text)).toBe(text)
})
