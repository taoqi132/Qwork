import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  root: 'src/renderer', base: './', plugins: [vue()],
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  test: { root: '.', include: ['test/**/*.test.ts'], environment: 'node' }
})
