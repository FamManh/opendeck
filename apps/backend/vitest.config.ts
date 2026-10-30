import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC emits decorator metadata, which Nest dependency injection needs (esbuild does not).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { globals: true, include: ['src/**/*.test.ts'] },
})
