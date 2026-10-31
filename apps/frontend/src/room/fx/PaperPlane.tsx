import { useLayoutEffect, useRef, useState } from 'react'
import { useFxPrefs } from '@/fx/prefs'
import { type Plane, useFxStore } from '@/fx/runtime'

const seatRect = (pid: string) => document.querySelector(`[data-slot=seat][data-pid="${CSS.escape(pid)}"]`)?.getBoundingClientRect()

function FlyingPlane({ plane, origin }: { plane: Plane; origin: DOMRect }) {
  const { effective } = useFxPrefs()
  const [pos, setPos] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)
  useLayoutEffect(() => {
    const from = seatRect(plane.from)
    const to = seatRect(plane.target)
    if (!to) return
    const f = from ?? to
    setPos({
      x: f.left + f.width / 2 - origin.left, y: f.top + f.height / 2 - origin.top,
      dx: to.left - f.left, dy: to.top - f.top,
    })
  }, [plane, origin])
  if (!pos) return null
  if (effective === 'minimal') {
    return <span data-slot="plane" className="animate-pp-fade absolute text-2xl" style={{ left: pos.x + pos.dx, top: pos.y + pos.dy }}>✈️</span>
  }
  return (
    <span
      data-slot="plane"
      className="animate-pp-plane absolute text-2xl"
      style={{ left: pos.x, top: pos.y, ['--dx' as string]: `${pos.dx}px`, ['--dy' as string]: `${pos.dy}px` }}
    >✈️</span>
  )
}

export function PaperPlaneLayer() {
  const planes = useFxStore(s => s.planes)
  const ref = useRef<HTMLDivElement>(null)
  const origin = ref.current?.getBoundingClientRect()
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {origin && planes.map(p => <FlyingPlane key={p.id} plane={p} origin={origin} />)}
    </div>
  )
}
