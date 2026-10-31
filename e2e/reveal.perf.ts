import { expect, test, type Page } from '@playwright/test'

const GUESTS = 8

async function frameStats(page: Page, ms: number) {
  return page.evaluate(ms => new Promise<{ medianFps: number; worstMs: number }>(resolve => {
    const deltas: number[] = []
    let last = performance.now()
    const end = last + ms
    const tick = (t: number) => {
      deltas.push(t - last); last = t
      if (t < end) requestAnimationFrame(tick)
      else {
        const sorted = [...deltas].sort((a, b) => a - b)
        resolve({ medianFps: 1000 / sorted[Math.floor(sorted.length / 2)]!, worstMs: sorted.at(-1)! })
      }
    }
    requestAnimationFrame(tick)
  }), ms)
}

test(`reveal with ${GUESTS + 1} players under 4x CPU throttle`, async ({ browser }) => {
  const host = await browser.newContext()
  await host.addInitScript(() => localStorage.setItem('opendeck.lang', 'en'))
  const hp = await host.newPage()
  const cdp = await host.newCDPSession(hp)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const email = `perf-${Date.now()}@example.com`
  expect((await host.request.post('/api/auth/register', { data: { email, password: 'correct-horse-9', displayName: 'Perf' } })).ok()).toBe(true)
  await hp.goto('/rooms/new')
  await hp.locator('#room-name').fill('Perf')
  await hp.getByRole('button', { name: 'Create room' }).click()
  await hp.waitForURL(/\/r\/[A-Za-z0-9]{10}$/)
  const url = hp.url()
  await hp.getByRole('button', { name: 'Add tasks' }).first().click()
  const dialog = hp.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Paste lines' }).click()
  await dialog.locator('#add-lines').fill('Perf task')
  await dialog.getByRole('button', { name: 'Add tasks' }).click()

  const guests = []
  for (let i = 0; i < GUESTS; i++) {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => localStorage.setItem('opendeck.lang', 'en'))
    const p = await ctx.newPage()
    await p.goto(url)
    await p.locator('#join-name').fill(`G${i}`)
    await p.getByRole('button', { name: 'Join room' }).click()
    guests.push({ ctx, p })
  }
  await hp.locator('[data-slot=task-card]').getByRole('button', { name: 'Start voting' }).click()
  for (const { p } of guests) await p.getByRole('group', { name: 'Pick your card' }).getByRole('button', { name: '5', exact: true }).click()
  await hp.getByRole('button', { name: 'Reveal' }).click()
  const stats = await frameStats(hp, 4000)
  console.log(`reveal: median ${stats.medianFps.toFixed(1)} fps, worst frame ${stats.worstMs.toFixed(0)} ms`)
  for (const { ctx } of guests) await ctx.close()
  await host.close()
})
