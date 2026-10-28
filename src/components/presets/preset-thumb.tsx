import { useEffect, useState } from 'react'
import type { GradientConfig } from '@/types/config'
import { gradientToCss, renderGradient } from '@/features/gradient-engine/render'

const cache = new Map<string, string>()

/** Small thumbnail rendered with the real gradient engine (cached as a data URL). */
export function GradientThumb({ gradient, className, label }: { gradient: GradientConfig; className?: string; label?: string }) {
  const key = JSON.stringify([gradient.type, gradient.stops, gradient.base, gradient.angle, gradient.focal, gradient.points, gradient.warp, gradient.intensity, gradient.smoothness])

  const [url, setUrl] = useState(() => cache.get(key) ?? null)

  useEffect(() => {
    const hit = cache.get(key)
    if (hit) {
      setUrl(hit)
      return
    }
    let cancelled = false
    const id = requestIdleCallbackSafe(() => {
      if (cancelled) return
      const c = document.createElement('canvas')
      c.width = 192
      c.height = 108
      const ctx = c.getContext('2d')!
      renderGradient(ctx, { ...gradient, transparent: false }, 192, 108, { dither: false })
      const url = c.toDataURL('image/png')
      if (cache.size > 200) cache.clear()
      cache.set(key, url)
      if (!cancelled) setUrl(url)
    })
    return () => {
      cancelled = true
      cancelIdleSafe(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Until the real render is ready, a CSS approximation stands in.
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      className={className}
      style={{ background: url ? `center / cover no-repeat url(${url})` : gradientToCss(gradient) }}
    />
  )
}

type IdleHandle = number
function requestIdleCallbackSafe(fn: () => void): IdleHandle {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(fn, { timeout: 400 })
  return setTimeout(fn, 16) as unknown as number
}
function cancelIdleSafe(id: IdleHandle) {
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
  else clearTimeout(id)
}
