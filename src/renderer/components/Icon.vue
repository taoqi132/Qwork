<script setup lang="ts">
import {t,locale} from '../i18n'

defineProps<{name:string;size?:number}>()
const paths:Record<string,string[]>={
  'panel-open':['M3 4h18v16H3Z','M15 4v16','m10 9-3 3 3 3'],'panel-close':['M3 4h18v16H3Z','M15 4v16','m7 9 3 3-3 3'],
  'check-circle':['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','m8 12 3 3 5-6'],'help-circle':['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4','M12 16h.01'],
  plus:['M12 5v14','M5 12h14'],home:['m3 10 9-7 9 7','M5 9v12h14V9','M9 21v-8h6v8'],
  settings:['m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  arrow:['M5 12h14','m13 6 6 6-6 6'],chevron:['m9 5 7 7-7 7'],down:['m6 9 6 6 6-6'],
  chat:['M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z'],
  group:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0','M20 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  orbit:['M20 12a8 8 0 1 1-8-8','M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  shield:['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z','m8 12 3 3 5-6'],
  branches:['M6 3v12a6 6 0 0 0 6 6','M6 8h8a4 4 0 0 1 4 4v9','m14 17 4 4 4-4','m8 17 4 4 4-4'],
  layers:['m12 3 10 5-10 5L2 8Z','m2 12 10 5 10-5','m2 16 10 5 10-5'],
  folder:['M3 7V4h6l2 3h10v13H3Z'],file:['M14 2H6v20h14V8Z','M14 2v6h6','M9 13h6','M9 17h4'],
  attach:['m21 11-8 8a6 6 0 0 1-8-8l8-8a4 4 0 0 1 6 6l-8 8a2 2 0 0 1-3-3l8-8'],
  close:['m6 6 12 12','M6 18 18 6'],check:['m5 12 4 4L19 6'],stop:['M6 6h12v12H6Z'],
  refresh:['M20 7v5h-5','M4 17v-5h5','M6 7a7 7 0 0 1 11-2l3 3','m4 16 3 3a7 7 0 0 0 11-2'],
  search:['M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0','m15 15 6 6'],more:['M5 12h.01','M12 12h.01','M19 12h.01'],
  edit:['m16 3 5 5-12 12H4v-5Z','m13 6 5 5'],trash:['M3 6h18','M5 6l1 15h12l1-15','M9 6V3h6v3'],
  download:['M12 3v12','m7 10 5 5 5-5','M4 16v5h16v-5'],alert:['m12 3 10 18H2Z','M12 9v4','M12 17h.01'],
  clock:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','M12 7v5l3 2'],spark:['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z'],
  output:['M4 4h16v16H4Z','M8 12h9','m13 8 4 4-4 4'],link:['m10 13 4-4','M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0','m16 8 2-2a3 3 0 0 1 4 4l-5 5a3 3 0 0 1-4 0']
}
</script>
<template><svg :width="size||20" :height="size||20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(d,i) in paths[name]||paths.file" :key="i" :d="d"/></svg></template>
