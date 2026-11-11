import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NotoEmoji } from '@/components/game/NotoEmoji'
import { DebrisWorld, loadPhysics } from '@/fx/physics'
import { useFxPrefs } from '@/fx/prefs'
import { type Flight, fxRuntime, useFxStore } from '@/fx/runtime'
import { debrisFor, ITEM_EMOJI } from '@/fx/throws'
import { Arrow } from './Arrow'

const avatarRect = (pid: string) =>
  document.querySelector(`[data-slot=seat][data-pid="${CSS.escape(pid)}"] [data-slot=seat-avatar]`)?.getBoundingClientRect()

const ITEM_PX = 32

function FlyingItem({ flight, layer }: { flight: Flight; layer: HTMLElement }) {
  const [style, setStyle] = useState<CSSProperties | null>(null)
  useLayoutEffect(() => {
    const to = avatarRect(flight.target)
    if (!to) return
    const o = layer.getBoundingClientRect()
    const from = avatarRect(flight.from)
    // Thrower not on screen (e.g. scrolled away): lob it in from the bottom edge.
    const x0 = from ? from.left + from.width / 2 - o.left : o.width / 2
    const y0 = from ? from.top + from.height / 2 - o.top : o.height
    const x1 = to.left + to.width / 2 - o.left
    const y1 = to.top + to.height / 2 - o.top
    const dx = x1 - x0
    const dy = y1 - y0
    // The arrow points along its path: nose up at launch, nose down on arrival.
    const s = dx < 0 ? -1 : 1
    const aim = (Math.atan2(dy, dx) * 180) / Math.PI
    setStyle({
      '--aim': `${aim - 35 * s}deg`,
      left: x0 - ITEM_PX / 2, top: y0 - ITEM_PX / 2,
      '--dx': `${dx}px`, '--dy': `${dy}px`, '--arc': `${Math.max(60, Math.hypot(dx, dy) * 0.3)}px`,
      '--spin': `${s * (flight.kind === 'arrow' ? 70 : flight.kind === 'heart' ? 20 : 540)}deg`,
    } as CSSProperties)
  }, [flight, layer])
  if (!style) return null
  return (
    <span data-slot="flying-item" data-kind={flight.kind} className="animate-pp-throw absolute" style={style}>
      {flight.kind === 'arrow'
        ? (
          <span className="block size-8 rotate-(--aim)">
            <span className="animate-pp-throw-spin block drop-shadow-md"><Arrow className="mt-2 block w-16 -translate-x-4" /></span>
          </span>
        )
        : (
          <span className="animate-pp-throw-spin block drop-shadow-md">
            <NotoEmoji emoji={ITEM_EMOJI[flight.kind]} className="size-8" />
          </span>
        )}
    </span>
  )
}

/** Thrown items in flight plus, at full level, matter-js debris that bursts out of each hit and piles on the floor. */
export function ThrowLayer() {
  const flights = useFxStore(s => s.flights)
  const hits = useFxStore(s => s.hits)
  const { effective } = useFxPrefs()
  const ref = useRef<HTMLDivElement>(null)
  const debrisRef = useRef<HTMLDivElement>(null)
  const world = useRef<Promise<DebrisWorld | null> | null>(null)
  const burst = useRef(new Set<number>())
  const ensureRef = useRef<(() => Promise<DebrisWorld | null>) | null>(null)
  const [layer, setLayer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => setLayer(ref.current), [])

  // Tear the world down when the level drops below full (governor or settings) and on unmount.
  useEffect(() => {
    if (effective !== 'full') return
    let ro: ResizeObserver | null = null
    let alive = true
    const ensure = () => {
      world.current ??= loadPhysics().then(M => {
        const root = debrisRef.current
        if (!alive || !root) return null
        const w = new DebrisWorld(M, root, { onActive: on => fxRuntime.physicsActive(on) })
        ro = new ResizeObserver(() => w.resize(root.clientWidth, root.clientHeight))
        ro.observe(root)
        return w
      }).catch(() => null)
      return world.current
    }
    ensureRef.current = ensure
    return () => {
      alive = false
      ensureRef.current = null
      const pending = world.current
      world.current = null
      ro?.disconnect()
      void pending?.then(w => w?.destroy())
      fxRuntime.physicsActive(false)
    }
  }, [effective])

  // Start fetching matter-js as soon as something is in the air, so it is ready when it lands.
  useEffect(() => { if (flights.length) void ensureRef.current?.() }, [flights])

  useEffect(() => {
    for (const [pid, hit] of Object.entries(hits).flatMap(([pid, list]) => list.map(h => [pid, h] as const))) {
      if (burst.current.has(hit.id)) continue
      burst.current.add(hit.id)
      if (hit.level !== 'full' || !ensureRef.current) continue
      void ensureRef.current().then(w => {
        const to = avatarRect(pid)
        const o = debrisRef.current?.getBoundingClientRect()
        if (!w || !to || !o) return
        w.spawn(to.left + to.width / 2 - o.left, to.top + to.height / 2 - o.top, debrisFor(hit.kind))
      })
    }
    if (burst.current.size > 200) burst.current = new Set(Object.values(hits).flat().map(h => h.id))
  }, [hits])

  return (
    <div ref={ref} aria-hidden data-slot="throw-layer" className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div ref={debrisRef} className="absolute inset-0" />
      {layer && flights.map(f => <FlyingItem key={f.id} flight={f} layer={layer} />)}
    </div>
  )
}
