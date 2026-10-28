import { useId } from 'react'
import { Slider as S } from 'radix-ui'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tooltip } from './tooltip'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: string
  /** Double-clicking the label restores this value. */
  resetTo?: number
  disabled?: boolean
  className?: string
}

export const pct = (v: number) => `${Math.round(v * 100)}%`
export const px = (v: number) => `${Math.round(v * 10) / 10}px`
export const deg = (v: number) => `${Math.round(v)}°`
export const times = (v: number) => `${v.toFixed(2)}×`

export function Slider({ label, value, min, max, step = 0.01, onChange, format, hint, resetTo, disabled, className }: SliderProps) {
  const id = useId()
  const display = format ? format(value) : String(Math.round(value * 100) / 100)
  return (
    <div className={cn('group grid gap-1.5', disabled && 'opacity-40', className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          id={id}
          className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-300 select-none"
          onDoubleClick={() => resetTo !== undefined && !disabled && onChange(resetTo)}
          title={resetTo !== undefined ? 'Double-click to reset' : undefined}
        >
          {label}
          {hint && (
            <Tooltip content={hint} side="top">
              <button type="button" className="text-ink-500 hover:text-ink-200" aria-label={`About ${label}`}>
                <Info className="size-3" />
              </button>
            </Tooltip>
          )}
        </label>
        <span className="tabular font-mono text-2xs text-ink-400">{display}</span>
      </div>
      <S.Root
        aria-labelledby={id}
        className="relative flex h-4 w-full touch-none items-center select-none"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      >
        <S.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/[0.09]">
          <S.Range className="absolute h-full rounded-full bg-ink-200/70" />
        </S.Track>
        <S.Thumb
          aria-label={label}
          className="block size-3.5 rounded-full border border-black/20 bg-ink-50 shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-white/80 active:scale-95"
        />
      </S.Root>
    </div>
  )
}
