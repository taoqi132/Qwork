import { z } from 'zod'
import { AGENT_KINDS, type Receipt } from '../shared/types'
const schema=z.object({questions:z.array(z.object({scope:z.enum(['task','agent']).optional(),question:z.string().trim().min(1).max(300),options:z.array(z.string().trim().min(1).max(300)).max(6).optional()})).max(6).optional(),summary:z.string().max(1200),status:z.enum(['continue','ready','approve','needs-human']),issues:z.array(z.string().max(1000)).max(20).default([]),nextAgents:z.array(z.enum(AGENT_KINDS)).max(6).default([]),reviewedVersion:z.string().max(100).optional(),verification:z.string().max(3000).optional()})
export function parseReceipt(raw:string):{text:string;receipt:Receipt|null}{
  const start=raw.lastIndexOf('[[QWORK_RECEIPT:')
  if(start<0)return {text:raw,receipt:null}
  const end=raw.indexOf(']]',start)
  if(end<0)return {text:raw,receipt:null}
  const text=(raw.slice(0,start)+raw.slice(end+2)).trim()
  try{return {text,receipt:schema.parse(JSON.parse(raw.slice(start+16,end)))}}catch{return {text,receipt:null}}
}
export const receiptInstruction='结束时附一条控制回执（正文之外，不要放在代码块中）：[[QWORK_RECEIPT:{"summary":"简明结论","status":"continue","issues":[],"nextAgents":[]}]]。status 可为 continue（仍有问题）、ready（方案可制作）、approve（认可指定版本）、needs-human（缺少关键决定）。审查或确认时仅在实际检查且认可后使用 approve，并添加 reviewedVersion，必须等于本次提供的版本号。verification 描述实际检查及无法检查的范围；不得声称未执行的检查。回执内容只报告当前事实。只有缺少会实质改变目标、范围、正确性或交付方式的关键条件，且无法从已有信息解决时，才用 needs-human，并在 questions 中提供具体问题和可选 options。questions 每项可用 scope 指定影响范围：task 表示受众、目标、范围、数据口径、交付形式等全局要求（默认），agent 仅用于不改变其他成员任务的局部问题。把所有关键问题一次列出，最多 6 个；不要把普通偏好、可采用合理默认值的细节反复交给用户。非关键细节用合理默认值继续，并简短说明。关键条件不清楚时，先提出问题，不要先写入文件或编造答案。用户已回答的问题应直接采用，不得重复询问，除非指出具体矛盾或仍缺失的关键条件。不能请求用户提供密码或 API 密钥。'
