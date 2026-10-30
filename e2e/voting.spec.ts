import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const PASSWORD = 'correct-horse-9'

async function newPlayer(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => localStorage.setItem('opendeck.lang', 'en'))
  return { ctx, page: await ctx.newPage() }
}

async function register(ctx: BrowserContext, displayName: string): Promise<void> {
  const email = `${displayName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const res = await ctx.request.post('/api/auth/register', { data: { email, password: PASSWORD, displayName } })
  expect(res.ok()).toBe(true)
}

const vote = (page: Page, card: string) =>
  page.getByRole('group', { name: 'Pick your card' }).getByRole('button', { name: card, exact: true }).click()

test('host, registered voter and guest estimate two tasks and export the summary', async ({ browser }) => {
  const host = await newPlayer(browser)
  const voter = await newPlayer(browser)
  const guest = await newPlayer(browser)
  try {
    await register(host.ctx, 'Hana')
    await register(voter.ctx, 'Viet')

    await host.page.goto('/rooms/new')
    await host.page.locator('#room-name').fill('E2E sprint')
    await host.page.getByRole('button', { name: 'Create room' }).click()
    await host.page.waitForURL(/\/r\/[A-Za-z0-9]{10}$/)
    const roomUrl = host.page.url()

    await host.page.getByRole('button', { name: 'Add tasks' }).first().click()
    const dialog = host.page.getByRole('dialog')
    await dialog.getByRole('tab', { name: 'Paste lines' }).click()
    await dialog.locator('#add-lines').fill('PAY-1 Task one | first\n\nTask two')
    await expect(dialog.getByText('2 tasks will be added')).toBeVisible()
    await dialog.getByRole('button', { name: 'Add tasks' }).click()
    await expect(dialog).toBeHidden()

    await voter.page.goto(roomUrl)
    await guest.page.goto(roomUrl)
    await guest.page.locator('#join-name').fill('Khach')
    await guest.page.getByRole('button', { name: 'Join room' }).click()

    const startBtn = host.page.locator('[data-slot=task-card]').getByRole('button', { name: 'Start voting' })
    await startBtn.click()
    await vote(voter.page, '3')
    await vote(guest.page, '13')
    await expect(host.page.locator('[data-status=voted]')).toHaveCount(2)
    await host.page.getByRole('button', { name: 'Reveal cards' }).click()
    await expect(host.page.locator('[data-slot=discussion]')).toBeVisible()
    await expect(voter.page.locator('[data-slot=discussion]')).toBeVisible()

    await host.page.getByRole('button', { name: 'Revote' }).click()
    await expect(host.page.locator('[data-slot=results]')).toHaveCount(0)
    await vote(voter.page, '8')
    await vote(guest.page, '8')
    await expect(host.page.locator('[data-status=voted]')).toHaveCount(2)
    await host.page.getByRole('button', { name: 'Reveal cards' }).click()
    const results = host.page.locator('[data-slot=results]')
    await results.getByRole('button', { name: '8', exact: true }).click()
    await results.getByRole('button', { name: 'Lock score' }).click()

    await host.page.getByRole('button', { name: 'Next task' }).click()
    await vote(voter.page, '5')
    await vote(guest.page, '5')
    await guest.page.reload()
    await expect(guest.page.getByRole('group', { name: 'Pick your card' }).getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(host.page.locator('[data-status=voted]')).toHaveCount(2)
    await host.page.getByRole('button', { name: 'Reveal cards' }).click()
    await host.page.locator('[data-slot=results]').getByRole('button', { name: 'Lock score' }).click()

    await host.page.getByRole('button', { name: 'View summary' }).click()
    await host.page.waitForURL(/\/summary$/)
    const rows = host.page.locator('[data-slot=summary-row]')
    await expect(rows).toHaveCount(2)
    await expect(rows.locator('[data-slot=rounds]')).toHaveText(['2', '1'])
    await expect(rows.locator('[data-slot=final]')).toHaveText(['8', '5'])

    const [download] = await Promise.all([
      host.page.waitForEvent('download'),
      host.page.getByRole('link', { name: 'Export CSV' }).click(),
    ])
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(Buffer.from(c))
    expect(Buffer.concat(chunks).toString('utf8')).toBe(
      '\uFEFFkey,title,final,rounds,notes,special_cards\r\nPAY-1,Task one,8,2,,\r\n,Task two,5,1,,\r\n',
    )
  } finally {
    await Promise.all([host.ctx.close(), voter.ctx.close(), guest.ctx.close()])
  }
})
