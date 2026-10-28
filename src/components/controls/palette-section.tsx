import { useMemo, useState } from 'react'
import { Check, Copy, Heart, Shuffle, Trash2, Wand2 } from 'lucide-react'
import type { Harmony, Mood, WallpaperConfig } from '@/types/config'
import { defaultConfig, useEditor } from '@/store/editor'
import { PALETTE_PRESETS } from '@/presets/palettes'
import { applyPalettePreset } from '@/features/gradient-engine/generate'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubHeading } from '@/components/ui/section'
import { Tooltip } from '@/components/ui/tooltip'
import { GradientThumb } from '@/components/presets/preset-thumb'
import { formatSeed, parseSeed } from '@/lib/random'
import { decodeShareCode, encodeShareCode } from '@/features/persistence/sanitize'
import { gradientToCss } from '@/features/gradient-engine/render'
import { cn } from '@/lib/cn'

const HARMONY_OPTIONS: { value: Harmony | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Any harmony' },
  { value: 'analogous', label: 'Analogous' },
  { value: 'complementary', label: 'Complementary' },
  { value: 'split-complementary', label: 'Split-complementary' },
  { value: 'triadic', label: 'Triadic' },
  { value: 'monochromatic', label: 'Monochromatic' },
]

const MOOD_OPTIONS: { value: Mood | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Any mood' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'deep', label: 'Deep & moody' },
  { value: 'neon', label: 'Neon' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'earth', label: 'Earth' },
]

let presetGradients: Map<string, WallpaperConfig['gradient']> | null = null
function getPresetGradients() {
  if (!presetGradients) {
    const base = defaultConfig()
    presetGradients = new Map(PALETTE_PRESETS.map((p) => [p.id, applyPalettePreset(base, p).gradient]))
  }
  return presetGradients
}

export function PresetGallery({ compact }: { compact?: boolean }) {
  const apply = useEditor((s) => s.applyPalettePreset)
  const current = useEditor((s) => s.config.gradient)
  const gradients = useMemo(getPresetGradients, [])
  const activeId = PALETTE_PRESETS.find((p) => {
    const g = gradients.get(p.id)!
    return g.type === current.type && g.base === current.base && g.stops.map((s) => s.color).join() === current.stops.map((s) => s.color).join()
  })?.id
  return (
    <div className={cn('grid gap-2', compact ? 'scroll-thin auto-cols-[112px] grid-flow-col overflow-x-auto pb-1' : 'grid-cols-3')}>
      {PALETTE_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => apply(p.id)}
          aria-pressed={activeId === p.id}
          className={cn(
            'group grid gap-1 rounded-lg border p-1 text-left transition-[border-color,transform] duration-200 hover:-translate-y-px',
            activeId === p.id ? 'border-white/60' : 'border-line hover:border-line-strong',
          )}
        >
          <GradientThumb gradient={gradients.get(p.id)!} className="aspect-[16/9] w-full rounded-md" />
          <span className="truncate px-0.5 pb-0.5 text-[10.5px] font-medium text-ink-200 group-hover:text-ink-50">{p.name}</span>
        </button>
      ))}
    </div>
  )
}

