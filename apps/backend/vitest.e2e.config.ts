import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { globals: true, include: ['test/**/*.e2e.test.ts'], testTimeout: 20000, hookTimeout: 20000 },
})
