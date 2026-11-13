<script setup lang="ts">
import AgentLogo from './AgentLogo.vue'
import {t,locale} from '../i18n'

import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import type { AgentKind, Attachment, Group, MemberId, Mode, ProgressEvent, Run, SendInput, Snapshot } from '../../shared/types'
import { memberDisplayNameById } from '../../shared/agent-members'
import { bytes, modeName, modes, stages, statuses } from '../content'
import Icon from './Icon.vue'
import RunProgress from './CollaborationGraph.vue'
import AgentTraceDrawer from './AgentTraceDrawer.vue'
import {enterAction} from '../interactions'
import {roundResponses} from '../round-responses'
import {finalAnswer} from '../final-answer'
import Markdown from './Markdown.vue'
import {formatVerification} from '../verification'
import {resolveArtifactLink} from '../artifact-links'
import {agentStatus,latestAttempt,activityStatus} from '../agent-status'
const props=defineProps<{group:Group;snapshot:Snapshot;progress:Record<string,ProgressEvent>}>()
const emit=defineEmits<{edit:[];send:[input:SendInput];stop:[id:string];decide:[id:string,response:string];attach:[];open:[id:string];output:[id:string];export:[id:string];notify:[message:string];createGroup:[]}>()
const draft=ref(''),decision=ref(''),mode=ref<Mode>(props.group.mode),selectedRun=ref(''),selectedAttachments=ref<string[]>([]),showOutput=ref(false)
const transcript=ref<HTMLElement>()
const traceMemberId=ref<MemberId>()
const decisionDialog=ref<HTMLDialogElement>()
const clarificationAnswers=ref<Record<number,string>>({})
const clarificationReady=computed(()=>!!active.value?.gate?.questions?.length&&active.value.gate.questions.every((_,i)=>!!clarificationAnswers.value[i]?.trim()))
async function submitClarification(){if(!clarificationReady.value)return;const questions=active.value?.gate?.questions||[];await submitDecision(questions.map((q,i)=>`${i+1}. ${q.question}\n答：${clarificationAnswers.value[i].trim()}`).join('\n\n'))}
const decisionPending=ref(false)
async function submitDecision(value:string){if(!active.value||decisionPending.value||!value.trim())return;decisionPending.value=true;try{await window.qwork!.decide(active.value.id,value,active.value.gate?.id);decision.value=''}catch(error:any){emit('notify',error.message)}finally{decisionPending.value=false}}