function SeedControls() {
  const seed = useEditor((s) => s.config.seed)
  const applySeed = useEditor((s) => s.applySeed)
  const recent = useEditor((s) => s.recentSeeds)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const parsed = parseSeed(input)

  return (
    <div className="grid gap-2">
      <SubHeading>Seed</SubHeading>
      <div className="flex items-center gap-1.5">
        <div className="flex h-8 flex-1 items-center justify-between rounded-md border border-line bg-black/25 px-2.5">
          <span className="font-mono text-xs tracking-wider text-ink-50">{formatSeed(seed)}</span>
          <Tooltip content="Copy seed">
            <button
              type="button"
              aria-label="Copy seed"
              className="text-ink-400 hover:text-ink-100"
              onClick={() => {
                navigator.clipboard?.writeText(formatSeed(seed))
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </Tooltip>
        </div>
        <form
          className="flex flex-1 gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed !== null) {
              applySeed(parsed)
              setInput('')
            }
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste seed" aria-label="Seed to apply" className="font-mono" aria-invalid={input.length > 0 && parsed === null} />
          <Button type="submit" size="sm" className="h-8" disabled={parsed === null}>
            Apply
          </Button>
        </form>
      </div>
      <p className="text-2xs leading-relaxed text-ink-400">The same seed, constraints and locked colours always regenerate the same composition.</p>
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recent.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applySeed(s)}
              className={cn('rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors', s === seed ? 'border-white/40 text-ink-50' : 'border-line text-ink-400 hover:text-ink-100')}
            >
              {formatSeed(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Favorites() {
  const favorites = useEditor((s) => s.favorites)
  const save = useEditor((s) => s.saveFavorite)
  const apply = useEditor((s) => s.applyFavorite)
  const remove = useEditor((s) => s.deleteFavorite)
  return (
    <div className="grid gap-2">
      <SubHeading
        action={
          <Button size="xs" variant="ghost" onClick={save}>
            <Heart className="size-3!" /> Save current
          </Button>
        }
      >
        Favourites
      </SubHeading>
      {favorites.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-center text-2xs leading-relaxed text-ink-400">
          No favourites yet. Save a palette you like and it will stay here, on this device.
        </p>
      ) : (
        <div className="grid gap-1">
          {favorites.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-md border border-line p-1 pr-1.5 hover:border-line-strong">
              <button type="button" onClick={() => apply(f.id)} className="flex min-w-0 flex-1 items-center gap-2" aria-label={`Apply ${f.name}`}>
                <span className="h-6 w-14 shrink-0 rounded-[5px]" style={{ background: gradientToCss({ stops: f.stops, angle: 0 }) }} />
                <span className="truncate text-xs text-ink-200">{f.name}</span>
              </button>
              <Tooltip content="Remove favourite">
                <button type="button" onClick={() => remove(f.id)} className="text-ink-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100" aria-label={`Delete ${f.name}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ShareCode() {
  const config = useEditor((s) => s.config)
  const loadConfig = useEditor((s) => s.loadConfig)
  const toast = useEditor((s) => s.toast)
  const [code, setCode] = useState('')
  return (
    <div className="grid gap-2">
      <SubHeading>Composition code</SubHeading>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-8"
          onClick={() => {
            navigator.clipboard?.writeText(encodeShareCode(config))
            toast('Composition code copied — paste it here to restore every setting', 'success')
          }}
        >
          <Copy /> Copy code
        </Button>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a code…" aria-label="Composition code" className="font-mono" />
        <Button
          size="sm"
          className="h-8"
          disabled={!code.trim()}
          onClick={() => {
            const cfg = decodeShareCode(code, defaultConfig())
            if (cfg) {
              loadConfig(cfg)
              setCode('')
              toast('Composition restored', 'success')
            } else toast('That code could not be read.', 'error')
          }}
        >
          Load
        </Button>
      </div>
    </div>
  )
}

export function PaletteSection() {
  const constraints = useEditor((s) => s.config.constraints)
  const patch = useEditor((s) => s.patch)
  const randomize = useEditor((s) => s.randomize)
  const locked = useEditor((s) => s.config.gradient.stops.filter((x) => x.locked).length)

  return (
    <>
      <PresetGallery />
      <div className="grid gap-2">
        <SubHeading>Generator</SubHeading>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Harmony" value={constraints.harmony} options={HARMONY_OPTIONS} onChange={(v) => patch('constraints', { harmony: v })} />
          <Select label="Mood" value={constraints.mood} options={MOOD_OPTIONS} onChange={(v) => patch('constraints', { mood: v })} />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1" onClick={() => randomize('colors')}>
            <Wand2 /> New colours
          </Button>
          <Button size="sm" className="flex-1" onClick={() => randomize('all')}>
            <Shuffle /> New composition
          </Button>
        </div>
        {locked > 0 && <p className="text-2xs text-ink-400">{locked} locked colour{locked > 1 ? 's' : ''} will be kept, and new colours harmonise with {locked > 1 ? 'them' : 'it'}.</p>}
      </div>
      <SeedControls />
      <Favorites />
      <ShareCode />
    </>
  )
}
