import {computed} from 'vue'
import {t} from './i18n'
import type { Mode, Stage, RunStatus } from '../shared/types'
const sourceModes:{id:Mode;number:string;title:string;tag:string;headline:string;description:string;examples:string;steps:string[];icon:string}[]=[
  {id:'auto',number:'01',title:'圆桌讨论',tag:'推荐 · 综合任务',headline:'把复杂任务，交给团队推进。',description:'多个 Agent 共同讨论，由主持者梳理分歧、推动结论，再汇总为可执行方案。',examples:'多资料汇报 / 综合方案 / 项目分析',steps:['共同分析','聚焦分歧','制作与检查'],icon:'orbit'},
  {id:'review',number:'02',title:'制作检查',tag:'制作 + 独立复核',headline:'有人制作，也有人把关。',description:'一位 Agent 负责回答或制作成果，其余已选 Agent 分别独立检查，根据问题修订后交付。',examples:'PPT 制作与美化 / 文档修改 / 代码修复',steps:['制作成果','独立审查','修改交付'],icon:'shield'},
  {id:'sequential',number:'03',title:'接力讨论',tag:'专业接力 · 逐步完善',headline:'让每一份意见，都成为下一步。',description:'Agent 依次阅读前面的意见，补充、纠正并逐步完善方案。',examples:'需求到方案 / 提纲到报告 / 跨角色评审',steps:['逐位发言','接力完善','形成交付'],icon:'layers'},
  {id:'parallel',number:'04',title:'独立分析',tag:'多种视角 · 一次汇总',headline:'同时出发，收获更多可能。',description:'多个 Agent 分别分析同一任务，互不参考首轮回答，再汇总不同观点供你比较。',examples:'创意策划 / 多角度分析 / 方案比较',steps:['独立回答','比较整合','统一制作'],icon:'branches'}
]
export const modes=computed(()=>sourceModes.map(m=>({...m,title:t(m.title),tag:t(m.tag),headline:t(m.headline),description:t(m.description),examples:t(m.examples),steps:m.steps.map(step=>t(step))})))
export const modeName=(id:Mode)=>modes.value.find(m=>m.id===id)?.title||id
const stageLabels:Record<Stage,string>={preparing:'准备资料',discussing:'团队讨论',summarizing:'方案整合',producing:'制作文件',checking:'检查成果',finished:'任务结束'}
const statusLabels:Record<RunStatus,string>={running:'进行中',waiting:'等你决定',completed:'已完成',partial:'阶段成果',failed:'未完成',cancelled:'已停止',interrupted:'已中断'}
export const stages=new Proxy(stageLabels,{get:(target,key:string)=>t(target[key as Stage]||key)})
export const statuses=new Proxy(statusLabels,{get:(target,key:string)=>t(target[key as RunStatus]||key)})
export const bytes=(n:number)=>n>=1024*1024?`${(n/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`
