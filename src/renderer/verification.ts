/** Format common inline numbered receipts without changing their claims. */
export function formatVerification(text:string):string{
  return text
    .replace(/^([^\n]{1,40}[：:])\s*(?=1[)）])/,'$1\n\n')
    .replace(/[；;]\s*(?=\d+[)）])/g,'\n')
    .replace(/(^|\n)[ \t]*(\d+)[)）][ \t]*/g,'$1$2. ')
    .replace(/([。；;])\s*(未能检查|检查限制|局限说明)[：:]/g,'$1\n\n**$2：** ')
}
