import { useRef } from 'react'
import type { Point } from '@/types/config'
import { clamp } from '@/lib/math'

/** Two-dimensional position control with pointer and keyboard support. */
export function XYPad({
  label,
  value,
  onChange,
  aspect = 16 / 9,
  background,
}: {
  label: string
  value: Point
  onChange: (p: Point) => void
  aspect?: number
  background?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onChange({ x: Math.round(clamp((e.clientX - r.left) / r.width) * 1000) / 1000, y: Math.round(clamp((e.clientY - r.top) / r.height) * 1000) / 1000 })
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-300">{label}</span>
        <span className="tabular font-mono text-2xs text-ink-400">
          {Math.round(value.x * 100)}, {Math.round(value.y * 100)}
        </span>
      </div>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={`x ${Math.round(value.x * 100)}%, y ${Math.round(value.y * 100)}%`}
        className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-md border border-line"
        style={{ aspectRatio: aspect, background: background ?? 'rgba(0,0,0,0.25)' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={(e) => e.buttons === 1 && move(e)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02
          const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
          if (d) {
            e.preventDefault()
            onChange({ x: clamp(value.x + d[0]), y: clamp(value.y + d[1]) })
          }
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:33.33%_33.33%]" />
        <div
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${clamp(value.x) * 100}%`, top: `${clamp(value.y) * 100}%` }}
        />
      </div>
    </div>
  )
}
