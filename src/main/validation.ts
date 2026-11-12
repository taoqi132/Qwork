import { z } from 'zod'
import { AGENT_KINDS } from '../shared/types'
export const kindSchema = z.enum(AGENT_KINDS)
export const idSchema = z.string().uuid()
export const modeSchema = z.enum(['review','parallel','sequential','auto'])
export const settingsSchema = z.object({agentModels:z.object({codex:z.string().trim().max(120).regex(/^[A-Za-z0-9._:/@+\-]*$/).optional(),claude:z.string().trim().max(120).regex(/^[A-Za-z0-9._:/@+\-]*$/).optional(),qwen:z.string().trim().max(120).regex(/^[A-Za-z0-9._:/@+\-]*$/).optional()}).strict().optional(),allowWeb:z.boolean().optional(),themePreference:z.enum(['system','light','dark']).optional(),defaultDirectory:z.string().min(1).max(1000),maxRounds:z.number().int().min(1).max(8),locale:z.enum(['zh','en']),timeoutMinutes:z.number().int().min(1).max(120),workBuddyModelId:z.string().max(120).optional(),languagePreference:z.enum(['system','zh','en']).optional(),noExecutionTimeoutMinutes:z.number().int().min(1).max(120).optional()}).strict()
export const groupSchema = z.object({
  name:z.string().max(60),goal:z.string().max(2000),kind:z.enum(['group','direct']),
  agents:z.array(kindSchema).min(1).max(6).refine(v=>new Set(v).size===v.length),
  workdir:z.string().max(1000),allowWrite:z.boolean(),mode:modeSchema,maxRounds:z.number().int().min(1).max(8),
  moderator:kindSchema,summarizer:kindSchema,executor:kindSchema,executeAfter:z.boolean(),recommended:z.boolean()
}).strict().superRefine((v,ctx)=>{
  if(v.kind==='direct'&&v.agents.length!==1)ctx.addIssue({code:'custom',message:'单聊只能选择一位 Agent'})
  if(v.kind==='group'&&v.agents.length<2)ctx.addIssue({code:'custom',message:'群聊至少选择两位 Agent'})
  for(const field of ['moderator','summarizer','executor'] as const) if(!v.agents.includes(v[field]))ctx.addIssue({code:'custom',message:'角色必须属于已选团队'})
})
export const sendSchema = z.object({groupId:idSchema,text:z.string().trim().min(1).max(20000),attachmentIds:z.array(idSchema).max(10),mode:modeSchema}).strict()
