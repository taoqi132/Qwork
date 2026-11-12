import type {RuntimeSignal} from '../shared/types'
/** Only public summaries are traceable. Prompts, arguments, raw output and private reasoning are excluded. */
export function publicRuntimeSignal(event:{type?:string;title?:string;summary?:string;status?:string;detail?:string},clean:(text:string)=>string):RuntimeSignal|null{
 const type=event.type
 if(type==='reasoning_summary'||type==='answer_delta'||type==='plan')return null
 if(!['status','tool_start','tool_update','tool_result_summary','warning'].includes(type||''))return null
 const labels:Record<string,string>={status:'CLI 状态已更新',tool_start:'开始调用工具',tool_update:'工具仍在执行',tool_result_summary:'工具执行已返回',warning:'CLI 提醒'}
 const safe=(value:string)=>clean(value).replace(/(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/)[^\s"'<>]+/g,'[local path]').slice(0,1000)
 return {type:type as RuntimeSignal['type'],summary:labels[type!],detail:safe([event.title,event.summary,event.status].filter(Boolean).join(' · ')),progress:type==='tool_start'||type==='tool_update'||type==='tool_result_summary'}
}
export function diagnosticFailure(text:string):RuntimeSignal|null{
 // Never publish stderr itself: partial credentials may straddle chunks.
 if(/(?:(?:HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?|API error)\s*[:=]?\s*(?:401|403)\b|authentication (?:failed|required)|not (?:logged|signed) in|invalid api.?key|missing api.?key|Unauthorized|未登录|认证失败)/i.test(text))return {type:'failure',summary:'CLI 报告认证失败，请检查所选模型的原生凭据。',code:'AGENT_AUTH_FAILURE',category:'authentication',fatal:true}
 if(/(?:(?:HTTP(?:\/\d(?:\.\d)?)?|status(?: code)?|API error)\s*[:=]?\s*429\b|rate.?limit exceeded|too many requests|限流)/i.test(text))return {type:'failure',summary:'CLI 报告请求限流，本次调用已停止。',code:'AGENT_RATE_LIMIT',category:'rate-limit',fatal:true}
 if(/(?:ECONNREFUSED|ENOTFOUND|unable to connect|connection refused)/i.test(text))return {type:'failure',summary:'CLI 报告网络连接失败，本次调用已停止。',code:'AGENT_CONNECTION_FAILURE',category:'network',fatal:true}
 return null
}
