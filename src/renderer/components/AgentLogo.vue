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
const logos:Record<AgentKind,string>={codex,claude,workbuddy,zcode,openclaw,qwen}
</script>
<template><span class="avatar agent-logo" :data-agent="kind"><img :src="logos[kind]" :alt="LABELS[kind]" draggable="false"/></span></template>
<style scoped>
.avatar.agent-logo{background:#fff!important;border:1px solid #e6e6e6;overflow:hidden;flex-shrink:0}.agent-logo img{display:block;width:76%;height:76%;object-fit:contain}.agent-logo[data-agent=codex] img{width:84%;height:84%}
</style>
