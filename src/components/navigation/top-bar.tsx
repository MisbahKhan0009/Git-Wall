import { ChevronDown, Download, Redo2, Shuffle, Undo2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { selectDirty, useEditor } from '@/store/editor'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import type { RandomizeScope } from '@/features/gradient-engine/generate'
import { cn } from '@/lib/cn'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD = isMac ? '⌘' : 'Ctrl'

const SCOPES: { scope: RandomizeScope; label: string; hint: string }[] = [
  { scope: 'all', label: 'Everything', hint: 'R' },
  { scope: 'colors', label: 'Colours only', hint: '' },
  { scope: 'geometry', label: 'Gradient geometry', hint: '' },
  { scope: 'graph', label: 'Graph palette', hint: '' },
  { scope: 'effects', label: 'Effects', hint: '' },
]

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
        <defs>
          <linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b7bff" />
            <stop offset="0.6" stopColor="#c0a8ff" />
            <stop offset="1" stopColor="#7fd8f5" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={1 + c * 6.5} y={1 + r * 6.5} width="5" height="5" rx="1.4" fill="url(#wm)" opacity={[0.35, 0.7, 1, 0.7, 1, 0.5, 1, 0.45, 0.85][r * 3 + c]} />
          )),
        )}
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink-50">GitHue</span>
    </div>
  )
}

function SaveStatus() {
  const dirty = useEditor(selectDirty)
  const activeId = useEditor((s) => s.activePresetId)
  const name = useEditor((s) => s.presets.find((p) => p.id === s.activePresetId)?.name)
  const label = activeId ? (dirty ? 'Unsaved changes' : 'Saved') : 'Draft · autosaved locally'
  return (
    <div className="hidden min-w-0 items-center gap-1.5 text-2xs text-ink-400 md:flex" role="status" aria-live="polite">
      <span className={cn('size-1.5 shrink-0 rounded-full', activeId && dirty ? 'bg-warn' : activeId ? 'bg-signal' : 'bg-ink-500')} />
      <span className="truncate">
        {label}
        {name && <span className="text-ink-300"> · {name}</span>}
      </span>
    </div>
  )
}

export function TopBar({ onExport }: { onExport: () => void }) {
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const randomize = useEditor((s) => s.randomize)

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-ink-950/90 px-3 backdrop-blur-xl sm:px-4">
      <Wordmark />
      <span className="hidden h-4 w-px bg-line-strong md:block" />
      <SaveStatus />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip content={`Undo (${MOD}Z)`}>
          <Button variant="ghost" size="icon" aria-label="Undo" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </Button>
        </Tooltip>
        <Tooltip content={`Redo (${MOD}⇧Z)`}>
          <Button variant="ghost" size="icon" aria-label="Redo" onClick={redo} disabled={!canRedo}>
            <Redo2 />
          </Button>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-line-strong" />

        <div className="flex items-center">
          <Tooltip content="New composition (R) — keeps locked colours and constraints">
            <Button variant="secondary" size="sm" className="h-8 rounded-r-none border-r-0 pr-2.5" onClick={() => randomize('all')}>
              <Shuffle />
              <span className="hidden sm:inline">Shuffle</span>
            </Button>
          </Tooltip>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="secondary" size="sm" className="h-8 w-7 rounded-l-none px-0" aria-label="Shuffle options">
                <ChevronDown className="size-3.5!" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-48 rounded-lg border border-line-strong bg-ink-850/95 p-1 shadow-2xl backdrop-blur-xl animate-fade-in"
              >
                <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-2xs tracking-[0.08em] text-ink-400 uppercase">Shuffle</DropdownMenu.Label>
                {SCOPES.map((s) => (
                  <DropdownMenu.Item
                    key={s.scope}
                    onSelect={() => randomize(s.scope)}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs text-ink-100 outline-none data-[highlighted]:bg-white/[0.07]"
                  >
                    {s.label}
                    {s.hint && <kbd className="font-mono text-2xs text-ink-400">{s.hint}</kbd>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <Button variant="primary" size="sm" className="ml-1.5 h-8 px-3" onClick={onExport}>
          <Download />
          Export
        </Button>
      </div>
    </header>
  )
}
