import { useEditor } from '@/store/editor'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/tooltip'

/** Always-visible provenance of the contribution data shown on the canvas. */
export function DataBadge({ className }: { className?: string }) {
  const data = useEditor((s) => s.data)
  const status = useEditor((s) => s.status)
  const loading = status.kind === 'loading'
  const label = loading ? `Loading @${status.username}…` : data.source === 'sample' ? 'Sample data' : data.source === 'imported' ? `Imported${data.username ? ` · @${data.username}` : ''}` : `@${data.username}`
  const dot = loading ? 'bg-ink-300 animate-pulse' : data.source === 'sample' ? 'bg-warn' : data.source === 'imported' ? 'bg-sky-300' : 'bg-signal'
  return (
    <Tooltip content={loading ? 'Fetching public profile and contribution calendar' : data.sourceLabel} side="bottom">
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-2xs font-medium text-white/85 backdrop-blur-md',
          className,
        )}
        role="status"
      >
        <span className={cn('size-1.5 rounded-full', dot)} />
        {label}
      </div>
    </Tooltip>
  )
}
