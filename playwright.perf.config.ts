import base from './playwright.config'
import { defineConfig } from '@playwright/test'

// Local, non-gating benchmark: `pnpm perf`.
export default defineConfig({ ...base, testMatch: '**/*.perf.ts', timeout: 120_000 })
