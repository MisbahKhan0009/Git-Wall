import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Maximize, Minimize, Minus, Plus, Scan } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { WallpaperPreview } from './wallpaper-preview'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { DataBadge } from './data-badge'
import { cn } from '@/lib/cn'

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3]

export function CanvasStage({ chrome = true }: { chrome?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const width = useEditor((s) => s.config.canvas.width)
  const height = useEditor((s) => s.config.canvas.height)
  const transparent = useEditor((s) => s.config.gradient.transparent)
  const hideUI = useEditor((s) => s.hideUI)
  const setHideUI = useEditor((s) => s.setHideUI)

  useLayoutEffect(() => {
    const el = stageRef.current!
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setAvail({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else stageRef.current?.requestFullscreen?.().catch(() => setHideUI(true))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === '+' || e.key === '=') setZoom((z) => ZOOMS.find((x) => x > z) ?? z)
      if (e.key === '-') setZoom((z) => [...ZOOMS].reverse().find((x) => x < z) ?? z)
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fit the wallpaper's aspect ratio inside the stage — never stretched.
  const inset = fullscreen || hideUI ? 0 : avail.w < 640 ? 14 : 40
  const fitW = Math.max(0, avail.w - inset * 2)
  const fitH = Math.max(0, avail.h - inset * 2 - (chrome && !fullscreen ? 44 : 0))
  const fit = Math.min(fitW / width, fitH / height)
  const cssW = Math.floor(width * fit * zoom)
  const cssH = Math.floor(height * fit * zoom)
  const overflow = zoom > 1

  return (
    <div
      ref={stageRef}
      className={cn('relative min-h-0 min-w-0 flex-1 bg-ink-950', fullscreen && 'bg-black')}
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget && hideUI) setHideUI(false)
      }}
    >
      <div
        className={cn('absolute inset-0 flex scroll-thin', overflow ? 'overflow-auto' : 'overflow-hidden')}
        style={{ padding: inset, paddingBottom: inset + (chrome && !fullscreen ? 44 : 0) }}
      >
        <div className="m-auto shrink-0" style={{ width: cssW, height: cssH }}>
          {cssW > 0 && (
            <div
              className={cn(
                'relative overflow-hidden transition-[border-radius] duration-300',
                fullscreen || hideUI ? 'rounded-none' : 'rounded-[14px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]',
                transparent && 'checkerboard',
              )}
            >
              <WallpaperPreview cssWidth={cssW} cssHeight={cssH} />
              {!hideUI && !fullscreen && <DataBadge className="absolute top-3 left-3" />}
            </div>
          )}
        </div>
      </div>

      {chrome && (
        <div
          className={cn(
            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-ink-900/80 p-1 shadow-2xl backdrop-blur-xl transition-opacity duration-300',
            (fullscreen || hideUI) && 'opacity-0 hover:opacity-100 focus-within:opacity-100',
          )}
        >
          <Tooltip content="Zoom out (−)" side="top">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Zoom out" onClick={() => setZoom((z) => [...ZOOMS].reverse().find((x) => x < z) ?? z)} disabled={zoom <= ZOOMS[0]}>
              <Minus />
            </Button>
          </Tooltip>
          <Tooltip content="Fit to view (0)" side="top">
            <button type="button" onClick={() => setZoom(1)} className="tabular h-7 min-w-14 rounded-full px-2 font-mono text-2xs text-ink-200 hover:bg-white/[0.06]" aria-label="Fit to view">
              {zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}
            </button>
          </Tooltip>
          <Tooltip content="Zoom in (+)" side="top">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Zoom in" onClick={() => setZoom((z) => ZOOMS.find((x) => x > z) ?? z)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]}>
              <Plus />
            </Button>
          </Tooltip>
          <span className="mx-1 h-4 w-px bg-line-strong" />
          <span className="tabular hidden px-1.5 font-mono text-2xs text-ink-400 sm:inline">
            {width}×{height}
          </span>
          <Tooltip content={hideUI ? 'Show editor (H)' : 'Preview without the editor (H)'} side="top">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={hideUI ? 'Show editor' : 'Hide editor'} onClick={() => setHideUI(!hideUI)}>
              {hideUI ? <Eye /> : <EyeOff />}
            </Button>
          </Tooltip>
          <Tooltip content={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} side="top">
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </Tooltip>
        </div>
      )}
      {hideUI && !fullscreen && (
        <button
          type="button"
          onClick={() => setHideUI(false)}
          className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-line bg-ink-900/70 px-3 py-1.5 text-xs text-ink-200 opacity-60 backdrop-blur-xl transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Scan className="size-3.5" /> Show editor
        </button>
      )}
    </div>
  )
}
