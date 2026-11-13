<script setup lang="ts">
import {t,locale} from './i18n'

import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { Group, GroupInput, Mode, ProgressEvent, SendInput, Settings, Snapshot } from '../shared/types'
import { memberDisplayNameById } from '../shared/agent-members'
import { modes } from './content'
import Icon from './components/Icon.vue'
import GroupEditor from './components/GroupEditor.vue'
import SettingsView from './components/SettingsView.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import HomeView from './components/HomeView.vue'
import StartupView from './components/StartupView.vue'
import {applyAppearance} from './appearance'
import logo from '../../assets/qwork.svg'
const api=window.qwork
const snapshot=ref<Snapshot|null>(null),view=ref<'home'|'settings'|'group'>('home'),groupId=ref(''),loading=ref(true),refreshing=ref(false),fatal=ref('')
const startupDone=ref(false)
function enterWorkspace(settings=false){startupDone.value=true;if(settings)view.value='settings'}
const search=ref(''),toast=ref(''),editor=ref<{mode:Mode;direct?:boolean;skipMode?:boolean;group?:Group}|null>(null),menuId=ref('')
const confirm=ref<{group:Group;kind:'rename'|'delete'}|null>(null),rename=ref('')
const confirmDialog=ref<HTMLDialogElement>(),workspaceView=ref<InstanceType<typeof WorkspaceView>>()
const progress=ref<Record<string,ProgressEvent>>({})
let timer:ReturnType<typeof setTimeout>,unsubscribe=()=>{},unprogress=()=>{},unattention=()=>{}
const group=computed(()=>snapshot.value?.groups.find(g=>g.id===groupId.value))
const groups=computed(()=>snapshot.value?.groups.filter(g=>g.name.toLowerCase().includes(search.value.toLowerCase())).slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))||[])
const installed=computed(()=>snapshot.value?.agents.filter(a=>a.installed&&a.compatible).length||0)
const detectionStatus=computed(()=>snapshot.value?.agentDetection?.status||'ready')
const detecting=computed(()=>refreshing.value||detectionStatus.value==='searching')
const completed=computed(()=>snapshot.value?.runs.filter(r=>r.status==='completed').length||0)
watch(()=>[snapshot.value?.settings.themePreference,snapshot.value?.settings.themePreference],()=>applyAppearance(snapshot.value?.settings),{immediate:true})
watch(()=>snapshot.value?.settings.locale,value=>{if(value){locale.value=value;document.documentElement.lang=value==='zh'?'zh-CN':'en'}})
const toastSuccess=ref(false)
function notify(message:string){toastSuccess.value=message==='连接成功'||message===t('连接成功');toast.value=t(message);clearTimeout(timer);timer=setTimeout(()=>toast.value='',6500)}
async function action<T>(fn:()=>Promise<T>):Promise<T|undefined>{try{return await fn()}catch(error:any){notify(error.message)}}
async function refresh(){if(!api)return;refreshing.value=true;try{snapshot.value=await api.refresh()}catch(e:any){notify(e.message)}finally{refreshing.value=false}}
onMounted(async()=>{
  if(!api){fatal.value=t("请通过 Qwork Windows 桌面应用打开。此界面需要安全的本地运行桥接。");loading.value=false;return}
  unattention=api.onAttention(async id=>{try{snapshot.value=await api.get();const run=snapshot.value.runs.find(r=>r.id===id);if(!run?.gate)return;editor.value=null;confirm.value=null;menuId.value='';groupId.value=run.groupId;view.value='group';await nextTick();workspaceView.value?.focusRun(id)}catch(error:any){notify(error.message)}})
  unsubscribe=api.onChanged(value=>{
    if(snapshot.value){
      const prior=new Set(snapshot.value.runs.flatMap(r=>(r.excludedAgents||[]).map(a=>r.id+':'+(a.memberId||a.kind))))
      for(const run of value.runs)for(const excluded of run.excludedAgents||[])if(!prior.has(run.id+':'+(excluded.memberId||excluded.kind)))notify(memberDisplayNameById(excluded.memberId,excluded.kind,run.settings.agents)+' · '+t(excluded.category==='manual'?'已移出':'异常已移出')+': '+t(excluded.reason))
    }
    snapshot.value=value
  })
  unprogress=api.onProgress(event=>{const key=event.runId+(event.memberId||event.agent),prior=progress.value[key];progress.value[key]={...event,text:event.reset?'':(prior?.stage===event.stage&&(!event.attemptId||prior.attemptId===event.attemptId)?prior.text:'')+event.text};if(progress.value[key].text.length>200000)progress.value[key].text=progress.value[key].text.slice(0,200000)})
  try{snapshot.value=await api.get()}catch(e:any){fatal.value=e.message}finally{loading.value=false}
})
onUnmounted(()=>{unsubscribe();unprogress();unattention();clearTimeout(timer)})
function openGroup(g:Group){groupId.value=g.id;view.value='group';menuId.value=''}
function create(mode:Mode,direct=false,skipMode=false){if(detectionStatus.value!=='ready'||detecting.value){notify(t(detectionStatus.value==='failed'?'Agent 检测失败，请重试':'正在查找本机 Agent，请稍候'));view.value='settings';return}if(direct&&installed.value<1){notify(t("请先在设置中检测并准备足够数量的 Agent"));view.value='settings';return}editor.value={mode,direct,skipMode}}
async function saveGroup(input:GroupInput){
  if(!api)return
  const saved=await action(()=>editor.value?.group?api.updateGroup(editor.value.group.id,input):api.createGroup(input))
  if(saved){editor.value=null;openGroup(saved)}
}
async function saveSettings(settings:Settings){if(api&&await action(()=>api.settings(settings)))notify(t("设置已保存"))}
async function send(input:SendInput){if(api&&await action(()=>api.send(input)))workspaceView.value?.accepted()}
function confirmAction(g:Group,kind:'rename'|'delete'){confirm.value={group:g,kind};rename.value=g.name;menuId.value='';setTimeout(()=>confirmDialog.value?.showModal(),0)}
async function executeConfirm(){
  if(!confirm.value||!api)return
  const item=confirm.value
  try{
    if(item.kind==='rename')await api.renameGroup(item.group.id,rename.value)
    else{await api.deleteGroup(item.group.id);if(groupId.value===item.group.id){view.value='home';groupId.value=''}}
    confirm.value=null
  }catch(e:any){notify(e.message)}
}
</script>
<template>
<StartupView v-if="!startupDone&&!fatal" :agents="snapshot?.agents||[]" :status="detectionStatus" :loading="loading" @enter="enterWorkspace" @retry="refresh"/>
<div v-else-if="loading||fatal" class="boot-screen"><img :src="logo" width="64" height="64" alt="Qwork"><h1>Qwork</h1><p>{{ fatal||t("正在打开你的协作工作台…") }}</p></div>
<div v-else-if="snapshot" class="app-shell" @click="menuId=''">
  <aside class="sidebar"><button class="brand" @click="view='home'"><img :src="logo" width="38" height="38" alt=""><div><strong>Qwork<span class="brand-dot">.</span></strong><small>{{ t("多Agent协作工作台") }}</small></div></button><nav class="main-nav"><button :class="{active:view==='home'}" @click="view='home'"><Icon name="home" :size="18"/>{{ t("工作台") }}</button><button @click="create('auto',true)"><Icon name="chat" :size="18"/>{{ t("开始单聊") }}<Icon name="arrow" :size="15"/></button></nav><div class="history-heading"><span>{{ t("最近对话") }}</span><span>{{ snapshot.groups.length.toString().padStart(2,'0') }}</span></div><label class="sidebar-search"><Icon name="search" :size="15"/><input v-model="search" :placeholder="t('搜索对话')" :aria-label="t('搜索对话')"></label><div class="history-list"><div v-for="g in groups" :key="g.id" :class="['history-item',{selected:view==='group'&&groupId===g.id}]" @click="openGroup(g)" role="button" tabindex="0" @keydown.enter="openGroup(g)"><Icon :name="g.kind==='direct'?'chat':'group'" :size="16"/><span class="history-name">{{ g.name }}</span><span v-if="snapshot.runs.some(r=>r.groupId===g.id&&['running','waiting'].includes(r.status))" class="history-running"/><button class="history-more icon-button" :aria-label="t('管理')+' '+g.name" @click.stop="menuId=menuId===g.id?'':g.id"><Icon name="more" :size="17"/></button><div v-if="menuId===g.id" class="history-menu" @click.stop><button @click="confirmAction(g,'rename')"><Icon name="edit" :size="15"/>{{ t("修改名称") }}</button><button class="danger" @click="confirmAction(g,'delete')"><Icon name="trash" :size="15"/>{{ t("删除记录") }}</button></div></div><p v-if="!groups.length" class="history-empty">{{ search?t("没有匹配的对话"):t("每次协作，都会留在这里。") }}</p></div><div class="sidebar-footer"><div class="local-state"><span class="local-dot"/><span>{{ t("本地工作区") }}</span><small v-if="detecting" class="agent-discovery-status" role="status" aria-live="polite"><Icon name="refresh" class="spin" :size="12"/>{{ t('正在查找本机 Agent…') }}</small><button v-else-if="detectionStatus==='failed'" class="text-button agent-discovery-status" @click="refresh">{{ t('检测失败，点击重试') }}</button><small v-else>{{ installed }}/6 Agent</small></div><div class="settings-nav-row"><button :class="['settings-nav',{active:view==='settings'}]" @click="view='settings'"><Icon name="settings" :size="18"/>{{ t("设置与 Agent") }}</button></div></div></aside>
  <main class="main-content">
    <HomeView v-if="view==='home'" :completed="completed" @create="mode=>create(mode,false,true)" @settings="view='settings'"/>
    <SettingsView v-else-if="view==='settings'" :settings="snapshot.settings" :agents="snapshot.agents" :refreshing="detecting" :detection-failed="detectionStatus==='failed'" :install-state="snapshot.cliInstall" @save="saveSettings" @refresh="refresh" @notify="notify"/>
    <WorkspaceView v-else-if="group" ref="workspaceView" :group="group" :snapshot="snapshot" :progress="progress" @create-group="create('auto')" @notify="notify" @edit="editor={mode:group.mode,group}" @send="send" @stop="id=>action(()=>api!.stop(id))" @decide="(id,response)=>action(()=>api!.decide(id,response))" @attach="action(()=>api!.pickAttachments(group!.id))" @open="id=>action(()=>api!.openArtifact(id))" @output="id=>action(()=>api!.openOutput(id))" @export="id=>action(()=>api!.exportReport(id))"/>
  </main>
  <GroupEditor v-if="editor" :skip-mode="editor.skipMode" :mode="editor.mode" :group="editor.group" :direct="editor.direct" :agents="snapshot.agents" :default-rounds="snapshot.settings.maxRounds" :default-directory="snapshot.settings.defaultDirectory" :settings="snapshot.settings" @close="editor=null" @save="saveGroup"/>
  <dialog v-if="confirm" ref="confirmDialog" class="dialog confirm-dialog" @cancel.prevent="confirm=null"><form @submit.prevent="executeConfirm"><header class="dialog-header"><h2>{{ confirm.kind==='rename'?t("修改名称"):t("删除对话记录？") }}</h2><button type="button" class="icon-button" :aria-label="t('关闭')" @click="confirm=null"><Icon name="close"/></button></header><div class="dialog-body"><label v-if="confirm.kind==='rename'" class="field">{{ t("名称") }}<input v-model="rename" required maxlength="60" autofocus><small>{{ t("名称只用于显示，不会改变模型任务背景。") }}</small></label><p v-else>{{ t("将停止相关运行并删除“") }}{{ confirm.group.name }}{{ t("”的应用记录。工作目录、原始资料与已生成文件保留。") }}</p></div><footer class="dialog-footer"><button type="button" class="button subtle" @click="confirm=null">{{ t("取消") }}</button><button :class="['button',confirm.kind==='delete'?'danger-button':'primary']" :disabled="confirm.kind==='rename'&&!rename.trim()">{{ confirm.kind==='rename'?t("保存名称"):t("删除记录") }}</button></footer></form></dialog>
  <div v-if="toast" class="toast" role="status"><Icon :name="toastSuccess?'check-circle':'alert'" :size="17"/><span>{{ toast }}</span><button class="icon-button" :aria-label="t('关闭提示')" @click="toast=''"><Icon name="close" :size="16"/></button></div>
</div>
</template>

<style scoped>.agent-discovery-status{display:flex;align-items:center;gap:5px;font-size:10px;min-width:0}.local-state:has(.agent-discovery-status){flex-wrap:wrap}.agent-discovery-status>svg{flex-shrink:0}</style>
