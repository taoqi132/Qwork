<script setup lang="ts">
import {t,locale} from '../i18n'

import { onMounted, ref } from 'vue'
import type { WorkBuddySettings } from '../../shared/types'
const emit=defineEmits<{notify:[message:string]}>()
const settings=ref<WorkBuddySettings>({modelId:'',models:[]}),selected=ref(''),busy=ref(false),error=ref('')
async function load(){busy.value=true;try{settings.value=await window.qwork!.workBuddySettings();selected.value=settings.value.modelId;error.value=''}catch(e:any){error.value=e.message}finally{busy.value=false}}
async function save(){busy.value=true;try{settings.value=await window.qwork!.setWorkBuddyModel(selected.value);error.value='';emit('notify',t("WorkBuddy 模型已保存，连接测试与后续任务将使用此选择"))}catch(e:any){error.value=e.message}finally{busy.value=false}}
onMounted(load)
</script>
<template><section class="workbuddy-picker"><label class="field">{{ t("执行模型") }}<select v-model="selected" :disabled="busy" :aria-label="t('WorkBuddy 执行模型')"><option value="">{{ t("跟随 CLI 默认模型") }}</option><option v-for="model in settings.models" :key="model.id" :value="model.id">{{ model.name }}</option><option v-if="selected&&!settings.models.some(m=>m.id===selected)" :value="selected">{{ selected }}{{ t("（当前不可用）") }}</option></select></label><div class="label-row"><button class="text-button" :disabled="busy" @click="load">{{ t("刷新模型列表") }}</button><button class="button subtle" :disabled="busy||selected===settings.modelId" @click="save">{{ busy?t("处理中…"):t("保存模型") }}</button></div><p v-if="error" class="error-inline" role="alert">{{ error }}</p></section></template>
<style scoped>.workbuddy-picker{border-top:1px solid var(--line);padding-top:15px;margin:15px 0}.workbuddy-picker .field{font-size:11px;margin-bottom:8px}.workbuddy-picker p{font-size:10px;line-height:1.8;color:var(--color-71806b,#71806b);margin-top:10px}.workbuddy-picker select{width:100%;font-size:11px}</style>
