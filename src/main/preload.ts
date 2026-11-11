import { contextBridge, ipcRenderer } from 'electron'
import type { ApiResult, DesktopApi } from '../shared/types'
async function invoke<T>(name:string,...args:unknown[]):Promise<T>{
  const result=await ipcRenderer.invoke(`qwork:${name}`,...args) as ApiResult<T>
  if(!result.ok)throw new Error(result.error||'操作失败')
  return result.data as T
}
function subscribe<T>(name:string,fn:(data:T)=>void){
  const listener=(_event:unknown,data:T)=>fn(data)
  ipcRenderer.on(`qwork:${name}`,listener)
  return ()=>ipcRenderer.removeListener(`qwork:${name}`,listener)
}
const api:DesktopApi={
  adjustRounds:(id,max)=>invoke('adjust-rounds',id,max),
  removeAgent:(id,kind)=>invoke('remove-agent',id,kind),
  workBuddySettings:()=>invoke('workbuddy-settings'),setWorkBuddyModel:id=>invoke('workbuddy-model',id),
  get:()=>invoke('get'),refresh:()=>invoke('refresh'),settings:input=>invoke('settings',input),
  pickDirectory:()=>invoke('pick-directory'),createGroup:input=>invoke('create-group',input),
  updateGroup:(id,input)=>invoke('update-group',id,input),renameGroup:(id,name)=>invoke('rename-group',id,name),
  deleteGroup:id=>invoke('delete-group',id),pickAttachments:id=>invoke('pick-attachments',id),discardAttachment:id=>invoke('discard-attachment',id),
  send:input=>invoke('send',input),stop:id=>invoke('stop',id),decide:(id,response,gateId)=>invoke('decide',id,response,gateId),
  openArtifact:id=>invoke('open-artifact',id),openOutput:id=>invoke('open-output',id),exportReport:id=>invoke('export-report',id),diagnostics:()=>invoke('diagnostics'),testAgent:kind=>invoke('test-agent',kind),
  retryExecution:id=>invoke('retry-execution',id),
  onAttention:fn=>subscribe<string>('attention',fn),
  onChanged:fn=>subscribe('changed',fn),onProgress:fn=>subscribe('progress',fn)
}
if(location.protocol==='file:')contextBridge.exposeInMainWorld('qwork',Object.freeze(api))
