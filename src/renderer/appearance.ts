import type {Settings} from '../shared/types'
const system=window.matchMedia('(prefers-color-scheme: dark)')
let preference:Settings['themePreference']='system'
function render(){document.documentElement.dataset.theme=preference==='system'?(system.matches?'dark':'light'):preference||'light'}
system.addEventListener('change',()=>{if(preference==='system')render()})
export function applyAppearance(settings?:Settings){preference=settings?.themePreference||'system';document.documentElement.dataset.accent='green';render()}
