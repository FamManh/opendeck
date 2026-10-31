import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useFxPrefs } from '@/fx/prefs'
import { type Spin } from '@/fx/runtime'

export const WHEEL_MS = 1000
export const WHEEL_MS_MINIMAL = 50

export function wheelAngle(spin: Spin) {
  return spin.turns * 360 + (spin.chosen === 'high' ? 0 : 180)
}

export interface WheelProps {
  spin: Spin | null
  nameOf: (pid: string) => string
  isHost: boolean
  onSpin: () => void
}

export function Wheel({ spin, nameOf, isHost, onSpin }: WheelProps) {
  const { t } = useTranslation()
  const { effective } = useFxPrefs()
  const ms = effective === 'minimal' ? WHEEL_MS_MINIMAL : WHEEL_MS
  const [angle, setAngle] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(false)
    if (!spin) { setAngle(0); return }
    const raf = requestAnimationFrame(() => setAngle(wheelAngle(spin)))
    const timer = setTimeout(() => setDone(true), ms)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [spin, ms])

  return (
    <div data-slot="wheel" className="pointer-events-auto flex items-center gap-3">
      {spin && (
        <div aria-hidden className="relative size-12 rounded-full border-4 border-primary bg-card-paper text-card-ink">
          <div data-slot="wheel-disc" className="absolute inset-0 flex flex-col items-center justify-between py-0.5 text-[10px] font-bold" style={{ transform: `rotate(${angle}deg)`, transition: `transform ${ms}ms cubic-bezier(.2,.7,.2,1)` }}>
            <span>▲</span><span className="rotate-180">▲</span>
          </div>
        </div>
      )}
      {spin && done && <span role="status" className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">{t('fx.spinResult', { name: nameOf(spin.pid) })}</span>}
      {isHost && !spin && <Button size="sm" onClick={onSpin}>{t('fx.spin')}</Button>}
    </div>
  )
}
