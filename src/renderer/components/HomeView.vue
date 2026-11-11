<script setup lang="ts">
import {ref} from 'vue'
const selectedMode=ref('auto')
import {t,locale} from '../i18n'

import type {Mode} from '../../shared/types'
import {modes} from '../content'
import Icon from './Icon.vue'
defineProps<{completed:number}>()
defineEmits<{create:[mode:Mode];settings:[]}>()
</script>
<template><div class="home page-scroll compact-home"><header class="home-topbar"><span>{{ t("工作台") }}</span><button class="text-button" @click="$emit('settings')">{{ t("管理 Agent") }}<Icon name="settings" :size="16"/></button></header><section class="home-intro"><div><h1>{{ t("选择一种协作方式") }}</h1><p>{{ t("给出目标和资料，由团队讨论、制作和检查，最终拿到文件。") }}</p></div><span class="home-count">{{ t("已完成任务") }}: {{ completed }}</span></section><section class="mode-section"><div class="mode-grid"><button v-for="m in modes" :key="m.id" :class="['mode-card',m.id,{selected:selectedMode===m.id}]" :aria-pressed="selectedMode===m.id" @click="selectedMode=m.id;$emit('create',m.id)"><div class="mode-title"><span class="mode-icon"><Icon :name="m.icon" :size="24"/></span><h3>{{ m.title }}</h3><span v-if="m.id==='auto'" class="recommended-tag">{{ t("推荐") }}</span><Icon name="arrow" :size="18"/></div><p class="mode-description">{{ m.description }}</p><div class="mode-steps"><template v-for="(step,i) in m.steps" :key="step"><span>{{ step }}</span><Icon v-if="i<m.steps.length-1" name="chevron" :size="13"/></template></div><div class="mode-card-bottom"><span>{{ m.examples }}</span></div></button></div></section></div></template>
