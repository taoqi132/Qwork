<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {AGENT_KINDS,LABELS,type AgentInfo,type AgentDetectionState} from '../../shared/types'
import {t} from '../i18n'
import AgentLogo from './AgentLogo.vue'
import Icon from './Icon.vue'
import logo from '../../../assets/qwork.svg'
const props=defineProps<{agents:AgentInfo[];status:AgentDetectionState['status'];loading:boolean}>()
const emit=defineEmits<{enter:[settings:boolean];retry:[]}>()
const elapsed=ref(0)
let ticker:ReturnType<typeof setInterval>,finish:ReturnType<typeof setTimeout>|undefined
const terminal=computed(()=>!props.loading&&props.status!=='searching')
const available=computed(()=>props.agents.filter(a=>a.installed&&a.compatible).length)
const rows=computed(()=>AGENT_KINDS.map(kind=>{
  const agent=props.agents.find(a=>a.kind===kind)
  const pending=!terminal.value&&(!agent||agent.source==='未检测')
  const state=pending?'searching':agent?.source==='检测超时'?'timeout':agent?.source==='检测失败'||props.status==='failed'?'failed':agent?.installed?(agent.compatible?'found':'incompatible'):'absent'
  const labels={searching:'检测中',timeout:'检测超时',failed:'检测失败',found:'已找到',incompatible:'版本不兼容',absent:'未安装'}
  return {kind,state,label:labels[state],version:!pending&&agent?.installed?agent.version:''}
}))
const count=computed(()=>rows.value.filter(a=>a.state!=='searching').length)
const ready=computed(()=>terminal.value&&props.status==='ready'&&available.value>0)
const title=computed(()=>props.loading?'正在启动 Qwork':!terminal.value?'正在检查本机 Agent':props.status==='failed'?'检测未完成':available.value?'检测完成':'未找到可用 Agent')
function enter(settings=false){clearTimeout(finish);emit('enter',settings)}
watch(ready,value=>{
 clearTimeout(finish)
 if(value)finish=setTimeout(()=>enter(),Math.max(750,1400-elapsed.value))
})
onMounted(()=>{ticker=setInterval(()=>elapsed.value+=250,250)})
onUnmounted(()=>{clearInterval(ticker);clearTimeout(finish)})
</script>
<template>
<section class="startup" :aria-label="t('启动检测')">
  <main class="startup-panel">
    <header class="startup-brand"><img :src="logo" alt="" width="42" height="42"><span>Qwork</span></header>
    <div class="startup-heading"><h1 role="status" aria-live="polite">{{ t(title) }}</h1><span class="scan-count">{{ count }}<span> / 6</span></span></div>
    <p class="startup-description">{{ t(terminal&&!ready?'可前往设置配置 Agent，或先进入工作台。':'检查完成后自动进入工作台。') }}</p>
    <div class="startup-agents">
      <div v-for="row in rows" :key="row.kind" :class="['startup-agent',row.state]">
        <AgentLogo :kind="row.kind"/><div class="agent-identity"><strong>{{ LABELS[row.kind] }}</strong><small v-if="row.version" :title="row.version">{{ row.version }}</small></div>
        <span class="agent-scan-status"><span v-if="row.state==='searching'" class="scan-spinner"></span><Icon v-else-if="row.state==='found'" name="check" :size="13"/><span>{{ t(row.label) }}</span><button v-if="row.state==='absent'" type="button" class="text-button startup-install-link" @click="enter(true)">{{ t('查看安装') }}</button></span>
      </div>
    </div>
    <div class="scan-progress" role="progressbar" :aria-label="t('检测进度')" :aria-valuenow="count" :aria-valuemin="0" :aria-valuemax="6"><span :style="{width:`${count/6*100}%`}" :class="{indeterminate:count===0&&!terminal}"></span></div>
    <footer class="startup-actions" v-if="terminal&&!ready"><button class="button primary" @click="enter(true)">{{ t('前往配置') }}</button><button class="text-button" @click="enter()">{{ t('进入工作台') }}</button><button v-if="status==='failed'" class="text-button" @click="emit('retry')">{{ t('重新检测') }}</button></footer>
    <footer v-else class="startup-wait"><span>{{ t(ready?'即将进入工作台…':'正在检查安装与版本') }}</span><button v-if="elapsed>=8000&&!terminal" class="text-button" @click="enter()">{{ t('跳过等待，进入工作台') }}<Icon name="arrow" :size="13"/></button></footer>
  </main>
