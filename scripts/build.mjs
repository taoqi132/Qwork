import { build as viteBuild } from 'vite'
import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
await viteBuild()
await mkdir('dist/main', {recursive:true})
await build({entryPoints:['src/main/index.ts'],outfile:'dist/main/index.cjs',bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron'],packages:'external',sourcemap:true})
await build({entryPoints:['src/main/preload.ts'],outfile:'dist/main/preload.cjs',bundle:true,platform:'node',target:'node22',format:'cjs',external:['electron']})
await copyFile('assets/qwork.svg','dist/renderer/qwork.svg')
await build({entryPoints:['src/main/doctor.ts'],outfile:'dist/main/doctor.cjs',bundle:true,platform:'node',target:'node22',format:'cjs',packages:'external'})
