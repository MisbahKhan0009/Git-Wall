import { useEffect, useState } from 'react'
import { AlertCircle, Check, Copy, Download, Loader2, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { ExportFormat } from '@/types/config'
import { useEditor, selectDirty } from '@/store/editor'
import { ASPECT_RATIOS, RESOLUTION_PRESETS } from '@/presets/defaults'
import { effectiveFormat, exportFilename, MAX_DIMENSION } from '@/features/export/export'
import { Segmented } from '@/components/ui/segmented'
import { Slider, pct } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubHeading } from '@/components/ui/section'
import { Tooltip } from '@/components/ui/tooltip'
import { formatBytes, useExport } from '@/components/export/use-export'
import { cn } from '@/lib/cn'

function ratioOf(w: number, h: number) {
  return ASPECT_RATIOS.find((r) => Math.abs(w / h - r.w / r.h) < 0.012)?.id ?? 'custom'
}

function DimensionInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = Math.round(Number(text))
    if (Number.isFinite(n) && n >= 320 && n <= MAX_DIMENSION) onCommit(n)
    else setText(String(value))
  }
  return (
    <label className="grid gap-1">
      <span className="text-2xs text-ink-400">{label}</span>
      <Input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="tabular font-mono"
        aria-label={`${label} in pixels`}
      />
    </label>
  )
}

