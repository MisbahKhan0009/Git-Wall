import { useId, type ReactNode } from 'react'
import { Switch as S } from 'radix-ui'
import { cn } from '@/lib/cn'

export function Switch({
  label,
  checked,
  onChange,
  description,
  className,
  disabled,
}: {
  label: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  description?: string
  className?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className={cn('flex items-center justify-between gap-3', disabled && 'opacity-40', className)}>
      <label htmlFor={id} className="grid min-w-0 gap-0.5 select-none">
        <span className="text-xs text-ink-200">{label}</span>
        {description && <span className="text-2xs text-ink-400">{description}</span>}
      </label>
      <S.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="relative h-[18px] w-8 shrink-0 rounded-full bg-white/[0.1] transition-colors data-[state=checked]:bg-ink-100"
      >
        <S.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-ink-200 shadow transition-transform duration-200 data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-ink-950" />
      </S.Root>
    </div>
  )
}
