import { spawn, type ChildProcess } from 'node:child_process'
import { io, type Socket } from 'socket.io-client'

// Starts the built backend (apps/backend/dist) on its own port unless LOAD_URL points at a running one.
const PORT = Number(process.env.LOAD_PORT ?? 3199)
const BASE = process.env.LOAD_URL ?? `http://localhost:${PORT}`
const P95_LIMIT_MS = 300
const CARDS = ['1', '2', '3', '5', '8', '13', '21']

interface PublicState {
  participants: Record<string, unknown>
  current: { status: 'voting' | 'revealed'; voted: string[]; myVote: string | null; votes: Record<string, string> | null } | null
}
interface Client { name: string; pid: string; socket: Socket; state: PublicState | null; errors: string[] }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const now = () => performance.now()
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.95) - 1)]!

async function waitForHealth(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return } catch { /* not up yet */ }
    await sleep(300)
  }
  throw new Error('backend did not become healthy')
}

async function http(path: string, cookies: string[], body: unknown, method = 'POST'): Promise<{ status: number; json: any; setCookies: string[] }> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookies.join('; ') },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const setCookies = res.headers.getSetCookie().map(c => c.split(';')[0]!)
  return { status: res.status, json: text ? JSON.parse(text) : null, setCookies }
}

function mergeCookies(jar: string[], add: string[]): string[] {
  const m = new Map(jar.map(c => [c.split('=')[0]!, c]))
  for (const c of add) m.set(c.split('=')[0]!, c)
  return [...m.values()]
}

function connect(slug: string, cookies: string[], name: string, pid: string): Promise<Client> {
  const socket = io(`${BASE}/room`, { auth: { slug }, extraHeaders: { cookie: cookies.join('; ') }, transports: ['websocket'], reconnection: false })
  const c: Client = { name, pid, socket, state: null, errors: [] }
  socket.on('state', (s: PublicState) => { c.state = s })
  socket.on('conn:error', (e: { code: string }) => c.errors.push(e.code))
  socket.on('connect_error', (e: Error) => c.errors.push(e.message))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${name}: no state frame`)), 10_000)
    socket.on('state', () => { clearTimeout(timer); resolve(c) })
    socket.on('conn:error', (e: { code: string }) => { clearTimeout(timer); reject(new Error(`${name}: ${e.code}`)) })
  })
}

function send(c: Client, cmd: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    c.socket.timeout(10_000).emit('cmd', cmd, (err: Error | null, ack: { ok: boolean; code?: string }) => {
      if (err) reject(err)
      else if (!ack.ok) reject(new Error(`${c.name}: ${cmd.type} -> ${ack.code}`))
      else resolve()
    })
  })
}

async function until(cond: () => boolean, what: string, timeoutMs = 15_000): Promise<number> {
  const t0 = now()
  while (!cond()) {
    if (now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${what}`)
    await sleep(1)
  }
  return now() - t0
}

async function setupRoom(n: number): Promise<{ host: Client; guests: Client[] }> {
  const email = `load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const reg = await http('/auth/register', [], { email, password: 'load-test-pass-1', displayName: 'Load Host' })
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status}`)
  const hostCookies = reg.setCookies
  const created = await http('/rooms', hostCookies, { name: `load-${n}`, scaleId: 'fibonacci' })
  const slug: string = created.json.slug
  const hostJoin = await http(`/rooms/${slug}/join`, hostCookies, {})
  const host = await connect(slug, mergeCookies(hostCookies, hostJoin.setCookies), 'host', `u:${reg.json.user.id}`)

  const guests = await Promise.all(Array.from({ length: n }, async (_, i) => {
    const g = await http('/guests', [], { name: `G${i}`, avatar: 'cat' })
    const gid = g.setCookies
    const j = await http(`/rooms/${slug}/join`, gid, {})
    if (j.status !== 204) throw new Error(`guest join failed: ${j.status}`)
    return connect(slug, mergeCookies(gid, j.setCookies), `G${i}`, `g:${g.json.guest.id}`)
  }))

  await send(host, { type: 'addItems', items: [{ title: 'Load item' }] })
  await send(host, { type: 'startRound', itemId: 'i1' })
  await until(() => guests.every(g => g.state?.current?.status === 'voting'), 'round start on all clients')
  return { host, guests }
}

async function runRound(n: number): Promise<{ voteMs: number[]; revealMs: number[]; problems: string[] }> {
  const { host, guests } = await setupRoom(n)
  const problems: string[] = []
  const picks = new Map<string, string>()

  // Everyone votes at once; latency = emit → state frame in which our pid is counted as voted.
  const voteMs = await Promise.all(guests.map(async g => {
    const card = CARDS[Math.floor(Math.random() * CARDS.length)]!
    picks.set(g.pid, card)
    const t0 = now()
    await send(g, { type: 'vote', cardId: card })
    await until(() => g.state?.current?.voted.includes(g.pid) === true, `${g.name} vote echo`)
    return now() - t0
  }))
  await until(() => host.state?.current?.voted.length === n, 'host sees all votes')

  const t0 = now()
  await send(host, { type: 'reveal' })
  const revealMs = await Promise.all([host, ...guests].map(async c => {
    await until(() => c.state?.current?.status === 'revealed', `${c.name} reveal`)
    return now() - t0
  }))

  for (const c of [host, ...guests]) {
    const votes = c.state?.current?.votes ?? {}
    if (Object.keys(votes).length !== n) problems.push(`${c.name} sees ${Object.keys(votes).length}/${n} votes`)
    for (const [pid, card] of picks) if (votes[pid] !== card) problems.push(`${c.name}: vote of ${pid} is ${votes[pid]}, expected ${card}`)
    if (c.errors.length) problems.push(`${c.name} errors: ${c.errors.join(',')}`)
  }
  for (const c of [host, ...guests]) c.socket.disconnect()
  return { voteMs, revealMs, problems }
}

async function main(): Promise<void> {
  let server: ChildProcess | undefined
  if (!process.env.LOAD_URL) {
    server = spawn('node', ['dist/main.js'], { cwd: 'apps/backend', stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PORT: String(PORT) } })
  }
  try {
    await waitForHealth()
    const r20 = await runRound(20)
    const v20 = p95(r20.voteMs)
    const rv20 = p95(r20.revealMs)
    console.log(`20 clients: vote p95=${v20.toFixed(1)}ms reveal p95=${rv20.toFixed(1)}ms`)
    const r50 = await runRound(50)
    console.log(`50 clients: vote p95=${p95(r50.voteMs).toFixed(1)}ms reveal p95=${p95(r50.revealMs).toFixed(1)}ms`)

    const problems = [...r20.problems, ...r50.problems]
    if (problems.length) throw new Error(`lost votes or errors:\n${problems.slice(0, 10).join('\n')}`)
    if (Math.max(v20, rv20) >= P95_LIMIT_MS) throw new Error(`p95(20) ${Math.max(v20, rv20).toFixed(1)}ms >= ${P95_LIMIT_MS}ms`)
    console.log(`p95(20) < ${P95_LIMIT_MS}ms`)
  } finally {
    server?.kill()
  }
}

main().then(() => process.exit(0), e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
