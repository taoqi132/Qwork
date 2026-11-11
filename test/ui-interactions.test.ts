import {expect,test} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {resolveLocale} from '../src/shared/locale'
import {translate} from '../src/shared/translate'
import {enterAction} from '../src/renderer/interactions'
import dictionary from '../src/shared/en.json'
const event={key:'Enter',ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,isComposing:false}
test('Enter sends; Ctrl/Shift/Meta+Enter insert a new line',()=>{
  expect(enterAction(event)).toBe('send')
  for(const key of ['ctrlKey','shiftKey','metaKey'] as const)expect(enterAction({...event,[key]:true})).toBe('newline')
})
test('IME confirmation cannot accidentally send a Chinese message',()=>{
  expect(enterAction({...event,isComposing:true})).toBe('none')
  expect(enterAction({...event,keyCode:229})).toBe('none')
})
test('computer language defaults to Chinese for zh locales and English otherwise',()=>{
  expect(resolveLocale(undefined,'zh-CN')).toBe('zh');expect(resolveLocale('system','zh-TW')).toBe('zh')
  expect(resolveLocale('system','en-US')).toBe('en');expect(resolveLocale(undefined,'de-DE')).toBe('en')
})
test('explicit language preference overrides the computer language',()=>{
  expect(resolveLocale('en','zh-CN')).toBe('en');expect(resolveLocale('zh','en-US')).toBe('zh')
})
test('application copy translates but unknown user text stays unchanged',()=>{
  expect(translate('创建群聊','en')).toBe('Create group')
  expect(translate('My original message','zh')).toBe('My original message')
  expect(translate('正在进行第 2 轮讨论','en')).toBe('Discussion round 2')
  expect(translate('Codex 执行超时','en')).toBe('Codex invocation timed out')
  expect(translate('第 {round} 轮 / 最多 {max} 轮','en',{round:2,max:6})).toBe('Round 2 / up to 6')
})
test('every static frontend translation key exists in the English catalog',()=>{
  const root=path.resolve('src/renderer'),missing=new Set<string>()
  for(const f of fs.readdirSync(root,{recursive:true}).filter(f=>/\.(vue|ts)$/.test(String(f)))){
    const source=fs.readFileSync(path.join(root,String(f)),'utf8')
    for(const match of source.matchAll(/\bt\((['"])([^'"\n]+)\1/g))if(/[\u3400-\u9fff]/.test(match[2])&&!(match[2] in dictionary))missing.add(match[2])
  }
  expect([...missing]).toEqual([])
})
