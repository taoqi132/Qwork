<script setup lang="ts">
import AgentLogo from './AgentLogo.vue'
import {copyGroupInput,availableMemberCount} from '../group-editor'
import {t,locale} from '../i18n'

import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AgentInfo, AgentKind, AgentMember, Group, GroupInput, MemberId, Mode, Settings, WorkBuddySettings } from '../../shared/types'
import { firstMemberIdOfKind, memberDisplayName, membersFromKinds, nextMemberId } from '../../shared/agent-members'
import { modes } from '../content'
import Icon from './Icon.vue'
import {recommendTeam,defaultRoles as computeRoles} from '../team-defaults'
type EditorForm=Omit<GroupInput,'agents'> & {agents:AgentMember[]}
const props=defineProps<{agents:AgentInfo[];mode:Mode;group?:Group;direct?:boolean;skipMode?:boolean;defaultRounds:number;defaultDirectory:string;settings:Settings}>()
const emit=defineEmits<{close:[];save:[input:GroupInput]}>()
const dialog=ref<HTMLDialogElement>()
const readyMembers=computed(()=>availableMemberCount(form.agents,props.agents))
const initial=recommendTeam(props.agents,props.mode,props.direct)
const initialMembers=membersFromKinds(initial.agents)
const manualMembers=ref(!!props.group),manualModerator=ref(!!props.group),manualOwner=ref(!!props.group)
const form=reactive<EditorForm>(props.group?copyGroupInput(props.group):{name:'',goal:'',kind:props.direct?'direct':'group',agents:initialMembers,workdir:'',allowWrite:!props.direct,mode:props.mode,maxRounds:5,moderator:firstMemberIdOfKind(initialMembers,initial.moderator),summarizer:firstMemberIdOfKind(initialMembers,initial.executor),executor:firstMemberIdOfKind(initialMembers,initial.executor),executeAfter:!props.direct,recommended:true})
form.maxRounds=Math.min(8,Math.max(1,form.maxRounds))
const advanced=ref(true)
const step=ref<'mode'|'details'>(props.group||props.direct||props.skipMode?'details':'mode')
const localError=ref('')
const validationDialog=ref<HTMLDialogElement>()
const textModelKinds:AgentKind[]=['codex','claude','qwen']
const modelPattern=/^[A-Za-z0-9._:/@+\-]*$/
const workBuddyModels=ref<WorkBuddySettings['models']>([]),workBuddyLoading=ref(false),workBuddyError=ref('')
function remind(message:string){localError.value=message;validationDialog.value?.showModal()}
function globalModel(kind:AgentKind){return kind==='workbuddy'?props.settings.workBuddyModelId||'':props.settings.agentModels?.[kind]||''}
function selectedKind(kind:AgentKind){return form.agents.some(member=>member.kind===kind)}
function countOf(kind:AgentKind){return form.agents.filter(member=>member.kind===kind).length}
function canDuplicate(kind:AgentKind){return form.kind==='group'&&kind!=='openclaw'&&countOf(kind)===1}
function memberRoles(member:AgentMember){
  const roles:string[]=[]
  if(form.mode!=='parallel'&&form.mode!=='review'&&form.moderator===member.id)roles.push(t('主持人'))
  if(form.executor===member.id)roles.push(form.mode==='review'?t('制作者'):t('成果负责人'))
  if(!roles.length)roles.push(t('成员'))
  return roles
}
function removeMembers(ids:MemberId[]){
  const removed=form.agents.filter(member=>ids.includes(member.id))
  form.agents=form.agents.filter(member=>!ids.includes(member.id))
  for(const role of ['moderator','summarizer','executor'] as const){
    if(!ids.includes(form[role]))continue
    const old=removed.find(member=>member.id===form[role])
    const sibling=old?form.agents.find(member=>member.kind===old.kind):undefined
    const fallback=sibling?.id||form.agents[0]?.id
    if(fallback)form[role]=fallback
    if(role==='moderator')manualModerator.value=true
    else manualOwner.value=true
  }
  form.summarizer=form.executor
}
watch(()=>form.agents.map(member=>member.id).join(','),()=>{
  const roles=computeRoles(props.agents.filter(agent=>agent.installed&&agent.compatible&&form.agents.some(member=>member.kind===agent.kind)))
  if(!manualOwner.value||!form.agents.some(member=>member.id===form.executor))form.executor=firstMemberIdOfKind(form.agents,roles.executor)
  if(!manualModerator.value||!form.agents.some(member=>member.id===form.moderator)){
    let next=firstMemberIdOfKind(form.agents,roles.moderator)
    if(next===form.executor)next=form.agents.find(member=>member.id!==form.executor)?.id||next
    form.moderator=next
  }
  form.summarizer=form.executor
})
watch(()=>form.mode,()=>{if(!manualMembers.value)recommend()})
watch(()=>form.agents.some(member=>member.kind==='workbuddy'),selected=>{if(selected&&!workBuddyModels.value.length)void loadWorkBuddy()},{immediate:true})
onMounted(()=>dialog.value?.showModal())
function toggle(kind:AgentKind){
  manualMembers.value=true;form.recommended=false
  if(selectedKind(kind))removeMembers(form.agents.filter(member=>member.kind===kind).map(member=>member.id))
  else if(form.kind==='direct')form.agents=[{id:kind,kind}]
  else{
    const id=nextMemberId(kind,form.agents)
    if(id)form.agents.push({id,kind})
  }
}
function addCopy(kind:AgentKind){
  if(!canDuplicate(kind))return
  const id=nextMemberId(kind,form.agents)
  if(!id)return
  form.agents.push({id,kind})
  manualMembers.value=true;form.recommended=false
}
function recommend(){
  manualMembers.value=false
  const next=recommendTeam(props.agents,form.mode,form.kind==='direct')
  form.agents=membersFromKinds(next.agents)
  if(!manualOwner.value||!form.agents.some(member=>member.id===form.executor))form.executor=firstMemberIdOfKind(form.agents,next.executor)
  if(!manualModerator.value||!form.agents.some(member=>member.id===form.moderator))form.moderator=firstMemberIdOfKind(form.agents,next.moderator)
  form.summarizer=form.executor;form.recommended=true
}
async function loadWorkBuddy(){
  if(!window.qwork?.workBuddySettings)return
  workBuddyLoading.value=true;workBuddyError.value=''
  try{workBuddyModels.value=(await window.qwork.workBuddySettings()).models}catch(error:any){workBuddyError.value=error.message}finally{workBuddyLoading.value=false}
}
function workBuddyOptions(member:AgentMember){
  if(member.model&&!workBuddyModels.value.some(model=>model.id===member.model))return [{id:member.model,name:`${member.model}（${t('当前不可用')}）`},...workBuddyModels.value]
  return workBuddyModels.value
}
async function pick(){const value=await window.qwork!.pickDirectory();if(value)form.workdir=value}
function save(){
  if(form.agents.length<(form.kind==='direct'?1:2)){remind(t("请选择足够数量的可用 Agent"));return}
  if(!props.direct&&(form.executeAfter||form.mode==='review')&&!form.allowWrite){remind(t("制作文件需要勾选工作目录写入授权"));return}
  for(const member of form.agents){
    const model=member.model?.trim()||''
    if(model&&['zcode','openclaw'].includes(member.kind)){remind(t('该 Agent 不支持在群聊中指定模型'));return}
    if(model&&textModelKinds.includes(member.kind)&&!modelPattern.test(model)){remind(t('模型 ID 只能包含字母、数字和 . _ : / @ + -'));return}
  }
  if(!Number.isInteger(form.maxRounds)||form.maxRounds<1||form.maxRounds>8){remind(t('讨论轮数必须为 1 到 8 的整数。'));return}
  const {name,goal,kind,workdir,allowWrite,mode,maxRounds,executeAfter,recommended}=form
  const agents=form.agents.map(member=>({id:member.id,kind:member.kind,...(member.model?.trim()?{model:member.model.trim()}:{})}))
  const fallback=agents[0]?.id||''
  const has=(id:MemberId)=>agents.some(member=>member.id===id)
  const executor=has(form.executor)?form.executor:fallback
  const moderator=has(form.moderator)?form.moderator:fallback
  emit('save',{name,goal,kind,agents,workdir,allowWrite,mode,maxRounds:mode==='parallel'?1:maxRounds,moderator,summarizer:executor,executor,executeAfter,recommended})
}
</script>
<template>
<dialog ref="dialog" class="dialog group-dialog" @cancel.prevent="emit('close')" @click="($event.target===dialog)&&emit('close')">
  <form novalidate @submit.prevent="save">
    <header class="dialog-header"><div><h2>{{ group?t("群聊设置"):direct?t("开始单聊"):t("创建协作群聊") }}</h2></div><button type="button" class="icon-button" :aria-label="t('关闭')" @click="emit('close')"><Icon name="close"/></button></header>
    <div class="dialog-body" v-if="step==='mode'">
      <p class="wizard-description">{{ t("先选择协作方式，再设置团队与目标。") }}</p>
      <div class="wizard-modes"><button v-for="m in modes" :key="m.id" type="button" :class="['wizard-mode',{selected:form.mode===m.id}]" @click="form.mode=m.id;step='details'"><div><Icon :name="m.icon" :size="22"/><strong>{{ m.title }}</strong><Icon name="arrow" :size="16"/></div><p>{{ m.description }}</p><small>{{ m.examples }}</small><span>{{ m.steps.join(' → ') }}</span></button></div>
    </div>
    <div v-else class="dialog-body">
      <button v-if="!direct&&!group" type="button" class="text-button wizard-back" @click="step='mode'">{{ t("返回选择模式") }}</button>
      <label class="field">{{ direct?t("对话名称"):t("群聊名称") }}<input v-model="form.name" maxlength="60" :placeholder="t('留空时，根据首条任务自动命名')"><small>{{ t("仅用于整理记录，不会提供给模型。改名不影响任务。") }}</small></label>
      <label class="field">{{ t("群聊目标") }} <span class="optional">{{ t("可选") }}</span><textarea v-model="form.goal" rows="2" maxlength="2000" :placeholder="t('例如：基于项目资料制作面向管理层的汇报文件')"/><small>{{ t("会作为长期背景提供给 Agent；本次消息中的具体任务优先。修改只影响后续运行。") }}</small></label>
      <div v-if="!direct" class="field">{{ t("协作模式") }}<select v-model="form.mode"><option v-for="m in modes" :key="m.id" :value="m.id">{{ m.title }}</option></select></div>
      <div class="field"><div class="label-row"><span>{{ t("参与 Agent") }} <span class="optional">{{ direct?t("选择一位"):t("至少两位") }}</span></span><button type="button" class="text-button" @click="recommend"><Icon name="spark" :size="14"/> {{ t("推荐组队") }}</button></div>
        <div class="agent-selector"><div v-for="agent in agents" :key="agent.kind" class="agent-choice-wrap"><button type="button" :disabled="!agent.installed||!agent.compatible" :class="['agent-choice',{selected:selectedKind(agent.kind)}]" @click="toggle(agent.kind)"><AgentLogo :kind="agent.kind"/><span>{{ agent.label }}<small>{{ !agent.installed?t("未安装"):!agent.compatible?t("版本不兼容"):agent.credential==='missing'?t("需登录"):agent.credential==='unknown'?t("连接待验证"):t("已配置") }}</small></span><span v-if="selectedKind(agent.kind)&&form.kind==='group'" class="agent-instance-badge">{{ agent.kind==='openclaw'?'1/1':countOf(agent.kind)+'/2' }}</span><Icon v-if="selectedKind(agent.kind)" name="check" :size="15"/></button><button v-if="canDuplicate(agent.kind)" type="button" class="agent-copy icon-button" :title="t('再添加一个实例')" :aria-label="t('复制成员')+' '+agent.label" @click.stop="addCopy(agent.kind)">+</button></div></div>
        <small v-if="form.recommended">{{ t("已按当前模式和本机可用 Agent 推荐成员与角色，可自行调整。") }}</small>
        <small v-if="readyMembers<(form.kind==='direct'?1:2)" class="warning">{{ t("请选择足够数量的可用 Agent") }}</small>
        <div v-if="form.agents.length" class="member-model-list"><div class="member-model-heading"><strong>{{ t('成员与模型') }}</strong><small>{{ t('成员模型仅用于本群聊，运行开始时冻结。') }}</small></div><div v-for="member in form.agents" :key="member.id" class="member-model-row" :data-member-id="member.id"><AgentLogo :kind="member.kind"/><div class="member-model-identity"><strong>{{ memberDisplayName(member,form.agents) }}</strong><span class="member-role-tags"><span v-for="role in memberRoles(member)" :key="role" class="member-role-tag">{{ role }}</span></span></div><div class="member-model-control"><template v-if="textModelKinds.includes(member.kind)"><input v-model="member.model" maxlength="120" :placeholder="t('留空沿用全局设置')" :aria-label="memberDisplayName(member,form.agents)+' '+t('模型')"><small>{{ globalModel(member.kind)?t('全局：')+globalModel(member.kind):t('当前未设置全局模型，将跟随 CLI 默认') }}</small></template><template v-else-if="member.kind==='workbuddy'"><select :value="member.model||''" @change="member.model=($event.target as HTMLSelectElement).value" :disabled="workBuddyLoading" :aria-label="memberDisplayName(member,form.agents)+' '+t('模型')"><option value="">{{ t('沿用全局设置或 CLI 默认') }}</option><option v-for="model in workBuddyOptions(member)" :key="model.id" :value="model.id">{{ model.name }}</option></select><small v-if="workBuddyLoading">{{ t('正在读取 WorkBuddy 模型…') }}</small><small v-else-if="workBuddyError">{{ workBuddyError }} <button type="button" class="text-button" @click="loadWorkBuddy">{{ t('重试') }}</button></small></template><span v-else class="member-model-note">{{ t('跟随 CLI 默认模型，该 CLI 不提供 --model 参数') }}</span></div><button type="button" class="icon-button member-remove" :disabled="form.agents.length<=(form.kind==='direct'?1:2)" :title="t('移除成员')" :aria-label="t('移除成员')+' '+memberDisplayName(member,form.agents)" @click="removeMembers([member.id])"><Icon name="close" :size="14"/></button></div></div>
      </div>
      <label class="field">{{ t("工作目录") }}<div class="input-action"><input v-model="form.workdir" :placeholder="t('自动为本群创建独立目录')"><button type="button" class="button subtle" @click="pick"><Icon name="folder" :size="16"/>{{ t("选择") }}</button></div><small>{{ t("默认位置：") }}{{ defaultDirectory }}{{ t("。任务运行时固定目录，避免不同群聊互相覆盖。") }}</small></label>
      <label class="check-field"><input v-model="form.allowWrite" type="checkbox"><span>{{ t("允许在工作目录中制作或修改文件") }}<small>{{ t("附件只读；讨论和审查阶段仍使用只读权限。实际边界也取决于原生 CLI。") }}</small></span></label>
      <label v-if="!direct" class="check-field"><input v-model="form.executeAfter" type="checkbox"><span>{{ form.mode==='review'?t("制作并审查成果文件"):t("讨论后制作并检查文件") }}<small>{{ t("文件制作需要写入授权；制作检查中，未明确要求文件的任务会先确认交付方式。") }}</small></span></label>
      <button v-if="!direct" type="button" class="advanced-toggle" @click="advanced=!advanced"><Icon :name="advanced?'down':'chevron'" :size="15"/>{{ t("高级协作设置") }}</button>
      <div v-if="advanced&&!direct" class="advanced-fields">
        <label v-if="form.mode!=='parallel'" class="field">{{ form.mode==='review'?t("最大检查轮数"):t("最多讨论轮数") }}<input v-model.number="form.maxRounds" type="number" min="1" max="8"><small>{{ t("这是上限，达到结束条件立即进入交付，不会为了凑轮数继续。") }}</small></label>
        <label v-if="!['review','parallel'].includes(form.mode)" class="field">{{ t("讨论主持人") }}<select v-model="form.moderator" @change="manualModerator=true"><option v-for="member in form.agents" :key="member.id" :value="member.id">{{ memberDisplayName(member,form.agents) }}</option></select><small>{{ t("每轮梳理进展和关键分歧，判断能否进入汇总；未就绪时安排相关成员继续讨论，不要求全票通过。") }}</small></label>
        <label class="field">{{ form.mode==='review'?t("制作者"):t("成果负责人") }}<select v-model="form.executor" @change="manualOwner=true"><option v-for="member in form.agents" :key="member.id" :value="member.id">{{ memberDisplayName(member,form.agents) }}</option></select><small v-if="form.mode!=='parallel'">{{ form.mode==='review'?t("负责回答或制作文件；其余所有已选 Agent 都是检查者，独立检查同一版成果。只有制作者可以写入文件。"):t("汇总讨论并形成最终回答；需要文件时，同时完成制作，优先由讨论主持人独立检查。") }}</small></label>
      </div>
      <p v-if="localError" role="alert" class="error-inline">{{ localError }}</p>
    </div>
    <footer v-if="step==='details'" class="dialog-footer"><button type="button" class="button subtle" @click="emit('close')">{{ t("取消") }}</button><button class="button primary" type="submit">{{ group?t("保存设置"):direct?t("开始对话"):t("创建群聊") }}<Icon name="arrow" :size="17"/></button></footer>
  </form>
</dialog>
<dialog ref="validationDialog" class="dialog validation-dialog" @cancel.prevent="validationDialog?.close()"><header class="dialog-header"><h2>{{ t('请检查群聊设置') }}</h2></header><div class="dialog-body"><p role="alert">{{ localError }}</p></div><footer class="dialog-footer"><button type="button" class="button primary" autofocus @click="validationDialog?.close()">{{ t('返回修改') }}</button></footer></dialog>
</template>
