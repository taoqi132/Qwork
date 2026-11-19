<script setup lang="ts">
import type {AgentKind} from '../../shared/types'
import {LABELS} from '../../shared/types'
import codex from '../assets/agents/codex.svg'
import claude from '../assets/agents/claude.svg'
import workbuddy from '../assets/agents/workbuddy.svg'
import zcode from '../assets/agents/zcode.png'
import openclaw from '../assets/agents/openclaw.svg'
import qwen from '../assets/agents/qwen.png'
defineProps<{kind:AgentKind}>()
const initials:Partial<Record<AgentKind,string>>={opencode:'OC',copilot:'GH',cursor:'Cu'}
const logos:Partial<Record<AgentKind,string>>={codex,claude,workbuddy,zcode,openclaw,qwen}
</script>
<template><span class="avatar agent-logo" :data-agent="kind"><img v-if="logos[kind]" :src="logos[kind]" :alt="LABELS[kind]" draggable="false"/><b v-else :title="LABELS[kind]">{{ initials[kind] }}</b></span></template>
<style scoped>
.avatar.agent-logo{background:#fff!important;border:1px solid #e6e6e6;overflow:hidden;flex-shrink:0}.agent-logo img{display:block;width:76%;height:76%;object-fit:contain}.agent-logo[data-agent=codex] img{width:84%;height:84%}
</style>
