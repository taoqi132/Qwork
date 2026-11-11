export type Locale='zh'|'en'
export type LanguagePreference='system'|Locale
export function resolveLocale(preference:LanguagePreference|undefined,systemLanguage:string):Locale{
  if(preference==='zh'||preference==='en')return preference
  return /^zh(?:[-_]|$)/i.test(systemLanguage)?'zh':'en'
}
