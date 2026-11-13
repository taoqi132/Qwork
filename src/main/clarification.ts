import type {AgentKind,MemberId,Receipt} from '../shared/types'
export class ReplanRequired extends Error{}
export class ClarificationLimit extends Error {constructor(){super('补充后仍缺少关键条件，已暂停本次任务并保留阶段成果。请完善要求后再继续。')}}
export function collectQuestions(turns:{agent?:AgentKind;memberId?:MemberId;receipt:Receipt|null}[]){
 const questions:{question:string;options?:string[];scope?:'task'|'agent';agents:AgentKind[];memberIds:MemberId[]}[]=[]
 const seen=new Map<string,number>()
 for(const turn of turns){
  const source=turn.receipt?.questions?.length?turn.receipt.questions:[{question:turn.receipt?.summary||'请补充本次任务的关键要求',scope:'task' as const}]
  for(const item of source){
   const key=item.question.normalize('NFKC').toLowerCase().replace(/[\s?？。，、：:;；]/g,'')
   const index=seen.get(key)
   if(index!==undefined){const existing=questions[index];if(item.scope!=='agent')existing.scope='task';if(turn.agent&&!existing.agents.includes(turn.agent))existing.agents.push(turn.agent);if(turn.memberId&&!existing.memberIds.includes(turn.memberId))existing.memberIds.push(turn.memberId);existing.options=[...new Set([...(existing.options||[]),...(item.options||[])])].slice(0,6);continue}
   seen.set(key,questions.length);questions.push({question:item.question,options:item.options,scope:item.scope||'task',agents:turn.agent?[turn.agent]:[],memberIds:turn.memberId?[turn.memberId]:[]})
  }
 }
 return questions
}