</section>
</template>
<style scoped>
.startup{--startup-ink:#242826;--startup-muted:#7b807d;--startup-line:#e9ebe9;--startup-progress:#537563;--startup-warning:#986f38;min-height:100dvh;height:100dvh;overflow:auto;background:#fafbfa;color:var(--startup-ink);display:flex;align-items:center;justify-content:center;padding:40px 28px;font-family:'Segoe UI Variable Text','Microsoft YaHei UI',sans-serif}
.startup-panel{width:100%;max-width:440px;margin:auto}
.startup-brand{display:flex;align-items:center;gap:11px;margin-bottom:43px}
.startup-brand img{display:block;border-radius:11px}
.startup-brand>span{font-family:Bahnschrift,'Segoe UI',sans-serif;font-size:27px;font-weight:600;letter-spacing:-.7px}
.startup-heading{display:flex;align-items:center;justify-content:space-between;gap:20px}
.startup-heading h1{font-size:16px;line-height:1.6;font-weight:500;margin:0}
.scan-count{font-size:11px;font-variant-numeric:tabular-nums;color:var(--startup-ink)}
.scan-count>span{color:var(--startup-muted)}
.startup-description{font-size:11px;line-height:1.8;color:var(--startup-muted);margin:6px 0 24px}
.startup-agents{border-top:1px solid var(--startup-line)}
.startup-agent{display:flex;align-items:center;gap:11px;min-height:53px;border-bottom:1px solid var(--startup-line);padding:11px 0}
.startup-agent :deep(.avatar){width:27px;height:27px;min-width:27px;display:flex;align-items:center;justify-content:center;border-radius:7px}
.startup-agent :deep(img){color-scheme:light}
.agent-identity{display:flex;align-items:baseline;gap:12px;min-width:0;flex:1}
.agent-identity strong{font-size:12px;font-weight:500;white-space:nowrap}
.agent-identity small{color:var(--startup-muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}
.agent-scan-status{display:flex;align-items:center;justify-content:flex-end;gap:6px;font-size:11px;color:var(--startup-muted);white-space:nowrap;min-width:65px}
.startup-install-link{font-size:10px;color:var(--startup-ink);margin-left:5px;text-decoration:underline;text-underline-offset:3px}.found .agent-scan-status{color:var(--startup-progress)}
.timeout .agent-scan-status,.failed .agent-scan-status,.incompatible .agent-scan-status{color:var(--startup-warning)}
.scan-spinner{width:10px;height:10px;border:1px solid var(--startup-line);border-top-color:var(--startup-muted);border-radius:50%;animation:scan-spin 1s linear infinite}
.scan-progress{height:2px;margin-top:24px;overflow:hidden;background:var(--startup-line)}
.scan-progress>span{display:block;height:100%;background:var(--startup-progress);transition:width .3s ease}
.scan-progress>span.indeterminate{width:20%!important;animation:scan-slide 2s ease-in-out infinite}
.startup-wait{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;font-size:10px;color:var(--startup-muted)}
.startup-wait button{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--startup-ink)}
.startup-actions{display:flex;align-items:center;gap:20px;min-height:58px;padding-top:14px}
.startup-actions button{font-size:11px}
.startup-actions .primary{background:var(--startup-ink);color:#fff;border-radius:6px;box-shadow:none}
.startup-actions .text-button{color:var(--startup-muted)}
.startup button:focus-visible{outline:2px solid var(--startup-progress);outline-offset:4px}
:global(html[data-theme=dark] .startup){--startup-ink:#e4e7e5;--startup-muted:#939b96;--startup-line:#333936;--startup-progress:#91b29f;--startup-warning:#d3af7b;background:#1b1e1c}
:global(html[data-theme=dark] .startup .primary){background:#dce4df;color:#202923}
@keyframes scan-spin{to{transform:rotate(360deg)}}
@keyframes scan-slide{0%,100%{transform:translateX(0)}50%{transform:translateX(400%)}}
@media(max-width:480px){.startup{padding:28px 24px}.agent-identity{display:block}.agent-identity small{display:block;max-width:180px;margin-top:3px}.startup-brand{margin-bottom:32px}}
@media(max-height:620px){.startup{padding-top:24px;padding-bottom:20px}.startup-brand{margin-bottom:24px}.startup-description{margin-bottom:15px}.startup-agent{min-height:45px;padding:8px 0}.scan-progress{margin-top:18px}}
@media(prefers-reduced-motion:reduce){*,*:before{animation:none!important;transition:none!important}}
</style>
