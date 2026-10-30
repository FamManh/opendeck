import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { useAuthStore } from '@/lib/useMe'
import { JoinDialog } from './JoinDialog'

type Reply = { status: number; body?: unknown }
let calls: { method: string; path: string; body: unknown }[]
let routes: Record<string, Reply | (() => Reply)>

function mockFetch() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ method, path: url, body })
    const r = routes[`${method} ${url}`] ?? { status: 404, body: { code: 'NOT_FOUND' } }
    const reply = typeof r === 'function' ? r() : r
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status })
  }))
}

const room = { name: 'Sprint 24', hasPassword: false }
const protectedRoom = { name: 'Sprint 24', hasPassword: true }
const ok = { status: 204 }
const guestOk = { status: 201, body: { guest: { id: 'g1', name: 'Thảo', avatar: 'fox' } } }

beforeEach(() => {
  routes = { 'POST /api/guests': guestOk, 'POST /api/rooms/abc/join': ok }
  mockFetch()
  useAuthStore.setState({ user: null, loading: false, loaded: true })
})
afterEach(() => vi.unstubAllGlobals())

test('saved guest profile joins straight away without showing the dialog', async () => {
  localStorage.setItem('opendeck.guest', JSON.stringify({ name: 'Thảo', avatar: 'fox' }))
  const onJoined = vi.fn()
  render(<JoinDialog slug="abc" room={room} onJoined={onJoined} />)
  await waitFor(() => expect(onJoined).toHaveBeenCalledOnce())
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(calls.map(c => `${c.method} ${c.path}`)).toEqual(['POST /api/guests', 'POST /api/rooms/abc/join'])
  expect(calls[0]!.body).toEqual({ name: 'Thảo', avatar: 'fox' })
})

test('logged-in user skips the name step', async () => {
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', displayName: 'Minh Anh', avatar: null }, loading: false, loaded: true })
  const onJoined = vi.fn()
  render(<JoinDialog slug="abc" room={room} onJoined={onJoined} />)
  await waitFor(() => expect(onJoined).toHaveBeenCalledWith(expect.objectContaining({ kind: 'user', name: 'Minh Anh' })))
  expect(calls.map(c => c.path)).toEqual(['/api/rooms/abc/join'])
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('new guest sees name + 8 mascots; submit disabled for empty or too-long names', async () => {
  const user = userEvent.setup()
  const onJoined = vi.fn()
  render(<JoinDialog slug="abc" room={room} onJoined={onJoined} />)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getAllByRole('radio')).toHaveLength(8)
  const submit = screen.getByRole('button', { name: i18n.t('join.submit') })
  expect(submit).toBeDisabled()
  const input = screen.getByLabelText(i18n.t('join.displayName'))
  await user.type(input, 'x'.repeat(41))
  expect(submit).toBeDisabled()
  await user.clear(input)
  await user.type(input, 'Thảo')
  expect(submit).toBeEnabled()
  await user.click(screen.getByRole('radio', { name: i18n.t('species.fox') }))
  await user.click(submit)
  await waitFor(() => expect(onJoined).toHaveBeenCalledOnce())
  expect(calls[0]).toMatchObject({ path: '/api/guests', body: { name: 'Thảo', avatar: 'fox' } })
  expect(JSON.parse(localStorage.getItem('opendeck.guest')!)).toEqual({ name: 'Thảo', avatar: 'fox' })
})

test('password room: shows the password field; 403 shows wrong-password message', async () => {
  routes['POST /api/rooms/abc/join'] = { status: 403, body: { code: 'WRONG_PASSWORD' } }
  const user = userEvent.setup()
  render(<JoinDialog slug="abc" room={protectedRoom} onJoined={vi.fn()} />)
  await user.type(await screen.findByLabelText(i18n.t('join.displayName')), 'Thảo')
  const pw = screen.getByLabelText(i18n.t('join.roomPassword'))
  await user.type(pw, 'nope')
  await user.click(screen.getByRole('button', { name: i18n.t('join.submit') }))
  expect(await screen.findByText('Mật khẩu chưa đúng, thử lại nhé.')).toBeInTheDocument()
  expect(calls.at(-1)!.body).toEqual({ password: 'nope' })
})

test('429 shows a try-again-later message', async () => {
  routes['POST /api/rooms/abc/join'] = { status: 429, body: { code: 'TOO_MANY_ATTEMPTS' } }
  const user = userEvent.setup()
  render(<JoinDialog slug="abc" room={protectedRoom} onJoined={vi.fn()} />)
  await user.type(await screen.findByLabelText(i18n.t('join.displayName')), 'Thảo')
  await user.type(screen.getByLabelText(i18n.t('join.roomPassword')), 'x')
  await user.click(screen.getByRole('button', { name: i18n.t('join.submit') }))
  expect(await screen.findByText(i18n.t('join.tooMany'))).toBeInTheDocument()
})

test('saved guest in a password room is asked only for the password', async () => {
  localStorage.setItem('opendeck.guest', JSON.stringify({ name: 'Thảo', avatar: 'fox' }))
  let attempt = 0
  routes['POST /api/rooms/abc/join'] = () => (attempt++ === 0 ? { status: 403, body: { code: 'WRONG_PASSWORD' } } : ok)
  const user = userEvent.setup()
  const onJoined = vi.fn()
  render(<JoinDialog slug="abc" room={protectedRoom} onJoined={onJoined} />)
  const pw = await screen.findByLabelText(i18n.t('join.roomPassword'))
  expect(screen.queryByLabelText(i18n.t('join.displayName'))).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  await user.type(pw, 'secret')
  await user.click(screen.getByRole('button', { name: i18n.t('join.submit') }))
  await waitFor(() => expect(onJoined).toHaveBeenCalledOnce())
})

test('below 768px the join form opens as a bottom sheet', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }))
  render(<JoinDialog slug="abc" room={room} onJoined={vi.fn()} />)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveAttribute('data-side', 'bottom')
})