function openMarkdownLink(href:string){
  const artifact=run.value&&resolveArtifactLink(href,run.value,artifacts.value)
  if(artifact){emit('open',artifact.id);return}
  emit('notify',t('未找到对应的交付文件，请查看右侧交付文件或打开成果目录。'))
}
async function toggleReply(id:string){
  const open=!isExpanded(id)
  expanded.value=Object.fromEntries(messages.value.filter(m=>m.role==='agent').map(m=>[m.id,open&&m.id===id]))
  if(!open)return
  await scrollReply(id)
}
async function scrollReply(id:string){
  await nextTick()
  const container=transcript.value
  const reply=container?.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
  if(container&&reply)container.scrollTo({top:container.scrollTop+reply.getBoundingClientRect().top-container.getBoundingClientRect().top-8,behavior:'instant'})
}
const runs=computed(()=>props.snapshot.runs.filter(r=>r.groupId===props.group.id).slice().reverse())
const run=computed(()=>runs.value.find(r=>r.id===selectedRun.value)||runs.value[0])
const currentStageName=computed(()=>run.value?.mode==='review'&&run.value.delivery==='text'&&run.value.stage==='discussing'?t('回答问题'):run.value?stages[run.value.stage]:'')
const active=computed(()=>runs.value.find(r=>['running','waiting'].includes(r.status)))
watch(()=>active.value?.gate?.id,async id=>{clarificationAnswers.value={};decision.value='';await nextTick();if(id)decisionDialog.value?.showModal();else decisionDialog.value?.close()},{immediate:true})
const messages=computed(()=>props.snapshot.messages.filter(m=>m.groupId===props.group.id&&m.runId===run.value?.id))
const artifacts=computed(()=>props.snapshot.artifacts.filter(a=>a.runId===run.value?.id))
const attachments=computed(()=>props.snapshot.attachments.filter(a=>a.groupId===props.group.id))
const importedCount=ref(0)
watch(()=>props.group.id,()=>{traceMemberId.value=undefined;draft.value='';decision.value='';mode.value=props.group.mode;selectedRun.value='';selectedAttachments.value=[];importedCount.value=attachments.value.length})
watch(()=>run.value?.id,()=>{showOutput.value=false})
watch(()=>artifacts.value.length,n=>{if(!n)showOutput.value=false})
const revealedOutputs=new Set<string>()
watch(()=>[run.value?.id,run.value?.status,artifacts.value.length],()=>{const current=run.value;if(current&&artifacts.value.length&&!['running','waiting'].includes(current.status)&&!revealedOutputs.has(current.id)){revealedOutputs.add(current.id);showOutput.value=true}},{immediate:true})
watch(()=>runs.value[0]?.id,id=>{if(id)selectedRun.value=id})
watch(()=>attachments.value.length,length=>{
  if(length>importedCount.value)selectedAttachments.value=[...new Set([...selectedAttachments.value,...attachments.value.slice(importedCount.value).map(a=>a.id)])].slice(-10)
  importedCount.value=length
})
watch(()=>messages.value.length,async()=>{await nextTick();if(run.value&&['running','waiting'].includes(run.value.status))transcript.value?.scrollTo({top:transcript.value.scrollHeight,behavior:'smooth'})})
function toggleAttachment(a:Attachment){selectedAttachments.value=selectedAttachments.value.includes(a.id)?selectedAttachments.value.filter(id=>id!==a.id):[...selectedAttachments.value,a.id].slice(-10)}
const supplementPending=ref(false)
const canSupplement=computed(()=>props.group.kind==='group'&&active.value?.status==='running')
async function send(){
 if(!draft.value.trim()||importing.value||roundsSaving.value||supplementPending.value)return
 if(active.value){
  if(!canSupplement.value)return
  const text=draft.value.trim(),id=active.value.id;supplementPending.value=true
  try{await window.qwork!.supplement(id,text);if(draft.value.trim()===text)draft.value='';emit('notify',t('已收到补充，将在当前步骤结束后生效。'))}catch(error:any){emit('notify',error.message)}finally{supplementPending.value=false}
  return
 }
 emit('send',{groupId:props.group.id,text:draft.value.trim(),attachmentIds:[...selectedAttachments.value],mode:mode.value})
}
// Parent clears the composer only after the backend accepted the task.
async function retry(id:string){try{await window.qwork!.retryExecution(id)}catch(error:any){emit('notify',error.message)}}
function accepted(){draft.value='';selectedAttachments.value=[]}
async function focusRun(id:string){selectedRun.value=id;await nextTick();if(active.value?.gate&&!decisionDialog.value?.open)decisionDialog.value?.showModal()}
defineExpose({accepted,focusRun})
const time=(value:string)=>new Date(value).toLocaleTimeString(locale.value==='zh'?'zh-CN':'en-US',{hour:'2-digit',minute:'2-digit'})
function beginsRound(id:string){const items=messages.value.filter(m=>m.role==='agent');const i=items.findIndex(m=>m.id===id);return i>=0&&(i===0||items[i-1].round!==items[i].round||(items[i-1].contextRevision||0)!==(items[i].contextRevision||0))}
function clarifiedRoundStart(id:string){const items=messages.value.filter(m=>m.role==='agent');const i=items.findIndex(m=>m.id===id);return i>0&&items[i-1].round===items[i].round&&(items[i-1].contextRevision||0)<(items[i].contextRevision||0)}
const latestMessageId=computed(()=>messages.value.filter(m=>m.role==='agent').at(-1)?.id)
const expanded=ref<Record<string,boolean>>({})
function isExpanded(id:string){return expanded.value[id]??id===latestMessageId.value}
const presentedAnswers=new Set<string>()
watch(()=>[run.value?.id,run.value?.status,messages.value.length,artifacts.value.length],async()=>{
  const current=run.value
  if(!current||['running','waiting'].includes(current.status)||artifacts.value.length||presentedAnswers.has(current.id))return
  const answer=finalAnswer(current,messages.value)
  if(!answer)return
  presentedAnswers.add(current.id)
  expanded.value=Object.fromEntries(messages.value.filter(m=>m.role==='agent').map(m=>[m.id,m.id===answer.id]))
  await scrollReply(answer.id)
},{immediate:true})
function suggestion(){if(props.group.kind==='direct')emit('createGroup');else draft.value=t("请读取附件资料，制作一份汇报 PPT，并检查实际文件。")}
function composerKey(event:KeyboardEvent){const action=enterAction(event);if(action==='none')return;event.preventDefault();if(action==='send'){send();return}const input=event.target as HTMLTextAreaElement;const start=input.selectionStart,end=input.selectionEnd;draft.value=draft.value.slice(0,start)+'\n'+draft.value.slice(end);nextTick(()=>input.setSelectionRange(start+1,start+1))}
const responding=computed(()=>Object.values(props.progress).filter(p=>p.runId===run.value?.id&&p.stage===run.value?.stage&&p.text).map(p=>p.memberId||p.agent))
const liveMemberId=ref<MemberId>()
const memberList=computed(()=>run.value?.participants||props.group.agents)
function memberName(id?:MemberId,kind?:AgentKind){return memberDisplayNameById(id,kind,memberList.value)}
function questionNames(question:{agents:AgentKind[];memberIds?:MemberId[]}){return (question.memberIds?.length?question.memberIds.map(id=>memberName(id)):question.agents.map(kind=>memberName(undefined,kind))).join(' · ')}
const streams=computed(()=>roundResponses(run.value,messages.value,props.progress))
const latestProgress=computed(()=>streams.value.find(e=>e.memberId===liveMemberId.value)||streams.value[0])
watch([()=>run.value?.id,()=>run.value?.round],()=>{liveMemberId.value=undefined})
watch(()=>streams.value.map(s=>s.memberId).join(','),()=>{if(!streams.value.some(s=>s.memberId===liveMemberId.value))liveMemberId.value=streams.value[0]?.memberId},{immediate:true})
const importing=ref(false),dragDepth=ref(0)
function dragEnter(event:DragEvent){if(event.dataTransfer?.types.includes('Files')){event.preventDefault();dragDepth.value++}}
function dragLeave(event:DragEvent){if(event.dataTransfer?.types.includes('Files'))dragDepth.value=Math.max(0,dragDepth.value-1)}
async function attachFiles(files:File[]){
 if(active.value||importing.value){emit('notify',t('请在当前任务结束后添加附件'));return}
 importing.value=true
 try{await window.qwork!.importFiles(props.group.id,files)}catch(e:any){emit('notify',e.message)}finally{importing.value=false}
}
async function dropFiles(event:DragEvent){dragDepth.value=0;if(!event.dataTransfer?.files.length)return;event.preventDefault();await attachFiles(Array.from(event.dataTransfer.files))}
async function pasteFiles(event:ClipboardEvent){
 const files=Array.from(event.clipboardData?.files||[])
 if(!files.length&&event.clipboardData?.getData('text/plain'))return
 if(files.length)event.preventDefault()
 if(active.value||importing.value){if(files.length)emit('notify',t('请在当前任务结束后添加附件'));return}
 if(files.length&&!files.every(f=>f.type.startsWith('image/'))){await attachFiles(files);return}
 importing.value=true
 try{await window.qwork!.pasteAttachments(props.group.id)}catch(e:any){emit('notify',e.message)}finally{importing.value=false}
}
function closeRounds(event:PointerEvent){if(!(event.target as Element).closest('.rounds-control'))roundsOpen.value=false}
onMounted(()=>document.addEventListener('pointerdown',closeRounds))
onUnmounted(()=>document.removeEventListener('pointerdown',closeRounds))
const roundsOpen=ref(false),roundsDraft=ref(8),roundsSaving=ref(false)
const roundsMode=computed(()=>active.value?.mode||mode.value)
const roundsMin=computed(()=>active.value?Math.max(1,active.value.round+1):1)
const roundsLimit=computed(()=>active.value?.maxRounds||props.group.maxRounds)
const canAdjust=computed(()=>props.group.kind==='group'&&roundsMode.value!=='parallel'&&(!active.value||active.value.status==='running'&&(['preparing','discussing','summarizing'].includes(active.value.stage)||active.value.mode==='review'&&['producing','checking'].includes(active.value.stage))&&active.value.round<8))
const roundsHint=computed(()=>active.value?t(roundsMode.value==='review'?'运行中可调整最大检查轮数；新上限须大于当前轮数，最多 8 轮。':'任务运行中可调整最大讨论轮数；新上限须大于当前轮数，最多 8 轮。'):t('开始前可设置 1—8 轮，松开滑块即保存。'))
function toggleRounds(){roundsDraft.value=Math.min(8,Math.max(roundsMin.value,roundsLimit.value));roundsOpen.value=!roundsOpen.value}
watch(()=>mode.value,()=>roundsOpen.value=false)

