import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { Artifact, Attachment, Group, GroupInput, Run, Settings, State } from '../shared/types'
import {excludedMemberId} from '../shared/agent-members'
import {migrateState,normalizeGroupInput} from './state-migration'

export const now = () => new Date().toISOString()
export const hash = (v:string|Buffer) => createHash('sha256').update(v).digest('hex')
export function assertDirectory(directory:string) {
  if(!path.isAbsolute(directory)||/[\x00-\x1f]/.test(directory))throw new Error('请选择有效的绝对目录')
  const resolved=path.resolve(directory)
  if(resolved===path.parse(resolved).root)throw new Error('不能使用磁盘根目录作为工作目录')
  fs.mkdirSync(resolved,{recursive:true})
  if(!fs.statSync(resolved).isDirectory())throw new Error('工作目录不可用')
  return fs.realpathSync(resolved)
}
export function within(root:string,relative:string,createParents=false) {
  if(!relative||path.isAbsolute(relative))throw new Error('文件引用无效')
  const base=fs.realpathSync(root)
  const target=path.resolve(base,relative)
  const rel=path.relative(base,target)
  if(!rel||rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error('文件超出授权目录')
  let current=base
  const parts=rel.split(path.sep)
  for(let i=0;i<parts.length;i++){
    current=path.join(current,parts[i])
    if(!fs.existsSync(current)){
      if(createParents&&i<parts.length-1)fs.mkdirSync(current)
      else continue
    }
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw new Error('不允许通过链接访问文件')
    if(fs.existsSync(current)){
      const actual=fs.realpathSync(current),r=path.relative(base,actual)
      if(r==='..'||r.startsWith(`..${path.sep}`)||path.isAbsolute(r))throw new Error('文件超出授权目录')
    }
  }
  return target
}
export class Store {
  state:State
  readonly filename:string
  constructor(readonly dataDirectory:string,defaultDirectory:string){
    fs.mkdirSync(dataDirectory,{recursive:true}); this.filename=path.join(dataDirectory,'workspace.json')
    const initial:State={version:2,settings:{defaultDirectory,maxRounds:5,locale:'zh',timeoutMinutes:30},groups:[],attachments:[],messages:[],runs:[],artifacts:[]}
    if(fs.existsSync(this.filename)){
      const raw=JSON.parse(fs.readFileSync(this.filename,'utf8'))
      if(!['groups','runs','messages','attachments','artifacts'].every(k=>Array.isArray(raw[k])))throw new Error('工作区数据格式不支持，请保留原文件后联系维护者')
      this.state=migrateState(raw)
    }else this.state=initial
    for(const run of this.state.runs) if(['running','waiting'].includes(run.status)){
      run.status='interrupted';run.stage='finished';run.finishedAt=now();run.summary='应用已退出，本次任务中断。已有文件保留，重新执行前请检查。'; delete run.gate;run.activeAgents=[];run.activeMemberIds=[];delete run.currentAgent;delete run.currentMemberId
      for(const attempt of run.attempts||[])if(attempt.status==='running'){attempt.status='interrupted';attempt.finishedAt=now();attempt.events.push({id:randomUUID(),at:now(),type:'warning',summary:'应用已退出，本轮调用中断。'})}
    }
    delete (this.state.settings as Settings & {accentColor?:string}).accentColor
    this.state.settings.noExecutionTimeoutMinutes??=5
    for(const key of ['startupTimeoutSeconds','idleTimeoutSeconds','progressTimeoutSeconds'])delete (this.state.settings as unknown as Record<string,unknown>)[key]
    this.save()
  }
  save(){
    const temp=this.filename+'.tmp'
    const fd=fs.openSync(temp,'w',0o600)
    try{fs.writeFileSync(fd,JSON.stringify(this.state,null,2));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    fs.renameSync(temp,this.filename)
  }
  group(id:string):Group{const g=this.state.groups.find(g=>g.id===id);if(!g)throw new Error('群聊不存在');return g}
  run(id:string):Run{const r=this.state.runs.find(r=>r.id===id);if(!r)throw new Error('任务不存在');return r}
  createGroup(raw:GroupInput){
    const input=normalizeGroupInput(raw)
    const id=randomUUID()
    const workdir=assertDirectory(input.workdir||path.join(this.state.settings.defaultDirectory,`project-${id.slice(0,8)}`))
    const fallback=this.state.settings.locale==='en'?(input.kind==='direct'?'Untitled conversation':'Untitled group'):(input.kind==='direct'?'未命名对话':'未命名群聊')
    const group:Group={...input,summarizer:input.executor,id,workdir,name:input.name.trim()||fallback,createdAt:now(),updatedAt:now()}
    this.state.groups.unshift(group);this.save();return group
  }
  updateGroup(id:string,raw:GroupInput){
    const group=this.group(id),input=normalizeGroupInput(raw)
    const workdir=assertDirectory(input.workdir||group.workdir)
    Object.assign(group,input,{summarizer:input.executor,workdir,updatedAt:now()});group.excludedAgents=group.excludedAgents?.filter(a=>!input.agents.some(member=>member.id===excludedMemberId(a)));this.save();return group
  }
  importAttachment(groupId:string,source:string):Attachment{
    const group=this.group(groupId),stat=fs.lstatSync(source)
    if(stat.isSymbolicLink()||!stat.isFile()||stat.size<=0||stat.size>128*1024*1024)throw new Error('请选择非空的普通文件，单文件上限 128 MB')
    const id=randomUUID(),name=path.basename(source)
    const safe=name.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,150)
    const relativePath=path.join('.qwork','inputs',id,safe)
    const dest=within(group.workdir,relativePath,true)
    fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL)
    const a:Attachment={id,groupId,name,size:stat.size,relativePath,sha256:hash(fs.readFileSync(dest)),importedAt:now()}
    this.state.attachments.push(a);this.save();return a
  }
  resolveAttachment(a:Attachment){
    const filename=within(this.group(a.groupId).workdir,a.relativePath)
    if(!fs.statSync(filename).isFile()||hash(fs.readFileSync(filename))!==a.sha256)throw new Error(`附件已改变或不可用：${a.name}`)
    return filename
  }
  scanArtifacts(run:Run):Artifact[]{
    const group=run.settings
    const output=within(group.workdir,run.outputRelative)
    const list:Artifact[]=[]
    if(!fs.existsSync(output))return list
    const visit=(dir:string,depth:number)=>{
      if(depth>6||list.length>=100)return
      for(const entry of fs.readdirSync(dir,{withFileTypes:true}).slice(0,200)){
        if(entry.isSymbolicLink()||entry.name.startsWith('.'))continue
        const filename=within(group.workdir,path.relative(group.workdir,path.join(dir,entry.name)))
        if(entry.isDirectory())visit(filename,depth+1)
        else if(entry.isFile()){
          const stat=fs.statSync(filename)
          if(stat.size>0&&stat.size<=256*1024*1024){
            const relativePath=path.relative(group.workdir,filename),sha256=hash(fs.readFileSync(filename))
            const prior=this.state.artifacts.find(a=>a.runId===run.id&&a.relativePath===relativePath)
            list.push({id:prior?.id||randomUUID(),runId:run.id,name:path.relative(output,filename),relativePath,size:stat.size,sha256,checked:prior?.sha256===sha256&&prior.checked||false})
          }
        }
        if(list.length>=100)break
      }
    }
    visit(output,0)
    this.state.artifacts=this.state.artifacts.filter(a=>a.runId!==run.id).concat(list);return list
  }
  updateSettings(settings:Settings){this.state.settings={...settings,defaultDirectory:assertDirectory(settings.defaultDirectory)};this.save()}
}
