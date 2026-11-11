<script setup lang="ts">
import { computed } from 'vue'
import {markdownWithLinks} from '../artifact-links'
import DOMPurify from 'dompurify'
const props=defineProps<{text:string}>()
const emit=defineEmits<{link:[href:string]}>()
const html=computed(()=>DOMPurify.sanitize(markdownWithLinks(props.text),{FORBID_TAGS:['img','iframe','form','input','style'],FORBID_ATTR:['style']}))
function click(event:MouseEvent){
  const anchor=(event.target as HTMLElement).closest('a')
  if(!anchor)return
  event.preventDefault()
  emit('link',anchor.getAttribute('data-qwork-link')??anchor.getAttribute('href')??'')
}
</script>
<template><div class="markdown" v-html="html" @click="click"/></template>