watch(()=>active.value?.id,()=>roundsOpen.value=false)
watch(canAdjust,allowed=>{if(!allowed)roundsOpen.value=false})
let pendingRounds:number|undefined
async function saveRounds(){
 pendingRounds=roundsDraft.value
 if(roundsSaving.value||!canAdjust.value)return
 const runId=active.value?.id,groupId=props.group.id;roundsSaving.value=true
 try{while(pendingRounds!==undefined&&props.group.id===groupId&&active.value?.id===runId){
  const value=pendingRounds;pendingRounds=undefined
  if(runId)await window.qwork!.adjustRounds(runId,value)
  else await window.qwork!.setGroupRounds(groupId,value)
 }}
 catch(error:any){pendingRounds=undefined;roundsDraft.value=roundsLimit.value;emit('notify',error.message)}
 finally{roundsSaving.value=false}
}

</script>
<template>
<section class="workspace" @dragenter="dragEnter" @dragleave="dragLeave" @dragover.prevent @drop="dropFiles" @paste="pasteFiles"><div v-if="dragDepth" class="file-drop-overlay">{{ active?t('请在当前任务结束后添加附件'):t('松开以添加附件') }}</div>
  <header class="workspace-header"><div class="workspace-title"><span class="workspace-icon"><Icon :name="group.kind==='direct'?'chat':'group'"/></span><div><h1>{{ group.name }}</h1></div></div><div class="header-actions">      <div v-if="runs.length" class="run-selector"><span class="eyebrow">{{ t("任务记录") }}</span><select v-model="selectedRun"><option v-for="r in runs" :key="r.id" :value="r.id">{{ r.task.slice(0,38) }} · {{ statuses[r.status] }}</option></select></div><button class="button subtle" :disabled="!!active" @click="emit('edit')"><Icon name="settings" :size="16"/>{{ group.kind==='direct'?t("对话设置"):t("群聊设置") }}</button><button v-if="artifacts.length" class="icon-button" :aria-expanded="showOutput" aria-controls="deliverables-panel" :title="showOutput?t('收起成果面板'):t('展开成果面板')" :aria-label="showOutput?t('收起成果面板'):t('展开成果面板')" @click="showOutput=!showOutput"><Icon :name="showOutput?'panel-close':'panel-open'"/></button></div></header>
  <RunProgress v-if="group.kind!=='direct'" :group="group" :run="run" :responding="responding" @inspect="memberId=>traceMemberId=memberId"/>
  <div class="workspace-layout" :class="{'without-output':!showOutput||!artifacts.length}">
    <div class="conversation-column">

      <div ref="transcript" class="conversation-scroll">
        <div v-if="!run" class="conversation-empty"><span class="empty-symbol"><Icon name="spark" :size="32"/></span><h2>{{ group.kind==='direct'?t("开始你的对话"):t("给团队一个目标，把成果带回来。") }}</h2><p>{{ group.goal||(group.kind==='direct'?t("直接提问，或添加资料让这位 Agent 帮你处理。"):t("描述你想完成的任务，附上相关资料。团队会根据所选模式协作。")) }}</p><div class="task-suggestion" @click="suggestion" role="button" tabindex="0" @keydown.enter="suggestion"><Icon name="file" :size="19"/><span>{{ group.kind==='direct'?t("需要多方讨论？创建群聊制作汇报 PPT"):t("试试：用一批项目资料，完成一份汇报 PPT") }}</span><Icon name="arrow" :size="16"/></div></div>
        <template v-if="run">
          <article class="task-brief"><div class="label-row"><span class="eyebrow">{{ t("本次任务") }}</span><time>{{ time(run.startedAt) }}</time></div><p>{{ run.task }}</p><div v-if="run.attachmentIds.length" class="brief-files"><span v-for="id in run.attachmentIds" :key="id"><Icon name="attach" :size="13"/>{{ snapshot.attachments.find(a=>a.id===id)?.name||t("历史附件") }}</span></div></article>
          <div v-if="group.kind==='direct'&&(run.error||run.issues.length)" class="direct-issues" role="alert"><p v-if="run.error">{{ t(run.error) }}</p><ul v-if="run.issues.length"><li v-for="(issue,i) in run.issues" :key="i">{{ t(issue) }}</li></ul></div>
          <section v-if="group.kind==='group'" class="overview-card compact-overview" :class="{attention:run.status==='waiting'||run.status==='partial'}"><div class="label-row"><h3><Icon name="orbit" :size="18"/>{{ t("协作概述") }}</h3><span :class="['status-chip',run.status]">{{ statuses[run.status] }}</span></div><p class="overview-summary">{{ t(run.summary) }}</p><div class="overview-meta"><span><Icon name="layers" :size="14"/>{{ currentStageName }}</span><span><Icon name="clock" :size="14"/>{{ run.mode==='parallel'?t("独立分析 · 单轮汇总"):t(run.mode==='review'?'第 {round} 轮检查 / 最多 {max} 轮':'第 {round} 轮 / 最多 {max} 轮',{round:run.round,max:run.maxRounds}) }}</span></div><ul v-if="run.issues.length" class="issue-list"><li v-for="(issue,i) in run.issues.slice(0,4)" :key="i">{{ t(issue) }}</li></ul><details v-if="run.issues.length>4"><summary>{{ t("还有") }} {{ run.issues.length-4 }} {{ t("项问题") }}</summary><ul class="issue-list"><li v-for="(issue,i) in run.issues.slice(4)" :key="i">{{ t(issue) }}</li></ul></details></section>

          <div v-if="messages.some(m=>m.role==='agent')" class="timeline-heading"><span>{{ t("团队贡献") }}</span><small>{{ t("最新回答默认展开，之前的回答默认收起") }}</small></div>
          <template v-for="message in messages" :key="message.id">
            <div v-if="message.role==='agent'&&beginsRound(message.id)" class="round-divider"><span>{{ run.mode==='parallel'?t('独立分析 · 单轮汇总'):t('第 {round} 轮',{round:message.round}) }}<template v-if="clarifiedRoundStart(message.id)"> · {{ t('补充后重新处理') }}</template></span></div><details v-if="message.role==='agent'" class="agent-message" :data-message-id="message.id" :open="isExpanded(message.id)"><summary @click.prevent="toggleReply(message.id)"><AgentLogo :kind="message.agent!"/><div class="agent-message-copy"><div class="agent-message-title"><strong>{{ memberName(message.memberId||message.agent,message.agent) }}</strong><span>{{ message.collaborationRole==='moderator'?t('主持判断'):message.collaborationRole==='finalizer'?t('成果汇总'):message.collaborationRole==='producer'?t(run.mode==='review'?'制作者':'汇总与制作'):message.collaborationRole==='reviewer'?t('独立检查'):stages[message.stage] }} · {{ run.mode==='parallel'?t('独立分析 · 单轮汇总'):t('第 {round} 轮',{round:message.round}) }}</span></div><p>{{ message.summary }}</p><small v-if="(message.contextRevision||0)<(run.contextRevision||0)" class="optional">{{ t("补充要求前的回复，仅供参考") }}</small><small v-else-if="(message.contextRevision||0)>0" class="optional">{{ t('已按补充要求重新处理') }}</small></div><Icon name="chevron" :size="16"/></summary><div class="agent-message-body"><Markdown @link="openMarkdownLink" :text="message.text"/></div></details>
            <article v-else-if="message.role==='system'&&message.error" class="error-message"><Icon name="alert" :size="17"/><span>{{ t(message.text) }}</span></article>
            <article v-else-if="message.role==='user'&&message.text!==run.task" class="user-decision"><strong>{{ t("你的补充决定") }}</strong><p>{{ message.text }}</p></article>
          </template>
          <div v-if="active&&run.id===active.id&&run.status==='running'" class="working-indicator"><span class="pulse-dot"/><span>{{ run.currentMemberId?memberName(run.currentMemberId,run.currentAgent)+' · ':'' }}{{ run.currentMemberId?t(agentStatus(run,run.currentMemberId)):currentStageName }}<small>{{ run.currentMemberId?t(activityStatus(latestAttempt(run,run.currentMemberId))):t("任务仍在进行，结果会自动更新") }}</small></span></div>
          <details v-if="streams.length" class="live-preview"><summary>{{ t("本轮成员回复") }}</summary><div class="live-agent-tabs" role="tablist"><button v-for="stream in streams" :key="stream.memberId" type="button" role="tab" :aria-selected="latestProgress?.memberId===stream.memberId" :class="['button',latestProgress?.memberId===stream.memberId?'primary':'subtle']" @click="liveMemberId=stream.memberId">{{ stream.label }}<span v-if="stream.running" class="response-running"><span class="pulse-dot"/>{{ t(stream.activity||'等待响应') }}</span><span v-else>{{ t(stream.status==='completed'?'已完成':stream.status==='failed'?'异常':'已停止') }}</span></button></div><Markdown v-if="latestProgress?.text" @link="openMarkdownLink" :text="latestProgress.text"/><p v-else class="optional">{{ latestProgress?.running?t('等待本次调用返回内容…'):t('本次调用未记录完整回复，请查看执行详情。') }}</p></details>
        </template>
      </div>
      <div class="composer-area"><div class="composer-meta"><div v-if="group.kind==='group'||run" class="composer-round"><span v-if="group.kind==='group'" class="rounds-control" @keydown.esc="roundsOpen=false"><button v-if="group.kind==='group'&&roundsMode!=='parallel'" type="button" class="rounds-button" :disabled="!canAdjust" :aria-expanded="roundsOpen" aria-controls="rounds-limit-popover" :title="canAdjust?roundsHint:t('当前阶段不可调整，或已达到第 8 轮')" @click="toggleRounds"><Icon name="layers" :size="14"/><span>{{ roundsMode==='review'?t('调整检查轮数'):t('调整轮数') }}</span><strong>{{ roundsLimit }}</strong><Icon :name="roundsOpen?'down':'chevron'" :size="12"/></button><div v-if="roundsOpen&&canAdjust" id="rounds-limit-popover" class="rounds-popover"><label for="rounds-slider"><span>{{ roundsMode==='review'?t('最大检查轮数'):t('轮数上限') }} <button type="button" class="icon-button rounds-help" :title="roundsHint" :aria-label="roundsHint"><Icon name="help-circle" :size="14"/></button></span><strong>{{ roundsDraft }}</strong></label><input id="rounds-slider" type="range" :min="roundsMin" max="8" step="1" v-model.number="roundsDraft" @change="saveRounds"><div class="round-ticks"><button v-for="n in 9-roundsMin" :key="n" type="button" :class="{selected:roundsDraft===roundsMin+n-1}" @click="roundsDraft=roundsMin+n-1;saveRounds()">{{ roundsMin+n-1 }}</button></div><p>{{ t('这是上限，任务就绪后仍会提前结束。') }}</p></div></span><span v-if="active&&group.kind==='group'">{{ active.mode==='parallel'?t('独立分析 · 单轮汇总'):t(active.mode==='review'?'第 {round} 轮检查 / 最多 {max} 轮':'第 {round} 轮 / 最多 {max} 轮',{round:active.round,max:active.maxRounds}) }}</span><button v-if="run?.gate" class="button primary" @click="decisionDialog?.showModal()">{{ t("需要你的决定") }}</button></div><div v-if="attachments.length" class="attachment-tray"><button v-for="a in attachments" :key="a.id" :class="['attachment-chip',{selected:selectedAttachments.includes(a.id)}]" :disabled="!!active" @click="toggleAttachment(a)"><Icon name="file" :size="14"/><span>{{ a.name }}</span><small>{{ selectedAttachments.includes(a.id)?t("本次附带"):t("已导入") }}</small></button></div></div><span v-if="active?.pendingSupplements?.length" class="supplement-note">{{ t("补充要求已排队，当前步骤结束后生效") }}</span><form class="composer" @submit.prevent="send"><textarea v-model="draft" rows="2" :disabled="!!active&&!canSupplement" :placeholder="canSupplement?t('可补充要求或建议，将在当前步骤结束后交给团队处理…'):t('描述目标、交付形式和验收要求，例如：根据资料制作一份 12 页汇报 PPT…')" :maxlength="active?4000:20000" @keydown="composerKey"/><div class="composer-toolbar"><div><button type="button" class="icon-button" :title="t('添加附件（由 Agent 自行读取）')" :disabled="!!active" @click="emit('attach')"><Icon name="attach"/></button><span class="composer-permission"><Icon :name="group.allowWrite?'folder':'shield'" :size="13"/>{{ group.allowWrite?t("已授权写入"):t("只读") }}</span></div><button v-if="canSupplement" class="button primary supplement-button" :disabled="!draft.trim()||supplementPending" type="submit">{{ t("补充要求") }}<Icon name="arrow" :size="15"/></button><button v-if="active" class="button stop-button" type="button" @click="emit('stop',active.id)"><Icon name="stop" :size="15"/>{{ t("停止") }}</button><button v-else class="button primary" :disabled="!draft.trim()||importing||roundsSaving" type="submit">{{ group.kind==='direct'?t("发送"):t("开始协作") }}<Icon name="arrow" :size="17"/></button></div></form><p class="composer-footnote">{{ t("附件由 Agent 自行读取 · 运行与文件保存在本地 · Enter 发送 · Ctrl + Enter 换行") }}</p></div>
    </div>
    <aside v-if="showOutput&&artifacts.length" id="deliverables-panel" class="deliverables-panel"><div class="deliverables-heading"><span class="eyebrow">{{ t("交付文件") }}</span><h2>{{ t("最终成果") }}<span>{{ artifacts.length.toString().padStart(2,'0') }}</span></h2></div><div class="deliverables-scroll"><div v-if="!artifacts.length" class="no-deliverables"><Icon name="output" :size="36"/><strong>{{ t("等待成果到达") }}</strong><p>{{ run?.status==='completed'?t("本次为文字回答，展开团队贡献查看结论。"):t("制作完成后，文件会出现在这里。没有找到文件时不会标记为已交付。") }}</p></div><article v-for="a in artifacts" :key="a.id" class="artifact-card"><div class="artifact-kind">{{ a.name.split('.').pop()?.toUpperCase() }}<Icon name="file" :size="18"/></div><h3>{{ a.name }}</h3><p class="artifact-version">{{ t("版本") }} {{ a.sha256.slice(0,8) }}</p><p>{{ bytes(a.size) }} · {{ a.checked?t("Agent 已认可此版本"):t("待检查 / 阶段文件") }}</p><button class="button subtle full" @click="emit('open',a.id)">{{ t("打开文件") }}<Icon name="arrow" :size="15"/></button></article><section v-if="run" class="verification-card"><h3><Icon name="shield" :size="16"/>{{ t("检查说明") }}</h3><Markdown @link="openMarkdownLink" :text="formatVerification(t(run.verification))"/><small>{{ t("文件存在和版本由 Qwork 核对；内容与版式检查范围由 Agent 报告。") }}</small></section></div><footer v-if="run" class="deliverables-footer"><button v-if="!active&&group.kind!=='direct'&&group.allowWrite&&['partial','failed','interrupted','cancelled'].includes(run.status)" class="button primary full" style="margin-bottom:10px" @click="retry(run.id)"><Icon name="refresh" :size="15"/>{{ t("仅重试制作与检查") }}</button><button class="button subtle full" @click="emit('output',run.id)"><Icon name="folder" :size="16"/>{{ t("打开成果目录") }}</button><button class="text-button" @click="emit('export',run.id)"><Icon name="download" :size="14"/>{{ t("导出本次协作报告") }}</button></footer></aside>
  </div>
