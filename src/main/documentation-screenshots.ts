import fs from 'node:fs'
import path from 'node:path'
import type {BrowserWindow} from 'electron'

/** Development-only screenshots of actual localized UI with isolated fixture data. */
export async function captureDocumentation(window:BrowserWindow,directory:string){
 const js=(code:string)=>window.webContents.executeJavaScript(code,true)
 async function wait(code:string){for(let n=0;n<150;n++){if(await js(code))return;await new Promise(r=>setTimeout(r,100))}throw new Error('Docs screenshot timeout: '+code)}
 async function click(text:string){await js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim().includes(${JSON.stringify(text)}));if(!b)throw Error('Missing docs control');b.click()})()`)}
 async function capture(name:string,language:string){
  if(!await js(`document.documentElement.lang===${JSON.stringify(language)}`))throw new Error('Wrong screenshot language')
  window.showInactive();await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await new Promise(r=>setTimeout(r,400))
  const picture=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})
  if(picture.isEmpty())throw new Error('Empty documentation screenshot')
  fs.writeFileSync(path.join(directory,name),picture.toPNG())
 }
 for(const language of ['zh','en']){
  await js(`(async()=>{const s=await window.qwork.get();for(const g of s.groups)await window.qwork.deleteGroup(g.id);await window.qwork.settings({...s.settings,themePreference:'light',languagePreference:${JSON.stringify(language)}})})()`)
  await wait(`document.documentElement.lang==='${language==='zh'?'zh-CN':'en'}'`)
  const en=language==='en',locale=en?'en':'zh-CN',home=en?'Workspace':'工作台',settings=en?'Settings & agents':'设置与 Agent'
  const name=en?'Product launch briefing':'产品发布汇报'
  const task=en?'Create a concise launch briefing covering objectives, milestones, risks and next steps. Deliver a Markdown file for review.':'制作一份产品发布汇报，包含目标、里程碑、风险和下一步计划，交付 Markdown 文件并检查。'
  const group=await js(`(async()=>{const s=await window.qwork.get();return window.qwork.createGroup({name:${JSON.stringify(name)},goal:'',kind:'group',agents:['codex','claude','workbuddy'],workdir:s.settings.defaultDirectory,allowWrite:true,mode:'auto',maxRounds:5,moderator:'codex',summarizer:'claude',executor:'claude',executeAfter:true,recommended:false})})()`)
  await click(home);await wait("!!document.querySelector('.mode-grid')")
  await capture(`docs-${language}-home.png`,locale)
  await js(`window.qwork.send({groupId:${JSON.stringify(group.id)},text:${JSON.stringify(task)},attachmentIds:[],mode:'auto'})`)
  await wait(`window.qwork.get().then(s=>s.runs.some(r=>r.groupId===${JSON.stringify(group.id)}&&r.status==='completed'))`)
  await js(`[...document.querySelectorAll('.history-item')].find(e=>e.textContent.includes(${JSON.stringify(name)})).click()`)
  await wait("!!document.querySelector('.deliverables-panel')&&!!document.querySelector('.agent-message[open]')")
  await js("(()=>{const el=document.querySelector('.conversation-scroll');el.scrollTop=el.scrollHeight})()")
  await capture(`docs-${language}-delivery.png`,locale)
  await click(settings);await wait("document.querySelectorAll('.agent-setting-card').length===6")
  await capture(`docs-${language}-agents.png`,locale)
  await js("document.querySelector('#settings-tab-execution').click()")
  await wait("!!document.querySelector('[data-testid=allow-web]')")
  await capture(`docs-${language}-execution.png`,locale)
  const clarifier=await js(`(async()=>{const s=await window.qwork.get();return window.qwork.createGroup({name:${JSON.stringify(en?'Clarify before creating':'先澄清，再交付')},goal:'[SMOKE_CLARIFY]',kind:'group',agents:['codex','claude'],workdir:s.settings.defaultDirectory,allowWrite:false,mode:'auto',maxRounds:3,moderator:'codex',summarizer:'claude',executor:'claude',executeAfter:false,recommended:false})})()`)
  const run=await js(`window.qwork.send({groupId:${JSON.stringify(clarifier.id)},text:${JSON.stringify(en?'Outline a briefing for the launch. Confirm the intended audience before proceeding.':'整理一份发布汇报提纲，开始前请确认受众。')},attachmentIds:[],mode:'auto'})`)
  await wait(`window.qwork.get().then(s=>s.runs.find(r=>r.id===${JSON.stringify(run.id)})?.gate?.kind==='clarification')`)
  window.webContents.send('qwork:attention',run.id)
  await wait("!!document.querySelector('.decision-modal[open]')&&!!document.querySelector('.clarification-questions')")
  await capture(`docs-${language}-clarification.png`,locale)
  await js(`window.qwork.stop(${JSON.stringify(run.id)})`)
 }
}
