import { Dices } from 'lucide-react'
import type { GlassBlend, GlassConfig, GlassStyle, GrainConfig } from '@/types/config'
import { useEditor } from '@/store/editor'
import { GRAIN_PRESETS } from '@/features/grain-engine/grain'
import { GLASS_STYLES } from '@/features/glass-engine/glass'
import { Slider, deg, pct, times } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { ColorField } from '@/components/ui/color-field'
import { XYPad } from '@/components/ui/xy-pad'
import { Advanced, SubHeading } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { randomSeed } from '@/lib/random'

function GrainControls() {
  const g = useEditor((s) => s.config.grain)
  const patch = useEditor((s) => s.patch)
  const set = (values: Partial<GrainConfig>, key?: string) => patch('grain', values, key ? { coalesce: `grain.${key}` } : undefined)
  const activePreset = (Object.keys(GRAIN_PRESETS) as (keyof typeof GRAIN_PRESETS)[]).find((k) => {
    const p = GRAIN_PRESETS[k]
    return g.enabled && p.intensity === g.intensity && p.opacity === g.opacity && p.scale === g.scale
  })

  return (
    <div className="grid gap-3.5">
      <SubHeading
        action={
          <Switch label={<span className="sr-only">Enable grain</span>} checked={g.enabled} onChange={(v) => set({ enabled: v })} />
        }
      >
        Grain
      </SubHeading>
      <Segmented
        label="Grain preset"
        value={activePreset ?? ''}
        options={[
          { value: 'subtle', label: 'Subtle' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'heavy', label: 'Heavy' },
        ]}
        onChange={(k) => patch('grain', { ...GRAIN_PRESETS[k as keyof typeof GRAIN_PRESETS] })}
      />
      <div className={cn('grid gap-3.5', !g.enabled && 'pointer-events-none opacity-40')} aria-disabled={!g.enabled}>
        <Slider label="Intensity" value={g.intensity} min={0} max={1} onChange={(v) => set({ intensity: v }, 'intensity')} format={pct} />
        <Slider label="Opacity" value={g.opacity} min={0} max={1} onChange={(v) => set({ opacity: v }, 'opacity')} format={pct} />
        <Slider label="Scale" value={g.scale} min={0.5} max={4} step={0.05} onChange={(v) => set({ scale: v }, 'scale')} format={times} hint="Grain size relative to a 1080p canvas, so it looks the same at every resolution." />
        <Advanced>
          <Slider label="Contrast" value={g.contrast} min={0} max={1} onChange={(v) => set({ contrast: v }, 'contrast')} format={pct} />
          <Segmented
            label="Grain character"
            value={g.coarse ? 'coarse' : 'fine'}
            options={[
              { value: 'fine', label: 'Fine' },
              { value: 'coarse', label: 'Coarse' },
            ]}
            onChange={(v) => set({ coarse: v === 'coarse' })}
          />
          <Switch label="Coloured noise" description="Subtle chroma variation instead of pure monochrome" checked={g.colored} onChange={(v) => set({ colored: v })} />
          <Switch label="Film texture" description="Clumped grain, faint dust and a soft vignette" checked={g.film} onChange={(v) => set({ film: v })} />
          <Switch label="Grain over graph" description="Apply grain to the graph and text too" checked={g.overGraph} onChange={(v) => set({ overGraph: v })} />
          <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => set({ seed: randomSeed() })}>
            <Dices /> New grain pattern
          </Button>
        </Advanced>
      </div>
    </div>
  )
}

const BLENDS: { value: GlassBlend; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'luminosity', label: 'Luminosity' },
]

