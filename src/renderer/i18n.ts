import {ref} from 'vue'
import type {Locale} from '../shared/locale'
import {translate} from '../shared/translate'
export const locale=ref<Locale>(typeof navigator!=='undefined'&&/^zh/i.test(navigator.language)?'zh':'en')
export const t=(text:string,values:Record<string,string|number>={})=>translate(text,locale.value,values)
