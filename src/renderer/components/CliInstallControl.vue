<script setup lang="ts">
import {computed,ref} from 'vue'
import type {AgentInfo,CliInstallOption,CliInstallState} from '../../shared/types'
import {t} from '../i18n'
import Icon from './Icon.vue'
const props=defineProps<{agent:AgentInfo;option?:CliInstallOption;state?:CliInstallState;disabled:boolean;loading:boolean;loadError?:string}>()
const emit=defineEmits<{notify:[message:string]}>()
const dialog=ref<HTMLDialogElement>(),submitting=ref(false)
const busy=computed(()=>!!props.state&&['checking','downloading','installing','verifying'].includes(props.state.phase))
const own=computed(()=>props.state?.kind===props.agent.kind&&props.state.phase!=='idle')
const phases={idle:'',checking:'正在检查安装环境…',downloading:'正在下载安装包…',installing:'正在安装 CLI…',verifying:'正在验证 CLI…',completed:'CLI 安装完成，正在刷新检测结果。',cancelled:'安装已取消；已写入的文件可能保留。',failed:'CLI 安装失败'}
async function help(node=false){try{await window.qwork!.openInstallHelp(node?'node':props.agent.kind)}catch(error:any){emit('notify',error.message)}}
async function confirm(){
 if(submitting.value||busy.value)return
 submitting.value=true
 try{await window.qwork!.installCli(props.agent.kind);dialog.value?.close()}catch(error:any){emit('notify',error.message)}finally{submitting.value=false}
}
async function cancel(){try{if(props.state)await window.qwork!.cancelCliInstall(props.state.taskId)}catch(error:any){emit('notify',error.message)}}
</script>
<template>
<div class="cli-install-control">
  <p v-if="!agent.installed" class="cli-install-note">{{ t('桌面应用与 CLI 是不同入口，Qwork 需要可调用的 CLI。') }}</p>
  <div v-if="own" class="cli-install-status" role="status" aria-live="polite"><span>{{ t(state?.error||phases[state?.phase||'idle']) }}</span><button v-if="state?.canCancel" class="text-button" @click="cancel">{{ t('取消安装') }}</button></div>
  <template v-if="!agent.installed">
    <button type="button" class="button subtle full install-cli-button" :disabled="disabled||loading||!option?.supported||busy||submitting" @click="dialog?.showModal()"><Icon name="download" :size="15"/>{{ loading?t('正在检查安装入口…'):t('安装 CLI') }}</button>
    <p v-if="loadError||option?.reason" class="cli-install-note">{{ t(loadError||option?.reason||'') }}</p>
    <div class="cli-install-links"><button type="button" class="text-button" @click="help()">{{ t('官方安装说明') }}</button><button v-if="option?.packageName&&!option.supported" type="button" class="text-button" @click="help(true)">{{ t('安装 Node.js') }}</button></div>
  </template>
  <dialog ref="dialog" class="dialog cli-install-dialog" @cancel.prevent="!submitting&&dialog?.close()"><form @submit.prevent="confirm"><header class="dialog-header"><h2>{{ t('安装 CLI') }} · {{ agent.label }}</h2><button type="button" class="icon-button" :disabled="submitting" :aria-label="t('关闭')" @click="dialog?.close()"><Icon name="close"/></button></header><div class="dialog-body"><p>{{ t('将通过本机 npm 全局安装以下版本，安装需要联网。') }}</p><dl><div><dt>{{ t('安装包') }}</dt><dd>{{ option?.packageName }}</dd></div><div><dt>{{ t('版本') }}</dt><dd>{{ option?.version }}</dd></div><div><dt>{{ t('软件源') }}</dt><dd>registry.npmjs.org</dd></div></dl><pre>{{ option?.command }}</pre><p>{{ t('安装包会经过校验。安装后自动重新检测；登录和模型配置仍在原生 CLI 中完成。') }}</p><p>{{ t('安装过程会修改 npm 全局安装目录。取消安装不会自动卸载已写入的文件。') }}</p></div><footer class="dialog-footer"><button type="button" class="button subtle" :disabled="submitting" @click="dialog?.close()">{{ t('取消') }}</button><button type="submit" class="button primary" :disabled="submitting||busy">{{ submitting?t('正在准备安装…'):t('确认安装') }}</button></footer></form></dialog>
</div>
</template>
<style scoped>
.cli-install-control{margin-top:12px}.cli-install-note{font-size:10px;color:var(--muted);line-height:1.8;margin:8px 0}.cli-install-links{display:flex;gap:15px;margin-top:10px}.cli-install-links button{font-size:10px}.cli-install-status{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0;font-size:11px;line-height:1.8;color:var(--muted)}.cli-install-status button{white-space:nowrap;font-size:10px}.cli-install-dialog{width:560px}.cli-install-dialog h2{font-size:18px}.cli-install-dialog p{font-size:12px;line-height:1.8;color:var(--muted)}.cli-install-dialog dl{font-size:12px;margin:20px 0}.cli-install-dialog dl>div{display:flex;gap:18px;padding:6px 0}.cli-install-dialog dt{width:48px;color:var(--muted)}.cli-install-dialog dd{margin:0;overflow-wrap:anywhere}.cli-install-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--line);padding:14px;font-size:11px;line-height:1.8;border-radius:6px}
</style>
