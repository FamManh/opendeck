import { useEffect, useRef } from 'react'
import { ConfettiCanvas } from '@/fx/confetti'
import { getGovernorCap, useFxPrefs } from '@/fx/prefs'
import { useFxStore } from '@/fx/runtime'

const FULL_COUNT = 38
const REDUCED_COUNT = 19

export function ConfettiLayer() {
  const moment = useFxStore(s => s.moment)
  const { effective } = useFxPrefs()
  const ref = useRef<HTMLCanvasElement>(null)
  const active = moment === 'consensus' && effective !== 'minimal'

  useEffect(() => {
    const canvas = ref.current
    if (!active || !canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const confetti = new ConfettiCanvas(canvas, { count: getGovernorCap() ? REDUCED_COUNT : FULL_COUNT })
    confetti.burst()
    return () => confetti.destroy()
  }, [active])

  if (!active) return null
  return <canvas ref={ref} data-slot="confetti" aria-hidden className="pointer-events-none absolute inset-0 z-30 size-full" />
}