export function ExportSettings() {
  const canvas = useEditor((s) => s.config.canvas)
  const exp = useEditor((s) => s.config.export)
  const transparent = useEditor((s) => s.config.gradient.transparent)
  const config = useEditor((s) => s.config)
  const data = useEditor((s) => s.data)
  const patch = useEditor((s) => s.patch)
  const { state, run } = useExport()
  const ratio = ratioOf(canvas.width, canvas.height)
  const presets = RESOLUTION_PRESETS.filter((r) => ratio === 'custom' || ratioOf(r.width, r.height) === ratio)
  const format = effectiveFormat(config)

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Aspect ratio</span>
        <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Aspect ratio">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={ratio === r.id}
              onClick={() => {
                const first = RESOLUTION_PRESETS.find((p) => ratioOf(p.width, p.height) === r.id)
                const height = first?.height ?? Math.round(canvas.width / (r.w / r.h))
                patch('canvas', first ? { width: first.width, height } : { height })
              }}
              className={cn(
                'grid place-items-center gap-1 rounded-md border px-1 py-1.5 transition-colors',
                ratio === r.id ? 'border-white/50 bg-white/[0.05] text-ink-50' : 'border-line text-ink-400 hover:border-line-strong hover:text-ink-100',
              )}
            >
              <span className="grid h-5 w-full place-items-center">
                <span className="rounded-[2px] border border-current" style={{ width: r.w >= r.h ? 20 : (20 * r.w) / r.h, height: r.w >= r.h ? (20 * r.h) / r.w : 20, maxHeight: 18 }} />
              </span>
              <span className="text-[10px] font-medium">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Resolution</span>
        <div className="flex flex-wrap gap-1">
          {presets.map((r) => {
            const active = r.width === canvas.width && r.height === canvas.height
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => patch('canvas', { width: r.width, height: r.height })}
                aria-pressed={active}
                className={cn(
                  'tabular rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                  active ? 'border-white/50 bg-white/[0.05] text-ink-50' : 'border-line text-ink-300 hover:border-line-strong hover:text-ink-100',
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DimensionInput label="Width" value={canvas.width} onCommit={(width) => patch('canvas', { width })} />
          <DimensionInput label="Height" value={canvas.height} onCommit={(height) => patch('canvas', { height })} />
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Format</span>
        <Segmented<ExportFormat>
          label="File format"
          value={format}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG', title: transparent ? 'JPEG has no transparency — PNG is used' : undefined },
            { value: 'webp', label: 'WebP' },
          ]}
          onChange={(v) => patch('export', { format: v })}
        />
        {transparent && <p className="text-2xs text-ink-400">Transparent background is on — exports keep their alpha channel.</p>}
      </div>
      {format !== 'png' && <Slider label="Quality" value={exp.quality} min={0.5} max={1} onChange={(v) => patch('export', { quality: v }, { coalesce: 'export.quality' })} format={pct} />}

      <div className="grid gap-2 rounded-lg border border-line bg-white/[0.02] p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="tabular font-mono text-xs text-ink-50">
            {canvas.width} × {canvas.height}
          </span>
          <span className="font-mono text-2xs text-ink-400 uppercase">
            {format}
            {transparent ? ' · alpha' : ''}
          </span>
        </div>
        <span className="truncate font-mono text-2xs text-ink-400">{exportFilename(config, data, format)}</span>
        <Button variant="primary" className="mt-1 w-full" onClick={run} disabled={state.kind === 'exporting'}>
          {state.kind === 'exporting' ? <Loader2 className="animate-spin" /> : <Download />}
          {state.kind === 'exporting' ? 'Rendering…' : 'Download wallpaper'}
        </Button>
        {state.kind === 'success' && (
          <p className="flex items-center gap-1.5 text-2xs text-signal" role="status">
            <Check className="size-3" /> Saved {state.filename} · {formatBytes(state.size)}
          </p>
        )}
        {state.kind === 'error' && (
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-danger" role="alert">
            <AlertCircle className="mt-px size-3 shrink-0" /> {state.message}
          </p>
        )}
        {data.source === 'sample' && <p className="text-2xs leading-relaxed text-warn/90">This wallpaper uses sample data. Load a GitHub profile or import your data for your own history.</p>}
      </div>
    </div>
  )
}

function Library() {
  const presets = useEditor((s) => s.presets)
  const activeId = useEditor((s) => s.activePresetId)
  const dirty = useEditor(selectDirty)
  const save = useEditor((s) => s.savePreset)
  const overwrite = useEditor((s) => s.overwritePreset)
  const rename = useEditor((s) => s.renamePreset)
  const duplicate = useEditor((s) => s.duplicatePreset)
  const remove = useEditor((s) => s.deletePreset)
  const load = useEditor((s) => s.loadPreset)
  const restoreDefaults = useEditor((s) => s.restoreDefaults)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="grid gap-2.5">
      <SubHeading>Saved compositions</SubHeading>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          save(name || `Composition ${presets.length + 1}`)
          setName('')
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Composition ${presets.length + 1}`} aria-label="Preset name" maxLength={60} />
        <Button type="submit" size="sm" className="h-8">
          <Save /> Save
        </Button>
      </form>
      {activeId && dirty && (
        <Button size="sm" variant="outline" onClick={() => overwrite(activeId)}>
          Update “{presets.find((p) => p.id === activeId)?.name}”
        </Button>
      )}
      {presets.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-center text-2xs leading-relaxed text-ink-400">
          Saved compositions keep every setting on this device — save one to come back to it later.
        </p>
      ) : (
        <ul className="grid gap-1">
          {presets.map((p) => (
            <li key={p.id} className={cn('group flex items-center gap-1 rounded-md border px-2 py-1', p.id === activeId ? 'border-white/35 bg-white/[0.03]' : 'border-line')}>
              {editing === p.id ? (
                <form
                  className="flex-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    rename(p.id, draft)
                    setEditing(null)
                  }}
                >
                  <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => (rename(p.id, draft), setEditing(null))} className="h-7" aria-label="New name" />
                </form>
              ) : (
                <button type="button" className="min-w-0 flex-1 truncate py-1 text-left text-xs text-ink-100" onClick={() => load(p.id)}>
                  {p.name}
                  <span className="ml-1.5 font-mono text-[10px] text-ink-500">
                    {p.config.canvas.width}×{p.config.canvas.height}
                  </span>
                </button>
              )}
              <div className="flex opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Tooltip content="Rename">
                  <Button size="icon-sm" variant="ghost" aria-label={`Rename ${p.name}`} onClick={() => (setEditing(p.id), setDraft(p.name))}>
                    <Pencil className="size-3.5!" />
                  </Button>
                </Tooltip>
                <Tooltip content="Duplicate">
                  <Button size="icon-sm" variant="ghost" aria-label={`Duplicate ${p.name}`} onClick={() => duplicate(p.id)}>
                    <Copy className="size-3.5!" />
                  </Button>
                </Tooltip>
                <Tooltip content="Delete">
                  <Button size="icon-sm" variant="ghost" className="hover:text-danger" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}>
                    <Trash2 className="size-3.5!" />
                  </Button>
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      )}
      {confirmReset ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-warn/30 bg-warn/[0.06] px-2.5 py-2 text-2xs text-ink-100">
          Restore every setting to the defaults?
          <div className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                restoreDefaults()
                setConfirmReset(false)
              }}
            >
              Restore
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="justify-self-start text-ink-400" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Restore default settings
        </Button>
      )}
    </div>
  )
}

export function ExportSection() {
  return (
    <>
      <ExportSettings />
      <Library />
    </>
  )
}
