import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Tooltip } from './tooltip'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'sm',
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  label: string
  className?: string
  size?: 'sm' | 'xs'
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex rounded-md border border-line bg-black/20 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        const btn = (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-[7px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-6 px-1.5 text-2xs',
              active ? 'bg-white/[0.11] text-ink-50 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]' : 'text-ink-400 hover:text-ink-100',
            )}
          >
            {o.label}
          </button>
        )
        return o.title ? (
          <Tooltip key={o.value} content={o.title}>
            {btn}
          </Tooltip>
        ) : (
          btn
        )
      })}
    </div>
  )
}