</section>
<AgentTraceDrawer v-if="traceMemberId" :member-id="traceMemberId" :members="memberList" :run="run" :messages="messages" :progress="progress" @close="traceMemberId=undefined" @notify="message=>emit('notify',message)"/>
<dialog ref="decisionDialog" class="dialog decision-modal" @cancel.prevent="decisionDialog?.close()">          <section v-if="active?.gate" class="decision-card"><h3><Icon name="alert" :size="18"/>{{ active.gate.kind==='clarification'?t('补充关键信息'):active.gate.options?.length?t("选择交付方式"):t("需要你的决定") }}</h3><p>{{ t(active.gate.message) }}</p><div v-if="active.gate.questions?.length" class="clarification-questions"><article v-for="(question,i) in active.gate.questions" :key="i"><label :for="'clarification-'+i"><strong>{{ i+1 }}. {{ question.question }}</strong><small>{{ questionNames(question) }}</small></label><div class="clarification-choices"><button v-for="option in question.options||[]" :key="option" type="button" :class="['button',clarificationAnswers[i]===option?'primary':'subtle']" @click="clarificationAnswers[i]=option">{{ option }}</button></div><textarea :id="'clarification-'+i" v-model="clarificationAnswers[i]" rows="2" maxlength="1000" :placeholder="t('选择建议答案，或输入你的要求')"/></article><p v-if="active.gate.resumeWrite" class="write-resume-note">{{ t('提交后将继续制作。已有阶段文件保留，制作者会先检查现有成果，再继续必要修改。') }}</p></div><textarea v-if="!active.gate.options?.length&&!active.gate.questions?.length" v-model="decision" rows="3" maxlength="4000" :placeholder="t('补充要求，或说明接受哪些风险后继续…')"/><div class="row-end"><button class="button subtle" @click="emit('stop',active.id)">{{ t("停止任务") }}</button><button v-if="!active.gate.options?.length" class="button primary" :disabled="(active.gate.kind==='clarification'?!clarificationReady:!decision.trim())||decisionPending" @click="active.gate.kind==='clarification'?submitClarification():submitDecision(decision)">{{ active.gate.kind==='clarification'?t(active.gate.resumeWrite?'提交补充并继续制作':'提交补充并继续'):t("提交决定并继续") }}<Icon name="arrow" :size="15"/></button></div></section><div v-if="active?.gate?.kind!=='clarification'" class="decision-options"><button v-for="option in active?.gate?.options||['使用现有信息','继续核实分歧']" :key="option" type="button" :class="['button',active?.gate?.options?.length||decision===option?'primary':'subtle']" :disabled="decisionPending" @click="active?.gate?.options?.length?submitDecision(option):decision=option">{{ t(option) }}</button></div></dialog></template>