function GlassControls() {
  const g = useEditor((s) => s.config.glass)
  const aspect = useEditor((s) => s.config.canvas.width / s.config.canvas.height)
  const patch = useEditor((s) => s.patch)
  const set = (values: Partial<GlassConfig>, key?: string) => patch('glass', values, key ? { coalesce: `glass.${key}` } : undefined)
  const styles = Object.entries(GLASS_STYLES) as [GlassStyle, (typeof GLASS_STYLES)[GlassStyle]][]

  return (
    <div className="grid gap-3.5">
      <SubHeading action={<Switch label={<span className="sr-only">Enable glass</span>} checked={g.enabled} onChange={(v) => patch('glass', { enabled: v }, { transition: true })} />}>
        Fractal glass
      </SubHeading>
      <div className={cn('grid gap-3.5', !g.enabled && 'pointer-events-none opacity-40')} aria-disabled={!g.enabled}>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Glass style">
          {styles.map(([id, s]) => (
            <Tooltip key={id} content={s.description}>
              <button
                type="button"
                role="radio"
                aria-checked={g.style === id}
                onClick={() => patch('glass', { ...s.values, style: id }, { transition: true })}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors',
                  g.style === id ? 'border-white/50 bg-white/[0.05] text-ink-50' : 'border-line text-ink-300 hover:border-line-strong hover:text-ink-100',
                )}
              >
                <GlassIcon style={id} />
                {s.label}
              </button>
            </Tooltip>
          ))}
        </div>
        <Slider label="Intensity" value={g.intensity} min={0} max={1} onChange={(v) => set({ intensity: v }, 'intensity')} format={pct} />
        <Slider label="Density" value={g.density} min={2} max={60} step={1} onChange={(v) => set({ density: v }, 'density')} format={(v) => `${Math.round(v)}`} hint="Flutes or cells across the full width of the wallpaper." />
        <Slider label="Distortion" value={g.distortion} min={0} max={1} onChange={(v) => set({ distortion: v }, 'distortion')} format={pct} hint="How far each flute displaces and compresses what is behind it." />
        <Slider label="Coverage" value={g.coverage} min={0.1} max={1} onChange={(v) => set({ coverage: v }, 'coverage')} format={pct} hint="Width of the glass pane. 100% covers the whole wallpaper." />
        <XYPad label="Position" value={g.position} aspect={aspect} onChange={(p) => set({ position: p }, 'position')} />
        <Advanced>
          <Slider label="Layers" value={g.layers} min={1} max={3} step={1} onChange={(v) => set({ layers: v }, 'layers')} format={(v) => `${v}`} />
          <Slider label="Shape scale" value={g.scale} min={0.5} max={3} step={0.05} onChange={(v) => set({ scale: v }, 'scale')} format={times} hint="Magnification of the refracted image inside each shape." />
          <Slider label="Corner softness" value={g.softness} min={0} max={1} onChange={(v) => set({ softness: v }, 'softness')} format={pct} />
          <Slider label="Blur" value={g.blur} min={0} max={1} onChange={(v) => set({ blur: v }, 'blur')} format={pct} />
          <Slider label="Transparency" value={g.transparency} min={0} max={1} onChange={(v) => set({ transparency: v }, 'transparency')} format={pct} hint="100% is clear glass; lower values add a milky frost." />
          <Slider label="Highlights" value={g.highlight} min={0} max={1} onChange={(v) => set({ highlight: v }, 'highlight')} format={pct} />
          <Slider label="Shadows" value={g.shadow} min={0} max={1} onChange={(v) => set({ shadow: v }, 'shadow')} format={pct} />
          <Slider label="Angle" value={g.angle} min={-45} max={45} step={1} onChange={(v) => set({ angle: v }, 'angle')} format={deg} resetTo={0} />
          <ColorField label="Tint" value={g.tint} onChange={(hex) => set({ tint: hex }, 'tint')} />
          <Slider label="Tint amount" value={g.tintAmount} min={0} max={1} onChange={(v) => set({ tintAmount: v }, 'tintAmount')} format={pct} />
          <Select label="Blend mode" value={g.blend} options={BLENDS} onChange={(v) => set({ blend: v })} />
          <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => set({ seed: randomSeed() })}>
            <Dices /> New glass pattern
          </Button>
        </Advanced>
      </div>
    </div>
  )
}

function GlassIcon({ style }: { style: GlassStyle }) {
  const bars: Record<GlassStyle, number[]> = {
    soft: [3, 3, 3, 3],
    shards: [2, 4, 1.5, 3, 2],
    organic: [3, 3, 3, 3],
    geometric: [],
    minimal: [6, 6],
  }
  if (style === 'geometric')
    return (
      <span className="grid size-3.5 shrink-0 grid-cols-2 gap-px">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded-[1.5px] bg-white/45" />
        ))}
      </span>
    )
  return (
    <span className={cn('flex h-3.5 w-4 shrink-0 gap-px overflow-hidden rounded-[2px]', style === 'shards' && 'skew-x-[-12deg]', style === 'organic' && 'rounded-full')}>
      {bars[style].map((w, i) => (
        <span key={i} className="h-full bg-gradient-to-r from-white/60 to-white/10" style={{ flex: w }} />
      ))}
    </span>
  )
}

export function EffectsSection() {
  return (
    <>
      <GrainControls />
      <div className="h-px bg-line" />
      <GlassControls />
    </>
  )
}
