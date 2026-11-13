import {expect,test} from 'vitest'
import type {Receipt} from '../src/shared/types'
import {executionBlocker} from '../src/main/execution-blocker'
const receipt=(summary:string)=>({status:'needs-human',summary,issues:[],nextAgents:[]} as Receipt)
test('distinguishes execution permissions from missing user requirements',()=>{
 expect(executionBlocker(receipt('当前环境的读取工具权限受限'))?.category).toBe('permission')
 expect(executionBlocker({...receipt('请处理连接'),executionIssue:'network'})?.category).toBe('network')
 expect(executionBlocker(receipt('请确认受众是谁？'))).toBeUndefined()
 expect(executionBlocker(receipt('无法读取文件，尚未上传附件'))).toBeUndefined()
 expect(executionBlocker(null)).toBeUndefined()
})
