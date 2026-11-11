<script setup lang="ts">
import {t,locale} from '../i18n'

import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AgentInfo, AgentKind, Group, GroupInput, Mode } from '../../shared/types'
import { LABELS } from '../../shared/types'
import { modes } from '../content'
import Icon from './Icon.vue'
const props=defineProps<{agents:AgentInfo[];mode:Mode;group?:Group;direct?:boolean;skipMode?:boolean;defaultRounds:number;defaultDirectory:string}>()
const emit=defineEmits<{close:[];save:[input:GroupInput]}>()
const dialog=ref<HTMLDialogElement>()
const ready=computed(()=>props.agents.filter(a=>a.installed&&a.compatible))
const selected=ready.value.slice(0,props.direct?1:2).map(a=>a.kind)
const first=selected[0]||'codex'
const form=reactive<GroupInput>(props.group?{...props.group,agents:[...props.group.agents]}:{name:'',goal:'',kind:props.direct?'direct':'group',agents:selected,workdir:'',allowWrite:!props.direct,mode:props.mode,maxRounds:props.defaultRounds,moderator:first,summarizer:first,executor:first,executeAfter:!props.direct,recommended:false})
form.maxRounds=Math.min(8,Math.max(1,form.maxRounds))
const advanced=ref(true)
const step=ref<'mode'|'details'>(props.group||props.direct||props.skipMode?'details':'mode')
const localError=ref('')
const validationDialog=ref<HTMLDialogElement>()
function remind(message:string){localError.value=message;validationDialog.value?.showModal()}
watch(()=>[...form.agents],()=>{
  for(const field of ['moderator','summarizer','executor'] as const)if(!form.agents.includes(form[field]))form[field]=form.agents[0]||'codex'
})
onMounted(()=>dialog.value?.showModal())
function toggle(kind:AgentKind){
  if(form.agents.includes(kind))form.agents=form.agents.filter(a=>a!==kind)
  else if(form.kind==='direct')form.agents=[kind]
  else form.agents.push(kind)
}
function recommend(){form.agents=ready.value.slice(0,form.kind==='direct'?1:2).map(a=>a.kind);form.recommended=true}
async function pick(){const value=await window.qwork!.pickDirectory();if(value)form.workdir=value}
function save(){
  if(form.agents.length<(form.kind==='direct'?1:2)){remind(t("请选择足够数量的可用 Agent"));return}
  if(!props.direct&&(form.executeAfter||form.mode==='review')&&!form.allowWrite){remind(t("制作文件需要勾选工作目录写入授权"));return}
  if(!Number.isInteger(form.maxRounds)||form.maxRounds<1||form.maxRounds>8){remind(t('讨论轮数必须为 1 到 8 的整数。'));return}
  const {name,goal,kind,agents,workdir,allowWrite,mode,maxRounds,moderator,summarizer,executor,executeAfter,recommended}=form
  emit('save',{name,goal,kind,agents:[...agents],workdir,allowWrite,mode,maxRounds:mode==='parallel'?1:maxRounds,moderator,summarizer:executor,executor,executeAfter,recommended})
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
        <div class="agent-selector"><button v-for="agent in agents" :key="agent.kind" type="button" :disabled="!agent.installed||!agent.compatible" :class="['agent-choice',{selected:form.agents.includes(agent.kind)}]" @click="toggle(agent.kind)"><span class="avatar" :data-agent="agent.kind">{{ agent.label.slice(0,1) }}</span><span>{{ agent.label }}<small>{{ !agent.installed?t("未安装"):!agent.compatible?t("版本不兼容"):agent.credential==='missing'?t("需登录"):agent.credential==='unknown'?t("连接待验证"):t("已配置") }}</small></span><Icon v-if="form.agents.includes(agent.kind)" name="check" :size="15"/></button></div>
        <small v-if="form.recommended">{{ t("按已安装且协议兼容筛选小团队，未预设文件专长。角色与连接状态仍需确认。") }}</small>
        <small v-if="ready.length<2" class="warning">{{ t("可用成员不足，请先在设置中检测本机 CLI。") }}</small>
      </div>
      <label class="field">{{ t("工作目录") }}<div class="input-action"><input v-model="form.workdir" :placeholder="t('自动为本群创建独立目录')"><button type="button" class="button subtle" @click="pick"><Icon name="folder" :size="16"/>{{ t("选择") }}</button></div><small>{{ t("默认位置：") }}{{ defaultDirectory }}{{ t("。任务运行时固定目录，避免不同群聊互相覆盖。") }}</small></label>
      <label class="check-field"><input v-model="form.allowWrite" type="checkbox"><span>{{ t("允许在工作目录中制作或修改文件") }}<small>{{ t("附件只读；讨论和审查阶段仍使用只读权限。实际边界也取决于原生 CLI。") }}</small></span></label>
      <label v-if="!direct" class="check-field"><input v-model="form.executeAfter" type="checkbox"><span>{{ form.mode==='review'?t("制作并审查成果文件"):t("讨论后制作并检查文件") }}<small>{{ t("文件制作需要写入授权；制作检查中，未明确要求文件的任务会先确认交付方式。") }}</small></span></label>
      <button v-if="!direct" type="button" class="advanced-toggle" @click="advanced=!advanced"><Icon :name="advanced?'down':'chevron'" :size="15"/>{{ t("高级协作设置") }}</button>
      <div v-if="advanced&&!direct" class="advanced-fields">
        <label v-if="form.mode!=='parallel'" class="field">{{ form.mode==='review'?t("最大检查轮数"):t("最多讨论轮数") }}<input v-model.number="form.maxRounds" type="number" min="1" max="8"><small>{{ t("这是上限，达到结束条件立即进入交付，不会为了凑轮数继续。") }}</small></label>
        <label v-if="!['review','parallel'].includes(form.mode)" class="field">{{ t("讨论主持者") }}<select v-model="form.moderator"><option v-for="k in form.agents" :key="k" :value="k">{{ LABELS[k] }}</option></select><small>{{ t("每轮梳理进展和关键分歧，判断能否进入汇总；未就绪时安排相关成员继续讨论，不要求全票通过。") }}</small></label>
        <label class="field">{{ form.mode==='review'?t("制作者"):t("成果负责人") }}<select v-model="form.executor"><option v-for="k in form.agents" :key="k" :value="k">{{ LABELS[k] }}</option></select><small>{{ form.mode==='review'?t("负责回答或制作文件；其余所有已选 Agent 都是检查者，独立检查同一版成果。只有制作者可以写入文件。"):t("整合分析并形成最终回答；需要文件时，在同一次调用中汇总并制作，再由另一位 Agent 独立检查。") }}</small></label>
      </div>
      <p v-if="localError" role="alert" class="error-inline">{{ localError }}</p>
    </div>
    <footer v-if="step==='details'" class="dialog-footer"><button type="button" class="button subtle" @click="emit('close')">{{ t("取消") }}</button><button class="button primary" type="submit">{{ group?t("保存设置"):direct?t("开始对话"):t("创建群聊") }}<Icon name="arrow" :size="17"/></button></footer>
  </form>
</dialog>
<dialog ref="validationDialog" class="dialog validation-dialog" @cancel.prevent="validationDialog?.close()"><header class="dialog-header"><h2>{{ t('请检查群聊设置') }}</h2></header><div class="dialog-body"><p role="alert">{{ localError }}</p></div><footer class="dialog-footer"><button type="button" class="button primary" autofocus @click="validationDialog?.close()">{{ t('返回修改') }}</button></footer></dialog>
</template>
