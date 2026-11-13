import { z } from 'zod'
import { AGENT_KINDS } from '../shared/types'
import { normalizeMembers } from '../shared/agent-members'
export const kindSchema = z.enum(AGENT_KINDS)
export const idSchema = z.string().uuid()
export const memberIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)
const modelPattern = /^[A-Za-z0-9._:/@+\-]*$/
const memberSchema = z.object({id:memberIdSchema,kind:kindSchema,model:z.string().trim().max(120).optional()}).strict()
export const modeSchema = z.enum(['review','parallel','sequential','auto'])
export const settingsSchema = z.object({agentModels:z.object({codex:z.string().trim().max(120).regex(modelPattern).optional(),claude:z.string().trim().max(120).regex(modelPattern).optional(),qwen:z.string().trim().max(120).regex(modelPattern).optional()}).strict().optional(),allowWeb:z.boolean().optional(),themePreference:z.enum(['system','light','dark']).optional(),defaultDirectory:z.string().min(1).max(1000),maxRounds:z.number().int().min(1).max(8),locale:z.enum(['zh','en']),timeoutMinutes:z.number().int().min(1).max(120),workBuddyModelId:z.string().max(120).optional(),languagePreference:z.enum(['system','zh','en']).optional(),noExecutionTimeoutMinutes:z.number().int().min(1).max(120).optional()}).strict()
const rawGroupSchema = z.object({
  name:z.string().max(60),goal:z.string().max(2000),kind:z.enum(['group','direct']),
  agents:z.array(z.union([kindSchema,memberSchema])).min(1),
  workdir:z.string().max(1000),allowWrite:z.boolean(),mode:modeSchema,maxRounds:z.number().int().min(1).max(8),
  moderator:memberIdSchema,summarizer:memberIdSchema,executor:memberIdSchema,executeAfter:z.boolean(),recommended:z.boolean()
}).strict()
export const groupSchema = rawGroupSchema.transform(input=>({...input,agents:normalizeMembers(input.agents)})).superRefine((v,ctx)=>{
  const ids=new Set(v.agents.map(member=>member.id))
  if(ids.size!==v.agents.length)ctx.addIssue({code:'custom',path:['agents'],message:'成员实例不能重复'})
  const counts=new Map<string,number>()
  for(const member of v.agents){
    const count=(counts.get(member.kind)||0)+1
    counts.set(member.kind,count)
    if(count>2)ctx.addIssue({code:'custom',path:['agents'],message:'同一个 Agent 最多选择两个实例'})
    if(member.id!==member.kind&&member.id!==`${member.kind}-2`)ctx.addIssue({code:'custom',path:['agents'],message:'成员实例标识无效'})
    const model=member.model?.trim()||''
    if(model&&['zcode','openclaw'].includes(member.kind))ctx.addIssue({code:'custom',path:['agents'],message:'该 Agent 不支持在群聊中指定模型'})
    if(model&&['codex','claude','qwen'].includes(member.kind)&&!modelPattern.test(model))ctx.addIssue({code:'custom',path:['agents'],message:'模型 ID 只能包含字母、数字和 . _ : / @ + -'})
  }
  if((counts.get('openclaw')||0)>1)ctx.addIssue({code:'custom',path:['agents'],message:'OpenClaw 暂不支持复制：两个实例会共用运行时配置，可能互相覆盖。'})
  if(v.kind==='direct'&&v.agents.length!==1)ctx.addIssue({code:'custom',message:'单聊只能选择一位 Agent'})
  if(v.kind==='group'&&v.agents.length<2)ctx.addIssue({code:'custom',message:'群聊至少选择两位 Agent'})
  for(const field of ['moderator','summarizer','executor'] as const) if(!ids.has(v[field]))ctx.addIssue({code:'custom',message:'角色必须属于已选成员'})
})
export const sendSchema = z.object({groupId:idSchema,text:z.string().trim().min(1).max(20000),attachmentIds:z.array(idSchema).max(10),mode:modeSchema}).strict()