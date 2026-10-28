import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-line bg-black/25 px-2.5 text-xs text-ink-50 transition-colors outline-none placeholder:text-ink-500 hover:border-line-strong focus-visible:border-white/40 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
})
