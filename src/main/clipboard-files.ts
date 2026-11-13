/** Windows CF_HDROP (DROPFILES) or registered FileNameW file-list payload. */
export function clipboardFilePaths(data:Buffer,dropFiles=false):string[]{
  if(!data.length)return []
  let offset=0,wide=true
  if(dropFiles){if(data.length<20)return [];offset=data.readUInt32LE(0);wide=!!data.readUInt32LE(16);if(offset<20||offset>=data.length)return []}
  if(wide&&(data.length-offset)%2)return []
  return data.subarray(offset).toString(wide?'utf16le':'utf8').split('\0').map(p=>p.trim()).filter(p=>/^(?:[a-z]:[\\/]|\\\\)/i.test(p)).slice(0,11)
}
