import { useLayoutEffect, useRef, useState } from 'react'

/** Live size of an element; `fallback` covers the first paint and environments without ResizeObserver. */
export function useElementSize<T extends HTMLElement>(fallback: { w: number; h: number }) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, size }
}
