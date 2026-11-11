import {describe,it,expect} from 'vitest'
import type {Artifact,Run} from '../src/shared/types'
import {markdownWithLinks,resolveArtifactLink} from '../src/renderer/artifact-links'
const run={id:'run',settings:{workdir:'D:\\work'},outputRelative:'.qwork\\outputs\\run'} as Run
const artifact={id:'file',runId:'run',name:'汇报 PPT.pptx',relativePath:'.qwork\\outputs\\run\\汇报 PPT.pptx'} as Artifact
describe('Markdown artifact links',()=>{
  it('opens only the registered artifact for absolute, file URI and relative links',()=>{
    for(const href of ['D:/work/.qwork/outputs/run/汇报 PPT.pptx','file:///D:/work/.qwork/outputs/run/%E6%B1%87%E6%8A%A5%20PPT.pptx','汇报%20PPT.pptx','.qwork/outputs/run/汇报 PPT.pptx','sandbox:/mnt/data/汇报%20PPT.pptx']){
      expect(resolveArtifactLink(href,run,[artifact])?.id).toBe('file')
    }
  })
  it('does not guess based on a filename from arbitrary paths or other runs',()=>{
    for(const href of ['C:/elsewhere/汇报 PPT.pptx','https://example.com/汇报 PPT.pptx','javascript:alert(1)','file://server/share/汇报 PPT.pptx','../../outside.pptx','%ZZ'])expect(resolveArtifactLink(href,run,[artifact])).toBeUndefined()
    expect(resolveArtifactLink('汇报 PPT.pptx',run,[{...artifact,runId:'other'}])).toBeUndefined()
    expect(resolveArtifactLink('sandbox:/mnt/data/汇报 PPT.pptx',run,[artifact,{...artifact,id:'duplicate'}])).toBeUndefined()
  })
  it('preserves original link targets without allowing attribute injection',()=>{
    const html=markdownWithLinks('[下载PPT](<D:/work/汇报 PPT.pptx>)')
    expect(html).toContain('data-qwork-link="D:/work/汇报 PPT.pptx"')
    expect(html).toContain('href="#"')
    expect(markdownWithLinks('[file](<x" onclick="bad>)')).not.toContain(' onclick="bad')
  })
})
