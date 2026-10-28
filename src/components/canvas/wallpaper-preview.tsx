import { useEffect, useRef } from 'react'
import { useEditor } from '@/store/editor'
import { createRenderCache, renderWallpaper } from '@/features/composition/render-wallpaper'
import { cn } from '@/lib/cn'

const MAX_PREVIEW_PIXELS = 2560 * 1600
const INTERACTIVE_SCALE = 0.55
const SETTLE_MS = 160

/**
 * Live preview canvas. Renders outside React's render cycle: it subscribes to
 * the store and repaints on requestAnimationFrame, dropping to a lower
 * resolution while a control is being dragged and settling at full quality.
 */
export function WallpaperPreview({ cssWidth, cssHeight, className }: { cssWidth: number; cssHeight: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fadeRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ cssWidth, cssHeight })
  sizeRef.current = { cssWidth, cssHeight }
  const schedule = useRef<(reason?: 'size') => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current!
    const fade = fadeRef.current!
    const cache = createRenderCache()
    let frame = 0
    let settleTimer: ReturnType<typeof setTimeout> | null = null
    let lastRequest = 0
    let lastToken = useEditor.getState().transitionToken
    let quality: 'full' | 'interactive' = 'full'
    let disposed = false

    const draw = () => {
      frame = 0
      if (disposed) return
      const { config, data, transitionToken } = useEditor.getState()
      const { cssWidth: w, cssHeight: h } = sizeRef.current
      if (w < 2 || h < 2) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      let pw = Math.min(config.canvas.width, w * dpr)
      let ph = (pw * config.canvas.height) / config.canvas.width
      const area = pw * ph
      if (area > MAX_PREVIEW_PIXELS) {
        const k = Math.sqrt(MAX_PREVIEW_PIXELS / area)
        pw *= k
        ph *= k
      }
      if (quality === 'interactive') {
        pw *= INTERACTIVE_SCALE
        ph *= INTERACTIVE_SCALE
      }
      pw = Math.max(2, Math.round(pw))
      ph = Math.max(2, Math.round(ph))

      // Cross-fade from the previous frame for palette changes and shuffles.
      if (transitionToken !== lastToken && canvas.width > 2) {
        lastToken = transitionToken
        fade.width = canvas.width
        fade.height = canvas.height
        fade.getContext('2d')!.drawImage(canvas, 0, 0)
        fade.style.transition = 'none'
        fade.style.opacity = '1'
        requestAnimationFrame(() => {
          fade.style.transition = 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)'
          fade.style.opacity = '0'
        })
      }

      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }
      try {
        const t0 = performance.now()
        renderWallpaper(canvas, config, data, cache)
        performance.measure?.('githue:render', { start: t0, detail: { quality, width: pw, height: ph } })
      } catch (err) {
        console.error('Preview render failed', err)
      }
    }

    const request = (reason?: 'size') => {
      const now = performance.now()
      const rapid = reason !== 'size' && now - lastRequest < 140
      lastRequest = now
      quality = rapid ? 'interactive' : 'full'
      if (settleTimer) clearTimeout(settleTimer)
      if (rapid) {
        settleTimer = setTimeout(() => {
          quality = 'full'
          if (!frame) frame = requestAnimationFrame(draw)
        }, SETTLE_MS)
      }
      if (!frame) frame = requestAnimationFrame(draw)
    }
    schedule.current = request

    const unsub = useEditor.subscribe((s, prev) => {
      if (s.config !== prev.config || s.data !== prev.data || s.transitionToken !== prev.transitionToken) request()
    })
    request('size')
    // Repaint once web fonts are ready so labels use the right typeface.
    document.fonts?.ready.then(() => !disposed && request('size'))

    return () => {
      disposed = true
      unsub()
      if (frame) cancelAnimationFrame(frame)
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [])

  useEffect(() => {
    schedule.current('size')
  }, [cssWidth, cssHeight])

  return (
    <div className={cn('relative', className)} style={{ width: cssWidth, height: cssHeight }}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="Wallpaper preview" role="img" />
      <canvas ref={fadeRef} className="pointer-events-none absolute inset-0 size-full opacity-0" aria-hidden />
    </div>
  )
}
