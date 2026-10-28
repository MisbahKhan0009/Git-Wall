import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Section({
  id,
  title,
  icon,
  children,
  defaultOpen = true,
  action,
  forceOpen,
}: {
  id: string
  title: string
  icon: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  action?: ReactNode
  /** Mobile tabs show one section at a time, always expanded. */
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  return (
    <section id={`section-${id}`} className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`section-body-${id}`}
          onClick={() => setOpen(!open)}
          disabled={forceOpen}
          className="flex flex-1 items-center gap-2.5 text-left text-[13px] font-medium text-ink-100"
        >
          <span className="text-ink-400 [&_svg]:size-4">{icon}</span>
          {title}
          {!forceOpen && <ChevronRight className={cn('ml-auto size-3.5 text-ink-500 transition-transform duration-200', isOpen && 'rotate-90')} />}
        </button>
        {action}
      </div>
      {isOpen && (
        <div id={`section-body-${id}`} className="grid gap-4 px-4 pt-0.5 pb-5 animate-fade-in">
          {children}
        </div>
      )}
    </section>
  )
}

/** A quieter, nested disclosure for advanced settings. */
export function Advanced({ title = 'Advanced', children, defaultOpen = false }: { title?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-line bg-white/[0.015]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-300 hover:text-ink-100"
      >
        <ChevronRight className={cn('size-3 transition-transform duration-200', open && 'rotate-90')} />
        {title}
      </button>
      {open && <div className="grid gap-4 px-3 pt-1 pb-3.5 animate-fade-in">{children}</div>}
    </div>
  )
}

export function SubHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="-mb-1 flex items-center justify-between">
      <h3 className="text-2xs font-medium tracking-[0.08em] text-ink-400 uppercase">{children}</h3>
      {action}
    </div>
  )
}
