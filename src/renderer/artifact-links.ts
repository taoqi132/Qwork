import {marked} from 'marked'
import type {Artifact,Run} from '../shared/types'

const escapeAttribute=(value:string)=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
// A data attribute preserves Windows/file links that normal HTML sanitization removes.
// Clicking never navigates: the caller resolves only registered artifacts by ID.
export function markdownWithLinks(text:string):string{
  const renderer=new marked.Renderer()
  renderer.link=(href,title,label)=>`<a href="#" data-qwork-link="${escapeAttribute(href||'')}"${title?` title="${escapeAttribute(title)}"`:''}>${label}</a>`
  return marked.parse(text,{renderer}) as string
}

function normalize(value:string):string{
  const segments:string[]=[]
  for(const part of value.replace(/\\/g,'/').split('/')){
    if(!part||part==='.')continue
    if(part==='..')segments.pop();else segments.push(part)
  }
  return segments.join('/').toLowerCase()
}

export function resolveArtifactLink(href:string,run:Run,artifacts:Artifact[]):Artifact|undefined{
  let target:string
  try{target=decodeURIComponent(href.trim().split(/[?#]/)[0])}catch{return}
  if(!target||/[\x00-\x1f]/.test(target))return
  const candidates=artifacts.filter(a=>a.runId===run.id)
  // Some CLIs emit sandbox download links even when their files are on Windows.
  if(/^sandbox:\/mnt\/data\//i.test(target)){
    const name=target.slice('sandbox:/mnt/data/'.length)
    if(name.includes('/')||name.includes('\\'))return
    const matches=candidates.filter(a=>a.name.toLowerCase()===name.toLowerCase())
    return matches.length===1?matches[0]:undefined
  }
  if(/^file:\/\//i.test(target)){
    // Remote file shares are never inferred from a link.
    if(!/^file:\/\/\/[a-z]:[\\/]/i.test(target))return
    target=target.replace(/^file:\/\/\//i,'')
  }else if(/^[a-z][a-z\d+.-]*:/i.test(target)&&!(/^[a-z]:[\\/]/i.test(target)))return
  const absolute=/^(?:[a-z]:[\\/]|\/|\\)/i.test(target)
  const paths=absolute?[normalize(target)]:[
    normalize(run.settings.workdir+'/'+target),
    normalize(run.settings.workdir+'/'+run.outputRelative+'/'+target)
  ]
  const matches=candidates.filter(a=>paths.includes(normalize(run.settings.workdir+'/'+a.relativePath)))
  return matches.length===1?matches[0]:undefined
}
