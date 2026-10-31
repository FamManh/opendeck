import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { io } from 'socket.io-client'

const PASSWORD = 'correct-horse-9'
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }

type Player = { ctx: BrowserContext; page: Page }

async function newPlayer(browser: Browser, opts: Parameters<Browser['newContext']>[0] = {}): Promise<Player> {
  const ctx = await browser.newContext(opts)
  await ctx.addInitScript(() => localStorage.setItem('opendeck.lang', 'en'))
  return { ctx, page: await ctx.newPage() }
}

async function register(p: Player, displayName: string): Promise<void> {
  const email = `${displayName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  expect((await p.ctx.request.post('/api/auth/register', { data: { email, password: PASSWORD, displayName } })).ok()).toBe(true)
}

async function hostRoom(p: Player, name = 'Host', body: object = {}): Promise<string> {
  await register(p, name)
  const res = await p.ctx.request.post('/api/rooms', { data: { name: 'UX room', scaleId: 'fibonacci', ...body } })
  const { slug } = await res.json() as { slug: string }
  await p.page.goto(`/r/${slug}`)
  return slug
}

async function addTasks(p: Player, lines = 'PAY-1 First | details\nNo key task\nThird task'): Promise<void> {
  await p.page.getByRole('button', { name: 'Add tasks' }).first().click()
  const d = p.page.getByRole('dialog')
  await d.getByRole('tab', { name: 'Paste lines' }).click()
  await d.locator('#add-lines').fill(lines)
  await d.getByRole('button', { name: 'Add tasks' }).click()
  await expect(d).toBeHidden()
}

/** Guest with a profile already saved, so the join dialog is skipped. */
async function seededGuest(browser: Browser, slug: string, name: string, opts: Parameters<Browser['newContext']>[0] = {}): Promise<Player> {
  const g = await newPlayer(browser, opts)
  await g.ctx.request.post('/api/guests', { data: { name, avatar: 'bunny' } })
  await g.ctx.addInitScript(n => localStorage.setItem('opendeck.guest', JSON.stringify({ name: n, avatar: 'bunny' })), name)
  await g.page.goto(`/r/${slug}`)
  await expect(g.page.locator('[data-slot=seat]').first()).toBeVisible()
  return g
}

const vote = (p: Player, card: string) =>
  p.page.getByRole('group', { name: 'Pick your card' }).getByRole('button', { name: card, exact: true }).click()
const start = (p: Player) => p.page.locator('[data-slot=task-card]').getByRole('button', { name: /Start voting|Next task/ }).click()
const reveal = (p: Player) => p.page.getByRole('button', { name: 'Reveal cards' }).click()

async function seatProblems(page: Page) {
  return page.locator('[data-slot=seat]').evaluateAll(els => {
    const rects = els.map(e => e.getBoundingClientRect())
    const section = els[0]!.closest('section')!.getBoundingClientRect()
    let overlapping = 0
    rects.forEach((a, i) => rects.slice(i + 1).forEach(b => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (w > 1 && h > 1) overlapping++
    }))
    return { seats: rects.length, overlapping, clipped: rects.filter(r => r.top < section.top - 1 || r.left < section.left - 1 || r.right > section.right + 1).length }
  })
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

for (const width of [360, 390]) {
  test(`${width}px: a new guest can join and vote, nothing scrolls sideways`, async ({ browser }) => {
    const host = await newPlayer(browser)
    const slug = await hostRoom(host)
    await addTasks(host)
    await start(host)

    const phone = await newPlayer(browser, { ...PHONE, viewport: { width, height: 700 } })
    await phone.page.goto('/')
    expect(await noSideScroll(phone.page)).toBe(true)
    await phone.page.goto(`/r/${slug}`)
    await phone.page.locator('#join-name').fill('Phone')
    await phone.page.getByRole('button', { name: 'Join room' }).click()
    await expect(phone.page.locator('[data-slot=card-fan]')).toBeVisible()
    expect(await noSideScroll(phone.page)).toBe(true)
    await vote(phone, '5')
    await expect(host.page.locator('[data-status=voted]')).toHaveCount(1)
    const header = await phone.page.locator('header').boundingBox()
    expect(header!.height).toBeLessThanOrEqual(60)
    await Promise.all([host.ctx.close(), phone.ctx.close()])
  })
}

test('phone host runs a round from the bottom bar and locks without scrolling', async ({ browser }) => {
  const host = await newPlayer(browser, PHONE)
  await hostRoom(host)
  await addTasks(host)
  const bar = host.page.locator('[data-slot=mobile-action-bar]')
  await bar.getByRole('button', { name: 'Start voting' }).click()
  await bar.getByRole('button', { name: 'Open task list' }).click()
  const panel = host.page.getByRole('dialog')
  expect((await panel.boundingBox())!.height).toBeGreaterThan(844 * 0.7)
  await panel.getByRole('tab', { name: 'Questions' }).click()
  await expect(panel.getByLabel('Ask a question')).toBeInViewport()
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toBeHidden()
  await vote(host, '5')
  await bar.getByRole('button', { name: 'Reveal cards' }).click()
  const lock = host.page.getByRole('button', { name: 'Lock score' })
  await expect(lock).toBeVisible()
  const box = await lock.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  await lock.click()
  await expect(host.page.locator('[data-slot=mobile-action-bar]').getByRole('button', { name: 'Next task' })).toBeVisible()
  await host.ctx.close()
})

test('1366×768: no seat is cut off and Lock score is in view', async ({ browser }) => {
  const host = await newPlayer(browser, { viewport: { width: 1366, height: 768 } })
  const slug = await hostRoom(host)
  await addTasks(host)
  const guests = [await seededGuest(browser, slug, 'An'), await seededGuest(browser, slug, 'Binh'), await seededGuest(browser, slug, 'Chi')]
  await expect(host.page.locator('[data-slot=seat]')).toHaveCount(4)
  expect(await seatProblems(host.page)).toMatchObject({ overlapping: 0, clipped: 0 })
  await start(host)
  await vote(guests[0]!, '2')
  await vote(guests[1]!, '13')
  await expect(host.page.locator('[data-status=voted]')).toHaveCount(2)
  await reveal(host)
  const lock = host.page.getByRole('button', { name: 'Lock score' })
  await expect(lock).toBeVisible()
  const box = await lock.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(768)
  await Promise.all([host.ctx, ...guests.map(g => g.ctx)].map(c => c.close()))
})

test('20 people: no overlap and nobody cut off', async ({ browser }) => {
  test.setTimeout(180_000)
  const host = await newPlayer(browser)
  const slug = await hostRoom(host)
  await addTasks(host)
  const others: Player[] = []
  for (let i = 0; i < 19; i++) others.push(await seededGuest(browser, slug, `Member ${i + 1}`))
  await expect(host.page.locator('[data-slot=seat]')).toHaveCount(20)
  await start(host)
  await expect(host.page.locator('[data-slot=seat]').first()).toHaveAttribute('data-density', 'dense')
  expect(await seatProblems(host.page)).toEqual({ seats: 20, overlapping: 0, clipped: 0 })
  await Promise.all([host.ctx, ...others.map(g => g.ctx)].map(c => c.close()))
})

test('50 people: the room falls back to a grid and nothing overlaps', async ({ browser }) => {
  test.setTimeout(120_000)
  const host = await newPlayer(browser)
  const slug = await hostRoom(host)
  await addTasks(host)
  const sockets = []
  for (let i = 0; i < 49; i++) {
    const ctx = await browser.newContext()
    await ctx.request.post('/api/guests', { data: { name: `Member ${i + 1}`, avatar: 'owl' } })
    await ctx.request.post(`/api/rooms/${slug}/join`, { data: {} })
    const cookie = (await ctx.cookies()).map(c => `${c.name}=${c.value}`).join('; ')
    sockets.push(io('http://localhost:3001/room', { auth: { slug }, extraHeaders: { cookie }, transports: ['websocket'] }))
    await ctx.close()
  }
  await expect(host.page.locator('[data-slot=seat]')).toHaveCount(50, { timeout: 30_000 })
  await start(host)
  const problems = await seatProblems(host.page)
  expect(problems).toMatchObject({ seats: 50, overlapping: 0 })
  expect(await noSideScroll(host.page)).toBe(true)
  sockets.forEach(s => s.disconnect())
  await host.ctx.close()
})

test('host controls: kick, hand over host, successor, lock, new session', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host, 'Hana')
  await addTasks(host)
  const member = await newPlayer(browser)
  await register(member, 'Viet')
  await member.page.goto(`/r/${slug}`)
  const guest = await seededGuest(browser, slug, 'Khach')
  await expect(host.page.locator('[data-slot=seat]')).toHaveCount(3)

  await host.page.getByRole('button', { name: 'Members' }).click()
  await expect(host.page.getByRole('button', { name: 'Make Khach the host' })).toBeDisabled()
  await host.page.getByRole('button', { name: 'Make Viet the next host' }).click()
  await expect(host.page.getByRole('button', { name: 'Make Viet the next host' })).toHaveAttribute('aria-pressed', 'true')
  await host.page.getByRole('button', { name: 'Remove Khach from the room' }).click()
  await host.page.getByRole('dialog').last().getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(guest.page.getByText('You are no longer in the room')).toBeVisible()
  await guest.page.reload()
  await expect(guest.page.getByText('You are no longer in the room')).toBeVisible()
  await host.page.keyboard.press('Escape')

  await host.page.getByRole('button', { name: 'Room settings' }).click()
  await host.page.getByLabel('Lock room (no new people)').click()
  const late = await newPlayer(browser)
  await late.ctx.request.post('/api/guests', { data: { name: 'Late', avatar: 'cat' } })
  await late.ctx.addInitScript(() => localStorage.setItem('opendeck.guest', JSON.stringify({ name: 'Late', avatar: 'cat' })))
  await late.page.goto(`/r/${slug}`)
  await expect(late.page.getByText('The room is locked', { exact: false })).toBeVisible()
  await host.page.getByLabel('Lock room (no new people)').click()

  await host.page.getByRole('button', { name: 'Start new session' }).click()
  await host.page.getByRole('dialog').last().getByRole('button', { name: 'Start new session' }).click()
  await expect(host.page.locator('[data-slot=task-panel] li[data-status]')).toHaveCount(0)
  // Escape only reaches the sheet once the confirm dialog has finished closing.
  await expect(async () => {
    await host.page.keyboard.press('Escape')
    await expect(host.page.getByRole('dialog')).toHaveCount(0, { timeout: 500 })
  }).toPass()

  await host.page.getByRole('button', { name: 'Members' }).click()
  await host.page.getByRole('button', { name: 'Make Viet the host' }).click()
  await expect(member.page.getByRole('button', { name: 'Add tasks' }).first()).toBeVisible()
  await Promise.all([host, member, guest, late].map(p => p.ctx.close()))
})

test('approval: a declined guest is told so, not that they were removed', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host, 'Hana', { requireApproval: true })
  const guest = await newPlayer(browser)
  await guest.page.goto(`/r/${slug}`)
  await guest.page.locator('#join-name').fill('Waiting')
  await guest.page.getByRole('button', { name: 'Join room' }).click()
  await host.page.getByRole('button', { name: 'Decline' }).click()
  await expect(guest.page.getByText("The host didn't let you in")).toBeVisible()
  await Promise.all([host.ctx.close(), guest.ctx.close()])
})

test('countdown set when creating the room reveals by itself; auto reveal fires on the last vote', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host, 'Hana', { revealRule: { onAllVoted: false, timerSec: 2 } })
  await addTasks(host)
  const guest = await seededGuest(browser, slug, 'An')
  await start(host)
  await expect(host.page.locator('[data-slot=timer]')).toBeVisible()
  await vote(guest, '5')
  await expect(host.page.locator('[data-slot=results]')).toBeVisible({ timeout: 10_000 })

  await host.page.getByRole('button', { name: 'Room settings' }).click()
  await host.page.getByRole('radio', { name: 'Off' }).click()
  await host.page.getByLabel('Reveal when everyone has voted').click()
  await host.page.keyboard.press('Escape')
  await host.page.locator('[data-slot=results]').getByRole('button', { name: 'Lock score' }).click()
  await host.page.locator('[data-slot=task-card]').getByRole('button', { name: 'Next task' }).click()
  await vote(host, '3')
  await expect(host.page.locator('[data-slot=results]')).toHaveCount(0)
  await vote(guest, '3')
  await expect(host.page.locator('[data-slot=results]')).toBeVisible({ timeout: 10_000 })
  await Promise.all([host.ctx.close(), guest.ctx.close()])
})

test('switching task mid-vote asks first; revealing needs a vote', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host)
  await addTasks(host)
  const guest = await seededGuest(browser, slug, 'An')
  await start(host)
  await expect(host.page.getByRole('button', { name: 'Reveal cards' })).toBeDisabled()
  await vote(guest, '5')
  await expect(host.page.locator('[data-status=voted]')).toHaveCount(1)
  await host.page.locator('[data-slot=task-panel] li[data-status=pending]').last().getByRole('button', { name: 'Start voting' }).click()
  const dialog = host.page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(host.page.locator('[data-status=voted]')).toHaveCount(1)
  await host.page.locator('[data-slot=task-panel] li[data-status=pending]').last().getByRole('button', { name: 'Start voting' }).click()
  await dialog.getByRole('button', { name: 'Switch task' }).click()
  await expect(host.page.locator('[data-status=voted]')).toHaveCount(0)
  await Promise.all([host.ctx.close(), guest.ctx.close()])
})

test('no internal id for tasks without a key; pending tasks can be edited and deleted', async ({ browser }) => {
  const host = await newPlayer(browser)
  await hostRoom(host)
  await addTasks(host)
  const panel = host.page.locator('[data-slot=task-panel]')
  await expect(panel.getByText(/^i\d+$/)).toHaveCount(0)
  await panel.getByRole('button', { name: 'Edit No key task' }).click()
  await host.page.locator('#edit-title').fill('Renamed task')
  await host.page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(panel.getByText('Renamed task')).toBeVisible()
  await panel.getByRole('button', { name: 'Delete Third task' }).click()
  await expect(panel.locator('li[data-status]')).toHaveCount(2)
  await host.page.reload()
  await expect(panel.locator('li[data-status]')).toHaveCount(2)
  await host.ctx.close()
})

test('rename survives a reload', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host)
  const guest = await seededGuest(browser, slug, 'Old name')
  await guest.page.getByRole('button', { name: 'Room settings' }).click()
  await guest.page.getByRole('button', { name: 'Change name and character' }).click()
  await guest.page.locator('#profile-name').fill('New name')
  await guest.page.getByRole('radio', { name: 'Robot' }).click()
  await guest.page.getByRole('dialog').last().getByRole('button', { name: 'Save' }).click()
  await expect(host.page.locator('[data-slot=seat]', { hasText: 'New name' })).toBeVisible()
  await guest.page.reload()
  await expect(host.page.locator('[data-slot=seat]', { hasText: 'New name' }).locator('[data-species=robot]')).toBeVisible()
  await Promise.all([host.ctx.close(), guest.ctx.close()])
})

test('questions from an observer, reasons after the reveal, round history, plot twist, summary columns', async ({ browser }) => {
  const host = await newPlayer(browser)
  const slug = await hostRoom(host)
  await addTasks(host, 'PAY-1 First')
  const a = await seededGuest(browser, slug, 'An')
  const b = await seededGuest(browser, slug, 'Binh')
  const obs = await seededGuest(browser, slug, 'Olivia')
  await obs.page.getByRole('button', { name: 'Room settings' }).click()
  await obs.page.getByRole('button', { name: 'Watch only' }).click()
  await obs.page.keyboard.press('Escape')
  await start(host)

  await obs.page.getByLabel('Ask a question').fill('Does it cover instalments?')
  await obs.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(host.page.locator('[data-slot=question]')).toContainText('Does it cover instalments?')
  await host.page.getByRole('button', { name: 'Mark as answered' }).click()
  await expect(obs.page.locator('[data-slot=question]')).toContainText('Answered')

  await vote(a, '2')
  await vote(b, '13')
  await expect(host.page.locator('[data-status=voted]')).toHaveCount(2)
  await reveal(host)
  const twist = a.page.locator('[data-slot=spotlight]')
  await expect(twist).toBeVisible({ timeout: 10_000 })
  await expect(twist).toContainText('see this task very differently')
  await expect(host.page.locator('[data-slot=discussion]')).toBeVisible()
  await a.page.reload()
  await expect(a.page.locator('[data-slot=results]')).toBeVisible()
  await expect(a.page.locator('[data-slot=spotlight]')).toHaveCount(0)

  await a.page.getByRole('tab', { name: 'Reasons' }).click()
  await a.page.getByLabel('Your reason').fill('Webhook retries are small')
  await a.page.getByRole('button', { name: 'Save reason' }).click()
  await expect(b.page.getByText('Webhook retries are small')).toBeVisible()

  await host.page.getByRole('button', { name: 'Revote' }).click()
  await host.page.getByRole('button', { name: 'Show rounds of First' }).click()
  await expect(host.page.locator('[data-slot=round-history]')).toContainText('Webhook retries are small')

  await vote(a, 'Smells buggy')
  await vote(b, '5')
  await expect(host.page.locator('[data-status=voted]').first()).toBeVisible()
  await reveal(host)
  await host.page.locator('[data-slot=results]').getByRole('button', { name: '5', exact: true }).click()
  await host.page.getByRole('button', { name: 'Lock score' }).click()
  await host.page.getByRole('button', { name: 'View summary' }).first().click()
  await host.page.waitForURL(/\/summary$/)
  const row = host.page.locator('[data-slot=summary-row]')
  await expect(row.locator('[data-slot=notes]')).toContainText('Webhook retries are small')
  await expect(row.locator('[data-slot=notes]')).toContainText('Does it cover instalments?')
  await Promise.all([host, a, b, obs].map(p => p.ctx.close()))
})

test('dragging a card up plays it', async ({ browser }) => {
  const host = await newPlayer(browser)
  await hostRoom(host)
  await addTasks(host)
  await start(host)
  const card = host.page.getByRole('group', { name: 'Pick your card' }).getByRole('button', { name: '8', exact: true })
  const box = (await card.boundingBox())!
  await host.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await host.page.mouse.down()
  await host.page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 6 })
  await host.page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 })
  await host.page.mouse.up()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await host.ctx.close()
})
