import { useMemo, useRef } from 'react'
import { ArrowLeftRight, Lock, LockOpen, Plus, RotateCcw, Shuffle, Trash2 } from 'lucide-react'
import { defaultConfig, useEditor } from '@/store/editor'
import { expandStops, sortedStops } from '@/features/gradient-engine/render'
import { Button } from '@/components/ui/button'
import { ColorField } from '@/components/ui/color-field'
import { Tooltip } from '@/components/ui/tooltip'
import { clamp } from '@/lib/math'
import { cn } from '@/lib/cn'

/**
 * Custom gradient editor: a live gradient bar with draggable stops. Every edit
 * goes straight into the config, so the wallpaper itself updates.
 */
export function GradientEditor() {
  const stops = useEditor((s) => s.config.gradient.stops)
  const smoothness = useEditor((s) => s.config.gradient.smoothness)
  const selectedId = useEditor((s) => s.selectedStopId)
  const selectStop = useEditor((s) => s.selectStop)
  const updateStop = useEditor((s) => s.updateStop)
  const addStop = useEditor((s) => s.addStop)
  const removeStop = useEditor((s) => s.removeStop)
  const reverseStops = useEditor((s) => s.reverseStops)
  const randomize = useEditor((s) => s.randomize)
  const patch = useEditor((s) => s.patch)
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)

  const selected = stops.find((s) => s.id === selectedId) ?? stops[0]
  const css = useMemo(
    () => `linear-gradient(90deg, ${expandStops(stops, smoothness, 6).map(([p, c]) => `${c} ${(p * 100).toFixed(2)}%`).join(', ')})`,
    [stops, smoothness],
  )
  const ordered = sortedStops(stops)

  const posFromEvent = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect()
    return Math.round(clamp((clientX - r.left) / r.width) * 1000) / 1000
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-300">Colour stops</span>
        <div className="flex gap-0.5">
          <Tooltip content="Add colour stop">
            <Button size="icon-sm" variant="ghost" aria-label="Add colour stop" onClick={() => addStop()} disabled={stops.length >= 8}>
              <Plus />
            </Button>
          </Tooltip>
          <Tooltip content="Reverse stops">
            <Button size="icon-sm" variant="ghost" aria-label="Reverse colour stops" onClick={reverseStops}>
              <ArrowLeftRight />
            </Button>
          </Tooltip>
          <Tooltip content="Randomise unlocked colours">
            <Button size="icon-sm" variant="ghost" aria-label="Randomise unlocked colours" onClick={() => randomize('colors')}>
              <Shuffle />
            </Button>
          </Tooltip>
          <Tooltip content="Restore the default palette">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Restore default palette"
              onClick={() => {
                const d = defaultConfig().gradient
                patch('gradient', { stops: d.stops, base: d.base }, { transition: true })
                selectStop(d.stops[0].id)
              }}
            >
              <RotateCcw />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="relative px-2 pt-1 pb-3">
        <div
          ref={barRef}
          className="relative h-9 cursor-copy rounded-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
          style={{ background: css }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return
            addStop(posFromEvent(e.clientX))
          }}
          title="Click to add a colour stop"
        />
        {stops.map((s) => {
          const active = s.id === selected?.id
          return (
            <button
              key={s.id}
              type="button"
              role="slider"
              aria-label={`Colour stop ${s.color}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(s.position * 100)}
              className={cn(
                'absolute top-0 h-[calc(100%-4px)] w-4 -translate-x-1/2 touch-none',
                'before:absolute before:inset-x-[5px] before:top-1 before:h-7 before:rounded-[3px] before:border-2 before:shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
                active ? 'z-10 before:border-white' : 'before:border-white/60 hover:before:border-white/90',
              )}
              style={{ left: `calc(8px + ${s.position} * (100% - 16px))` }}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                dragging.current = s.id
                selectStop(s.id)
              }}
              onPointerMove={(e) => {
                if (dragging.current !== s.id) return
                updateStop(s.id, { position: posFromEvent(e.clientX) }, { coalesce: `stop-pos-${s.id}` })
              }}
              onPointerUp={() => (dragging.current = null)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.1 : 0.01
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  updateStop(s.id, { position: clamp(s.position + (e.key === 'ArrowRight' ? step : -step)) }, { coalesce: `stop-pos-${s.id}` })
                }
                if (e.key === 'Delete' || e.key === 'Backspace') removeStop(s.id)
              }}
              onFocus={() => selectStop(s.id)}
            >
              <span className="absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full border border-black/40" style={{ background: s.color }} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ordered.map((s) => (
          <div key={s.id} className={cn('flex items-center rounded-md border transition-colors', s.id === selected?.id ? 'border-white/40 bg-white/[0.04]' : 'border-line')}>
            <button type="button" onClick={() => selectStop(s.id)} className="flex items-center gap-1.5 py-1 pr-1 pl-1.5" aria-label={`Select ${s.color}`}>
              <span className="size-4 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]" style={{ background: s.color }} />
              <span className="font-mono text-[10px] text-ink-300 uppercase">{s.color.slice(1)}</span>
            </button>
            <Tooltip content={s.locked ? 'Unlock — shuffles may change this colour' : 'Lock — shuffles keep this colour'}>
              <button
                type="button"
                aria-pressed={s.locked}
                aria-label={s.locked ? `Unlock ${s.color}` : `Lock ${s.color}`}
                onClick={() => updateStop(s.id, { locked: !s.locked })}
                className={cn('grid h-6 w-6 place-items-center rounded-r-md transition-colors', s.locked ? 'text-ink-50' : 'text-ink-500 hover:text-ink-200')}
              >
                {s.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              </button>
            </Tooltip>
          </div>
        ))}
      </div>

      {selected && (
        <div className="grid grid-cols-[1fr_76px] items-end gap-2 rounded-lg border border-line bg-white/[0.02] p-2.5">
          <ColorField
            label="Selected colour"
            value={selected.color}
            onChange={(hex) => updateStop(selected.id, { color: hex }, { coalesce: `stop-color-${selected.id}` })}
            trailing={
              <Tooltip content="Delete stop">
                <Button size="icon" variant="ghost" aria-label="Delete colour stop" onClick={() => removeStop(selected.id)} disabled={stops.length <= 2}>
                  <Trash2 />
                </Button>
              </Tooltip>
            }
          />
          <div className="grid gap-1.5">
            <label htmlFor="stop-pos" className="text-xs text-ink-300">
              Position
            </label>
            <div className="relative">
              <input
                id="stop-pos"
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(selected.position * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) updateStop(selected.id, { position: clamp(v / 100) }, { coalesce: `stop-pos-${selected.id}` })
                }}
                className="tabular h-8 w-full rounded-md border border-line bg-black/25 pr-5 pl-2 font-mono text-xs text-ink-100 outline-none hover:border-line-strong focus-visible:border-white/40"
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-2xs text-ink-500">%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
