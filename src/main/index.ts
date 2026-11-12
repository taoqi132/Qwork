import {DecisionNotifications} from './decision-notifications'
import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { AGENT_KINDS, LABELS, type AgentInfo, type GroupInput, type Snapshot } from '../shared/types'
import {translate} from '../shared/translate'
import { resolveLocale } from '../shared/locale'
import { Store, assertDirectory, hash, within } from './storage'
import { Workflow } from './workflow'
import { AgentService, redact } from './agents'
import { groupSchema, idSchema, kindSchema, sendSchema, settingsSchema } from './validation'
const smoke=process.argv.find(a=>a.startsWith('--qwork-smoke='))?.split('=').slice(1).join('=')
const packageCheck=process.argv.find(a=>a.startsWith('--qwork-package-check='))?.split('=').slice(1).join('=')
const isolatedRoot=packageCheck||(smoke&&!app.isPackaged?smoke:null)
if(isolatedRoot){fs.mkdirSync(path.resolve(isolatedRoot,'user-data'),{recursive:true});app.setPath('userData',path.resolve(isolatedRoot,'user-data'))}
app.setName('Qwork')
app.setAppUserModelId('io.qwork.desktop')
let window:BrowserWindow|null=null
let workflow:Workflow
let store:Store
let agents:AgentService
let quitting=false
const connectionTests=new Set<string>()
const renderer=path.join(__dirname,'../renderer/index.html')
const rendererUrl=pathToFileURL(renderer).href
let mockDetection:Snapshot['agentDetection']={status:'ready'}
let mockCatalog:AgentInfo[]|null=null
function snapshot():Snapshot{return {...structuredClone(store.state),agents:mockCatalog||agents.catalog,agentDetection:mockCatalog?mockDetection:agents.detection.state}}
const decisionNotifications=new DecisionNotifications(()=>{
  if(smoke||packageCheck||!Notification.isSupported())return undefined
  return new Notification({title:'Qwork · '+translate('需要你的决定',store.state.settings.locale),body:translate('任务需要你补充信息或作出决定，点击查看。',store.state.settings.locale),icon:path.join(__dirname,'../../assets/qwork.ico')})
},runId=>{
  const run=store.state.runs.find(r=>r.id===runId)
  if(!run?.gate||run.status!=='waiting'||!window||window.isDestroyed())return
  if(window.isMinimized())window.restore()
  window.show();window.focus();window.flashFrame(false);window.webContents.send('qwork:attention',runId)
})
function changed(){
  if(window&&!window.isDestroyed()){
    window.setTitle(translate('Qwork · 多Agent协作工作台',store.state.settings.locale));window.webContents.send('qwork:changed',snapshot())
    const gates=store.state.runs.filter(r=>r.status==='waiting'&&r.gate).map(r=>({id:r.gate!.id,runId:r.id}))
    decisionNotifications.sync(gates)
    if(!window.isFocused())window.flashFrame(gates.length>0)
  }
}