<style scoped>
.round-divider{display:flex;align-items:center;gap:12px;margin:24px 0 14px;color:var(--color-72836b,#72836b);font-size:12px}.round-divider::before,.round-divider::after{content:"";height:1px;background:var(--color-dbe2d4,#dbe2d4);flex:1}.round-divider span{white-space:nowrap}
</style>

<style scoped>.composer-round{display:flex;align-items:center;justify-content:flex-end;gap:16px}.rounds-control{position:relative}.rounds-popover{position:absolute;bottom:32px;right:0;width:280px;padding:18px;text-align:left;background:var(--paper);border:1px solid var(--line);box-shadow:0 8px 32px #0003;border-radius:12px;z-index:20}.rounds-popover input{width:100%;padding:0;accent-color:var(--accent);margin-top:16px}.rounds-popover label{display:flex;justify-content:space-between}.rounds-popover p{margin:12px 0;font-size:12px;line-height:1.7}.slider-scale{display:flex;justify-content:space-between}.rounds-popover .button{margin-right:8px}.live-agent-tabs{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}.artifact-version{font-size:11px;opacity:.8}.agent-message-body .markdown{font-size:14px;line-height:1.85}.agent-message-copy p{font-size:13px}.composer-footnote{font-size:11px}</style>
<style scoped>.verification-card .markdown{font-size:13px;line-height:1.85;overflow-wrap:anywhere}.verification-card .markdown :deep(ol),.verification-card .markdown :deep(ul){padding-left:20px}.verification-card .markdown :deep(li){margin:7px 0}.verification-card .markdown :deep(p){margin:10px 0}</style>

<style scoped>
.workspace-header{height:auto!important;min-height:52px!important;padding:8px 20px!important}.workspace-title{min-width:0}.workspace-title h1{font-size:17px!important;line-height:1.4}.workspace-icon{width:32px!important;height:32px!important;border-radius:9px}.workspace-header .button{padding:8px 11px}.composer-area{padding:8px 20px 6px}.composer textarea{min-height:46px;max-height:140px;padding:7px 10px;font-size:13px;line-height:1.6}.composer-toolbar{padding-bottom:2px}.composer-toolbar .button{padding:7px 11px}.composer-footnote{margin-top:4px;line-height:1.5}.composer-round{padding-bottom:5px}
</style>

<style scoped>.rounds-help{padding:2px;vertical-align:middle;color:var(--muted)}.rounds-popover label>span{display:inline-flex;align-items:center;gap:5px}</style>

<style scoped>.decision-modal{max-height:88vh;overflow:auto}.clarification-questions article{padding:16px 0;border-bottom:1px solid var(--line)}.clarification-questions label{display:block;font-size:13px;line-height:1.8}.clarification-questions label small{display:block;color:var(--muted);margin-top:5px}.clarification-questions textarea{width:100%;margin:9px 0}.clarification-choices{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.clarification-choices button{white-space:normal;text-align:left}.write-resume-note{font-size:12px;line-height:1.8;padding:12px 0}</style>

<style scoped>
.workspace{position:relative}.file-drop-overlay{position:absolute;inset:8px;border:2px dashed var(--accent);background:var(--paper);opacity:.95;z-index:30;display:grid;place-items:center;pointer-events:none;border-radius:12px;font-size:18px}.response-running{display:inline-flex;align-items:center;gap:5px}.live-agent-tabs button{gap:7px}.live-agent-tabs button>span{font-size:10px}.round-ticks{display:flex;justify-content:space-between;margin-top:9px;gap:3px}.round-ticks button{border:0;background:none;color:var(--muted);padding:3px 8px;border-radius:6px}.round-ticks button.selected{background:var(--accent);color:var(--paper);font-weight:700}.rounds-popover label>strong{background:var(--accent);color:var(--paper);padding:2px 8px;border-radius:6px}
</style>

<style scoped>
.working-indicator>span:last-child,.response-running{animation:response-breathe 2s ease-in-out infinite}
.working-indicator>.pulse-dot{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
@keyframes response-breathe{0%,100%{opacity:1}50%{opacity:.5}}
@media(prefers-reduced-motion:reduce){.working-indicator>span:last-child,.response-running,.pulse-dot{animation:none!important}.execution-swap-enter-active,.execution-swap-leave-active{transition:none}}
</style>

<style scoped>
.rounds-button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);padding:6px 9px;font-size:12px;line-height:1.3;cursor:pointer;transition:border-color .15s,background .15s}.rounds-button:hover:not(:disabled),.rounds-button[aria-expanded=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 5%,var(--paper))}.rounds-button>strong{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:21px;border-radius:5px;background:color-mix(in srgb,var(--accent) 10%,var(--paper));font-size:12px;font-variant-numeric:tabular-nums}.rounds-button:disabled{cursor:default;opacity:.5}.rounds-button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
</style>

<style scoped>.supplement-button{margin-left:auto}.supplement-button+.stop-button{margin-left:8px}.supplement-note{display:block;font-size:11px;color:var(--muted);margin:0 0 6px}</style>

<style scoped>
.compact-overview{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 14px!important;border-radius:10px}.compact-overview .label-row{display:contents}.compact-overview h3{display:none}.compact-overview .status-chip{order:0}.compact-overview .overview-summary{order:1;flex:1;min-width:140px;margin:0;font-size:12px;line-height:1.6}.compact-overview .overview-meta{order:2;margin:0;font-size:11px;gap:12px}.compact-overview>.issue-list,.compact-overview>details{order:3;flex-basis:100%;margin:4px 0 0}.direct-issues{padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:12px;line-height:1.7}.direct-issues p{margin:0}.direct-issues ul{margin:4px 0;padding-left:18px}
</style>

<style scoped>
.composer-meta{display:flex!important;align-items:center;gap:8px;padding:0!important;margin:0 0 5px!important;min-height:0!important}.composer-meta .composer-round{order:2;margin-left:auto;padding:0;gap:10px;flex-shrink:0}.composer-meta .attachment-tray{order:1;flex:1;min-width:0;margin:0;padding:0;display:flex;gap:5px;overflow-x:auto;flex-wrap:nowrap}.composer-meta .attachment-chip{margin:0;padding:3px 7px;font-size:10px;max-width:280px}.composer-meta .rounds-button{padding:4px 7px;font-size:11px}.composer-meta .rounds-button>strong{height:18px;min-width:19px}.composer-round>span{font-size:11px}
</style>
