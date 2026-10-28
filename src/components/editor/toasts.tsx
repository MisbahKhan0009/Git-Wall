import { X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { cn } from '@/lib/cn'

export function Toasts() {
  const toasts = useEditor((s) => s.toasts)
  const dismiss = useEditor((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 grid w-[min(92vw,380px)] -translate-x-1/2 gap-2 md:bottom-5 md:left-5 md:translate-x-0" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-ink-850/95 px-3 py-2.5 text-xs leading-relaxed text-ink-100 shadow-2xl backdrop-blur-xl animate-rise',
            t.tone === 'error' ? 'border-danger/30' : t.tone === 'success' ? 'border-signal/25' : 'border-line-strong',
          )}
        >
          <span className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', t.tone === 'error' ? 'bg-danger' : t.tone === 'success' ? 'bg-signal' : 'bg-ink-300')} />
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="text-ink-500 hover:text-ink-100" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
