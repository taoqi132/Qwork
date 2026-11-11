<script setup lang="ts">
import {t,locale} from '../i18n'

import {computed} from 'vue'
import type {Group,Run,Stage} from '../../shared/types'
import {LABELS} from '../../shared/types'
import {stages} from '../content'
import Icon from './Icon.vue'
const props=defineProps<{group:Group;run?:Run;responding:string[]}>()
const members=computed(()=>props.run?.participants||props.group.agents)
const steps=computed<Stage[]>(()=>{
  if(props.group.kind==='direct')return ['preparing','producing','finished']
  if(props.run?.mode==='review'||(!props.run&&props.group.mode==='review'))return ['preparing','producing','checking','finished']
  return props.run?.settings.executeAfter??props.group.executeAfter?['preparing','discussing','summarizing','producing','checking','finished']:['preparing','discussing','summarizing','checking','finished']
})
const activeStage=computed(()=>props.run?.stage==='finished'&&props.run.status!=='completed'?props.run.lastStage||'preparing':props.run?.stage||'preparing')
const position=computed(()=>props.run?.stage==='finished'&&props.run.status!=='completed'&&!props.run.lastStage?-1:steps.value.indexOf(activeStage.value))
function state(kind:string){
  const r=props.run
  if(!r)return t("已加入")
  if(r.status==='waiting')return t("等待你的决定")
  if(r.activeAgents?.includes(kind as any)||(!r.activeAgents&&r.currentAgent===kind))return props.responding.includes(kind)?t("正在返回内容"):t("正在处理，等待返回")
  return ['running'].includes(r.status)?t("等待安排"):t("本次运行已结束")
}
</script>
<template><section class="run-progress" :aria-label="t('协作进度')"><div class="team-roster"><div v-for="kind in members" :key="kind" :class="['roster-agent',{working:run?.activeAgents?.includes(kind)||run?.currentAgent===kind}]"><span class="avatar" :data-agent="kind">{{ LABELS[kind].slice(0,1) }}</span><span><strong>{{ LABELS[kind] }}</strong><small>{{ state(kind) }}</small></span><span v-if="run?.activeAgents?.includes(kind)" class="pulse-dot"/></div></div><ol class="phase-track"><li v-for="(step,i) in steps" :key="step" :class="{done:run?.status==='completed'||i<position,current:i===position&&run?.status!=='completed',attention:run&&['partial','failed','cancelled','interrupted'].includes(run.status)&&i===position}" :aria-current="i===position?'step':undefined"><span class="phase-node"><Icon v-if="run?.status==='completed'||i<position" name="check" :size="13"/><span v-else>{{ i+1 }}</span></span><span>{{ stages[step] }}</span></li></ol></section></template>
