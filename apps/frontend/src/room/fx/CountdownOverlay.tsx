import { useFxStore } from '@/fx/runtime'

export function CountdownOverlay() {
  const n = useFxStore(s => s.countdown)
  if (n === null) return null
  return (
    <div data-slot="countdown" aria-hidden className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <span key={n} className="animate-pp-count text-8xl font-bold text-primary drop-shadow">{n}</span>
    </div>
  )
}
