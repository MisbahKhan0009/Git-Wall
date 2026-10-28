import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-xs text-ink-300">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-8 w-full appearance-none rounded-md border border-line bg-black/20 pr-8 pl-2.5 text-xs text-ink-100 transition-colors outline-none hover:border-line-strong focus-visible:border-white/40"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-ink-850">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-400" />
      </div>
    </div>
  )
}
