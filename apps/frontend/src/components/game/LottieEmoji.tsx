import { useEffect, useRef, useState } from 'react'
import type { AnimationItem, LottiePlayer } from 'lottie-web'
import { notoLottie } from '@/fx/emojis'
import { NotoEmoji } from './NotoEmoji'

let player: Promise<LottiePlayer> | null = null
/** lottie-web's light SVG build (~45 KB gz) is only fetched the first time a Lottie effect plays. */
function loadPlayer(): Promise<LottiePlayer> {
  player ??= import('lottie-web/build/player/lottie_light').then(m => (m.default ?? m) as LottiePlayer)
  player.catch(() => { player = null })
  return player
}

const data = new Map<string, Promise<unknown>>()
function loadData(emoji: string): Promise<unknown> {
  let p = data.get(emoji)
  if (!p) {
    p = fetch(notoLottie(emoji)).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<unknown> })
    p.catch(() => data.delete(emoji))
    data.set(emoji, p)
  }
  return p
}

export interface LottieEmojiProps {
  emoji: string
  /** true = forever, a number = that many loops, false = once. */
  loop?: boolean | number
  /** Speed multiplier (1 = as authored). */
  speed?: number
  onComplete?: () => void
  className?: string
}

/**
 * Noto animated emoji rendered as vector Lottie, so it stays crisp when drawn huge (the bomb).
 * Shows the animated WebP while loading, and keeps it if the Lottie is missing.
 */
export function LottieEmoji({ emoji, loop = false, speed = 1, onComplete, className = 'size-12' }: LottieEmojiProps) {
  const ref = useRef<HTMLDivElement>(null)
  const done = useRef(onComplete)
  done.current = onComplete
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let anim: AnimationItem | null = null
    let alive = true
    setReady(false)
    Promise.all([loadPlayer(), loadData(emoji)])
      .then(([lottie, animationData]) => {
        if (!alive || !ref.current) return
        anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop, autoplay: true, animationData })
        anim.setSpeed(speed)
        anim.addEventListener('complete', () => done.current?.())
        setReady(true)
      })
      .catch(() => { /* keep the WebP fallback */ })
    return () => { alive = false; anim?.destroy() }
  }, [emoji, loop, speed])

  return (
    <span data-slot="lottie-emoji" data-ready={ready} className={`relative inline-block ${className}`}>
      <div ref={ref} aria-hidden className="absolute inset-0" />
      {!ready && <NotoEmoji emoji={emoji} animated className="absolute inset-0 size-full" />}
    </span>
  )
}
