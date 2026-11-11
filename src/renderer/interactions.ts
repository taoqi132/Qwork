export function enterAction(event:{key:string;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey:boolean;isComposing:boolean;keyCode?:number}):'send'|'newline'|'none'{
  if(event.key!=='Enter'||event.isComposing||event.keyCode===229)return 'none'
  return event.ctrlKey||event.metaKey||event.shiftKey||event.altKey?'newline':'send'
}
