import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink-50 text-ink-950 hover:bg-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_4px_18px_-6px_rgba(255,255,255,0.35)]',
  secondary: 'bg-ink-750 text-ink-100 hover:bg-ink-700 border border-line',
  ghost: 'text-ink-200 hover:text-ink-50 hover:bg-white/[0.06]',
  outline: 'border border-line-strong text-ink-100 hover:bg-white/[0.05]',
  danger: 'text-danger hover:bg-danger/10',
}

const sizes: Record<Size, string> = {
  xs: 'h-6 px-2 text-2xs gap-1 rounded-xs',
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-md',
  icon: 'h-8 w-8 rounded-md',
  'icon-sm': 'h-7 w-7 rounded-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,opacity,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