function assertIdle(groupId:string){if(workflow.busy(groupId))throw new Error('请先停止当前任务再修改此设置')}
function verifyMembers(input:GroupInput){
  if(!mockCatalog&&agents.detection.state.status!=='ready')throw new Error(agents.detection.state.status==='failed'?'Agent 检测失败，请重试':'正在查找本机 Agent，请稍候')
  const ready=new Set((mockCatalog||agents.catalog).filter(a=>a.installed&&a.compatible).map(a=>a.kind))
  if(input.agents.some(k=>!ready.has(k)))throw new Error('请先在设置中安装或检测所选 Agent')
}
function handle(name:string,fn:(...args:any[])=>unknown){
  ipcMain.handle(`qwork:${name}`,async(event:IpcMainInvokeEvent,...args:unknown[])=>{
    if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==rendererUrl)return {ok:false,error:'未授权的界面请求'}
    try{return {ok:true,data:await fn(...args)}}catch(error:any){return {ok:false,error:error instanceof z.ZodError?error.issues.map((i:any)=>i.message).join('；'):translate(redact(error.message||error),store.state.settings.locale)}}
  })
}
function register(){
  handle('get',()=>snapshot())
  handle('refresh',async()=>{if(!mockCatalog)await agents.refresh();else mockDetection={status:'ready'};changed();return snapshot()})
  handle('settings',(raw:unknown)=>{store.updateSettings({...settingsSchema.parse(raw),locale:resolveLocale(settingsSchema.parse(raw).languagePreference,app.getLocale()),workBuddyModelId:store.state.settings.workBuddyModelId||''});changed();return snapshot()})
  handle('workbuddy-settings',()=>agents.workBuddySettings())
  handle('workbuddy-model',async(raw:unknown)=>{
    if(workflowBusy()||connectionTests.size)throw new Error('请在任务或连接测试结束后切换模型，避免中途改变配置')
    const modelId=z.string().max(120).parse(raw),available=agents.workBuddySettings()
    if(modelId&&!available.models.some((m:{id:string})=>m.id===modelId))throw new Error('该模型不可用，请在 WorkBuddy 中配置支持工具调用的模型后刷新列表')
    const before=store.state.settings.workBuddyModelId
    store.state.settings.workBuddyModelId=modelId
    try{store.save()}catch(error){store.state.settings.workBuddyModelId=before;throw error}
    if(!mockCatalog)await agents.refresh()
    changed();return agents.workBuddySettings()
  })
  handle('pick-directory',async()=>{const result=await dialog.showOpenDialog(window!,{properties:['openDirectory','createDirectory']});return result.canceled?null:result.filePaths[0]})
  handle('create-group',(raw:unknown)=>{const input=groupSchema.parse(raw);verifyMembers(input);const g=store.createGroup(input);changed();return g})
  handle('update-group',(id:unknown,raw:unknown)=>{
    const key=idSchema.parse(id);assertIdle(key);const input=groupSchema.parse(raw);verifyMembers(input)
    const existing=store.group(key)
    if(input.workdir&&path.resolve(input.workdir)!==existing.workdir&&store.state.attachments.some(a=>a.groupId===key))throw new Error('该群聊已有附件，请为新的工作目录创建新群聊，避免资料引用失效')
    const g=store.updateGroup(key,input);changed();return g
  })
  handle('rename-group',(id:unknown,name:unknown)=>{const g=store.group(idSchema.parse(id));g.name=z.string().trim().min(1).max(60).parse(name);g.updatedAt=new Date().toISOString();store.save();changed()})
  handle('delete-group',async(id:unknown)=>{
    const key=idSchema.parse(id);store.group(key)
    for(const r of store.state.runs.filter(r=>r.groupId===key))await workflow.stop(r.id)
    const ids=new Set(store.state.runs.filter(r=>r.groupId===key).map(r=>r.id))
    store.state.groups=store.state.groups.filter(g=>g.id!==key)
    store.state.messages=store.state.messages.filter(m=>m.groupId!==key)
    store.state.runs=store.state.runs.filter(r=>r.groupId!==key)
    store.state.attachments=store.state.attachments.filter(a=>a.groupId!==key)
    store.state.artifacts=store.state.artifacts.filter(a=>!ids.has(a.runId));store.save();changed()
    // Never recursively remove user workspaces; detached copies/output files stay on disk.
  })
  handle('pick-attachments',async(id:unknown)=>{
    const key=idSchema.parse(id);assertIdle(key);store.group(key)
    const result=await dialog.showOpenDialog(window!,{title:translate('选择资料（由 Agent 自行读取）',store.state.settings.locale),properties:['openFile','multiSelections']})
    if(result.canceled)return []
    if(result.filePaths.length>10)throw new Error('每次最多导入 10 个文件')
    const imported=[]
    for(const filename of result.filePaths)imported.push(store.importAttachment(key,filename))
    changed();return imported
  })
  handle('discard-attachment',(id:unknown)=>{
    const key=idSchema.parse(id),a=store.state.attachments.find(a=>a.id===key)
    if(!a)return
    assertIdle(a.groupId)
    if(store.state.runs.some(r=>r.attachmentIds.includes(key)))throw new Error('历史任务仍引用此附件，不能移除；可从本次消息取消勾选')
    store.state.attachments=store.state.attachments.filter(a=>a.id!==key);store.save();changed()
  })
  handle('send',(raw:unknown)=>{
    const input=sendSchema.parse(raw),g=store.group(input.groupId)
    verifyMembers(g)
    if((mockCatalog||agents.catalog).some(a=>g.agents.includes(a.kind)&&a.credential==='missing'))throw new Error('团队中有 Agent 尚未登录或缺少模型配置，请在原生 CLI 中完成配置后重新检测')
    return workflow.start(input)
  })
  handle('stop',async(id:unknown)=>{await workflow.stop(idSchema.parse(id))})
  handle('adjust-rounds',(id:unknown,max:unknown)=>workflow.adjustRounds(idSchema.parse(id),z.number().int().min(1).max(8).parse(max)))
  handle('remove-agent',(id:unknown,kind:unknown)=>workflow.removeAgent(idSchema.parse(id),kindSchema.parse(kind)))
  handle('retry-execution',(id:unknown)=>{const key=idSchema.parse(id);verifyMembers(store.group(store.run(key).groupId));return workflow.retryExecution(key)})
  handle('decide',(id:unknown,response:unknown,gateId:unknown)=>workflow.decide(idSchema.parse(id),z.string().trim().min(1).max(48000).parse(response),gateId===undefined?undefined:idSchema.parse(gateId)))
  handle('open-output',async(id:unknown)=>{
    const run=store.run(idSchema.parse(id)),directory=within(run.settings.workdir,run.outputRelative)
    if(!fs.existsSync(directory))throw new Error('成果目录不存在')
    const error=await shell.openPath(directory);if(error)throw new Error(error)
  })
  handle('open-artifact',async(id:unknown)=>{
    const a=store.state.artifacts.find(a=>a.id===idSchema.parse(id));if(!a)throw new Error('成果文件不存在')
    const run=store.run(a.runId),filename=within(run.settings.workdir,a.relativePath)
    if(hash(fs.readFileSync(filename))!==a.sha256){a.checked=false;store.save();changed();throw new Error('文件已发生变化，原审查结果不再适用，请从成果目录检查新版本')}
    if(smoke&&!app.isPackaged){fs.writeFileSync(path.join(smoke,'opened-artifact.json'),JSON.stringify({id:a.id,runId:a.runId}));return}
    if(!/\.(pptx?|docx?|xlsx?|pdf|png|jpe?g|webp|gif|txt|md|csv)$/i.test(filename)){shell.showItemInFolder(filename);return}
    const error=await shell.openPath(filename);if(error)throw new Error(error)
  })
  handle('export-report',async(id:unknown)=>{
    const run=store.run(idSchema.parse(id)),group=store.group(run.groupId)
    const result=await dialog.showSaveDialog(window!,{defaultPath:`Qwork-${run.id.slice(0,8)}.md`,filters:[{name:'Markdown',extensions:['md']}]})
    if(result.canceled||!result.filePath)return
    const messages=store.state.messages.filter(m=>m.runId===run.id)
    const report=[`# ${group.name}`,`任务：${run.task}`,`状态：${run.status}`,`结论：${run.summary}`,`检查范围（Agent 报告）：${run.verification}`,...store.state.artifacts.filter(a=>a.runId===run.id).map(a=>`- ${a.name} (${a.size} bytes, SHA-256: ${a.sha256})`),'## 协作记录',...messages.map(m=>`### ${m.agent?LABELS[m.agent]:m.role} · ${m.stage}\n\n${m.text}`)].join('\n\n')
    fs.writeFileSync(result.filePath,redact(report),'utf8')
  })
  handle('diagnostics',async()=>{
    const result=await dialog.showSaveDialog(window!,{defaultPath:'Qwork-diagnostics.json',filters:[{name:'JSON',extensions:['json']}]})
    if(result.canceled||!result.filePath)return
    fs.writeFileSync(result.filePath,JSON.stringify({version:app.getVersion(),platform:process.platform,agents:mockCatalog||agents.catalog,runs:store.state.runs.map(r=>({id:r.id,status:r.status,stage:r.stage,error:redact(r.error),startedAt:r.startedAt,excludedAgents:r.excludedAgents,attempts:r.attempts?.slice(-30)}))},null,2))
  })
  handle('test-agent',async(raw:unknown)=>{
    const kind=kindSchema.parse(raw)
    if(workflowBusy())throw new Error('请在任务结束后测试连接')
    if(connectionTests.has(kind))throw new Error('该 Agent 正在测试连接，请稍候')
    connectionTests.add(kind)
    try{
      const result=await agents.runner({kind,prompt:'This is a user-requested Qwork connection test. Reply only QWORK_OK. Do not read files or execute tools.',workdir:store.dataDirectory,allowWrite:false,signal:AbortSignal.timeout(60000),timeoutMs:60000,onProgress:()=>{}})
      if(!result.text.includes('QWORK_OK'))throw new Error('CLI 返回了内容，但未确认连接测试成功')
      agents.recordConnection(kind,true);changed()
      return '连接成功'
    }catch(error:any){agents.recordConnection(kind,false,redact(error.message));changed();throw error}
    finally{connectionTests.delete(kind)}
  })
}
function workflowBusy(){return store.state.runs.some(r=>workflow.busy(r.groupId))}
async function launch(){
  const userData=app.getPath('userData')
  store=new Store(userData,path.join(userData,'projects'))
  store.state.settings.locale=resolveLocale(store.state.settings.languagePreference,app.getLocale());store.save()
  agents=new AgentService(userData,()=>store.state.settings.workBuddyModelId||'',()=>store.state.settings.allowWeb!==false,()=>store.state.settings.agentModels||{},()=>changed())
  let runner=agents.runner
  if(smoke&&!app.isPackaged){
    store.state.settings.locale='zh';store.state.settings.languagePreference='zh';store.save()
    mockCatalog=AGENT_KINDS.map(kind=>({kind,label:LABELS[kind],installed:true,compatible:true,credential:'ready',version:'SMOKE FIXTURE',source:'仅开发测试'}))
    runner=async input=>{
      await new Promise(r=>setTimeout(r,input.prompt.includes('[SMOKE_ROUNDS]')?1200:60))
      if(input.signal.aborted)throw new Error('stopped')
      input.onRuntimeEvent?.({type:'tool_start',summary:'开始调用工具',detail:'Smoke fixture: inspect materials',progress:true})
      if(input.kind==='workbuddy'&&input.prompt.includes('[SMOKE_AGENT_FAILURE]'))throw Object.assign(new Error('CLI 报告认证失败，请检查所选模型的原生凭据。'),{code:'AGENT_AUTH_FAILURE'})
      input.onRuntimeEvent?.({type:'tool_result_summary',summary:'工具执行已返回',progress:true})
      const en=input.prompt.includes('Reply in English unless')
      if(input.prompt.includes('[SMOKE_CLARIFY]')&&!input.prompt.includes('答：管理层'))return {text:`${en?'Please confirm the audience.':'需要确认受众。'}\n[[QWORK_RECEIPT:${JSON.stringify({summary:en?'Please confirm the audience':'请确认受众',status:'needs-human',issues:[],questions:[{question:en?'Who is this briefing for?':'受众是谁？',options:en?['Management','Engineering']:['管理层','技术团队'],scope:'task'}]})}]]`}
      const version=input.prompt.match(/候选版本：([a-f0-9]{64})/)?.[1]
      if(input.allowWrite){const match=input.prompt.match(/本次唯一成果目录：([^\n]+)/);if(match){fs.mkdirSync(match[1],{recursive:true});fs.writeFileSync(path.join(match[1],en?'project-brief.md':'交付示例.md'),'# Qwork smoke fixture\n仅用于本地自动化测试。')}}
      const fixtureLinks=version&&input.prompt.includes('测试资料协作，生成交付文件')?`\n\n[${en?'Open file':'下载PPT'}](<${en?'project-brief.md':'交付示例.md'}>)\n\n[${en?'Missing file':'无效文件'}](missing-file.pptx)`:''
      return {text:`${en?(version?'## Independent review\n\nDemo review response for the interface preview.\n\n- Output version: matched.\n- Feedback: ready for delivery in this simulated workflow.\n- Scope: fixture data only; no live model was called.':'## Launch briefing\n\nDemo response for the interface preview.\n\n### Suggested structure\n1. Objectives and audience\n2. Milestones and responsibilities\n3. Risks and decisions\n4. Next steps and acceptance criteria'):(input.prompt.includes('制作一份产品发布汇报')?(version?'## 独立检查\n\n以下为界面演示使用的模拟检查说明。\n\n- 文件版本：与提交检查的版本一致。\n- 检查结论：演示流程中已完成交付检查。\n- 检查范围：仅使用模拟数据，未调用真实模型。':'## 产品发布汇报\n\n以下为界面演示的模拟方案。\n\n### 汇报结构\n1. 目标与受众\n2. 里程碑与负责人\n3. 风险与待决定事项\n4. 下一步计划与验收标准'):'这是一条仅供开发验收的模拟回复。')}${fixtureLinks}\n[[QWORK_RECEIPT:${JSON.stringify({summary:en?(version?'Demo review complete':'Briefing structure assembled'):'测试任务阶段已完成',status:version?'approve':'ready',reviewedVersion:version,issues:[],verification:en?'UI demonstration with fixture data; no live model was called.':'仅为开发测试，未调用真实模型'})}]]`}
    }
  }
  workflow=new Workflow(store,runner,changed,event=>window?.webContents.send('qwork:progress',event))
  register()
  window=new BrowserWindow({width:1460,height:960,minWidth:1040,minHeight:720,title:'Qwork · 多Agent协作工作台',icon:path.join(__dirname,'../../assets/qwork.ico'),backgroundColor:'#f5f5f0',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}})
  window.on('focus',()=>window?.flashFrame(false))
  Menu.setApplicationMenu(null)
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  window.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==rendererUrl)event.preventDefault()})
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false))
  window.webContents.session.setPermissionCheckHandler(()=>false)
  await window.loadFile(renderer)
  if(packageCheck){
    try{
      await agents.refresh();changed()
      for(let i=0;i<100;i++){
        if(await window.webContents.executeJavaScript("document.querySelectorAll('.mode-card').length===4"))break
        await new Promise(resolve=>setTimeout(resolve,100))
      }
      const rendererState=await window.webContents.executeJavaScript('window.qwork.get()')
      const fourModes=await window.webContents.executeJavaScript("document.querySelectorAll('.mode-card').length===4")
      if(rendererState.agents.length!==6||!fourModes)throw new Error('Packaged renderer / IPC verification failed')
      fs.writeFileSync(path.join(packageCheck,'result.json'),JSON.stringify({ok:true,packaged:app.isPackaged,version:app.getVersion(),modes:4,agents:rendererState.agents.map((a:AgentInfo)=>({kind:a.kind,installed:a.installed})),mockProvider:false},null,2))
      app.quit()
    }catch(error:any){fs.writeFileSync(path.join(packageCheck,'failure.txt'),redact(error.stack||error));app.exit(1)}
  }else if(smoke&&!app.isPackaged){
    const {runSmoke}=await import('./smoke')
    try{await runSmoke(window,smoke,(groupId,filename)=>{store.importAttachment(groupId,filename);changed()},status=>{mockDetection={status};changed()});app.quit()}catch(error:any){fs.writeFileSync(path.join(smoke,'failure.txt'),String(error.stack||error));app.exit(1)}
  }else agents.refresh().then(changed).catch(error=>{console.error(redact(error.message))})
}
if(!app.requestSingleInstanceLock())app.quit()
else{
  app.on('second-instance',()=>{window?.show();window?.focus()})
  app.whenReady().then(launch).catch(error=>{dialog.showErrorBox('Qwork 启动失败',redact(error.message));app.exit(1)})
  app.on('window-all-closed',()=>app.quit())
  app.on('before-quit',event=>{
    if(quitting||!workflow)return
    event.preventDefault();quitting=true
    Promise.allSettled([workflow.shutdown(),agents.shutdown()]).finally(()=>app.quit())
  })
}
