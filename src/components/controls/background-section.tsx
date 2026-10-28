import { Shuffle } from 'lucide-react'
import type { GradientType } from '@/types/config'
import { useEditor } from '@/store/editor'
import { Slider, deg, pct } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { XYPad } from '@/components/ui/xy-pad'
import { ColorField } from '@/components/ui/color-field'
import { Advanced } from '@/components/ui/section'
import { GradientEditor } from './gradient-editor'
import { cn } from '@/lib/cn'
import { gradientToCss } from '@/features/gradient-engine/render'

export const GRADIENT_TYPES: { value: GradientType; label: string; description: string }[] = [
  { value: 'mesh', label: 'Mesh', description: 'Soft colour fields blended in OKLab' },
  { value: 'aurora', label: 'Aurora', description: 'Luminous ribbons over a deep sky' },
  { value: 'glow', label: 'Glow', description: 'Ambient light sources in the dark' },
  { value: 'atmospheric', label: 'Atmosphere', description: 'Layered horizon with haze' },
  { value: 'displaced', label: 'Flow', description: 'Noise-displaced gradient' },
  { value: 'linear', label: 'Linear', description: 'Clean directional gradient' },
  { value: 'radial', label: 'Radial', description: 'Light from a focal point' },
]

const usesAngle = (t: GradientType) => t === 'linear' || t === 'atmospheric' || t === 'displaced'
const usesFocal = (t: GradientType) => t === 'radial' || t === 'atmospheric'
const usesWarp = (t: GradientType) => t !== 'linear' && t !== 'radial'

export function BackgroundSection() {
  const g = useEditor((s) => s.config.gradient)
  const aspect = useEditor((s) => s.config.canvas.width / s.config.canvas.height)
  const patch = useEditor((s) => s.patch)
  const randomize = useEditor((s) => s.randomize)
  const setGradientType = useEditor((s) => s.setGradientType)
  const set = (values: Partial<typeof g>, key?: string) => patch('gradient', values, key ? { coalesce: `gradient.${key}` } : undefined)

  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-300">Style</span>
          <Switch
            className="gap-2"
            label={<span className="text-2xs text-ink-400">Auto on shuffle</span>}
            checked={g.autoType}
            onChange={(v) => set({ autoType: v })}
          />
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Gradient style">
          {GRADIENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={g.type === t.value}
              title={t.description}
              onClick={() => setGradientType(t.value)}
              className={cn(
                'group grid gap-1 rounded-md border p-1 text-left transition-colors',
                g.type === t.value ? 'border-white/50 bg-white/[0.05]' : 'border-line hover:border-line-strong',
              )}
            >
              <span className="h-6 rounded-[5px]" style={{ background: typeSwatch(t.value, g) }} />
              <span className={cn('px-0.5 text-[10.5px] font-medium', g.type === t.value ? 'text-ink-50' : 'text-ink-300')}>{t.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => randomize('geometry')}
            className="grid place-items-center gap-1 rounded-md border border-dashed border-line p-1 text-ink-400 transition-colors hover:border-line-strong hover:text-ink-100"
            title="Shuffle the gradient geometry (light positions, angle, warp)"
          >
            <Shuffle className="size-3.5" />
            <span className="text-[10.5px] font-medium">Geometry</span>
          </button>
        </div>
      </div>

      <GradientEditor />

      <Slider label="Intensity" value={g.intensity} min={0} max={1} onChange={(v) => set({ intensity: v }, 'intensity')} format={pct} resetTo={0.75} hint="Colour vividness and light strength. 75% renders the palette as authored." />
      <Slider label="Smoothness" value={g.smoothness} min={0} max={1} onChange={(v) => set({ smoothness: v }, 'smoothness')} format={pct} resetTo={0.7} hint="How softly colours blend. Lower values hold each colour longer before transitioning." />
      {usesAngle(g.type) && <Slider label="Angle" value={g.angle} min={0} max={360} step={1} onChange={(v) => set({ angle: v }, 'angle')} format={deg} resetTo={90} />}
      {usesWarp(g.type) && <Slider label="Organic warp" value={g.warp} min={0} max={1} onChange={(v) => set({ warp: v }, 'warp')} format={pct} hint="Domain warping that bends the colour fields into organic shapes." />}
      {usesFocal(g.type) && <XYPad label="Focal point" value={g.focal} aspect={aspect} onChange={(p) => set({ focal: p }, 'focal')} background="rgba(0,0,0,0.25)" />}

      <Advanced>
        <ColorField label="Base colour" value={g.base} onChange={(hex) => set({ base: hex }, 'base')} />
        <p className="-mt-2 text-2xs leading-relaxed text-ink-400">The deep tone that aurora, glow and mesh styles emerge from.</p>
        <Switch
          label="Transparent background"
          description="Export only the graph, as a PNG with alpha"
          checked={g.transparent}
          onChange={(v) => set({ transparent: v })}
        />
      </Advanced>
    </>
  )
}

function typeSwatch(type: GradientType, g: { stops: { color: string; position: number }[]; base: string }) {
  const c = [...g.stops].sort((a, b) => a.position - b.position).map((s) => s.color)
  const a = c[0] ?? '#333'
  const b = c[Math.floor(c.length / 2)] ?? '#666'
  const d = c[c.length - 1] ?? '#999'
  switch (type) {
    case 'linear':
      return gradientToCss({ stops: g.stops as never, angle: 0 })
    case 'radial':
      return `radial-gradient(circle at 50% 100%, ${a}, ${b} 50%, ${d})`
    case 'mesh':
      return `radial-gradient(at 20% 30%, ${a}, transparent 60%), radial-gradient(at 80% 20%, ${b}, transparent 60%), radial-gradient(at 60% 90%, ${d}, transparent 60%), ${g.base}`
    case 'aurora':
      return `linear-gradient(to bottom, transparent 30%, ${b}aa 55%, transparent 70%), radial-gradient(ellipse at 50% 60%, ${d}88, transparent 60%), ${g.base}`
    case 'glow':
      return `radial-gradient(circle at 30% 40%, ${b}, transparent 55%), radial-gradient(circle at 75% 70%, ${d}, transparent 50%), ${g.base}`
    case 'atmospheric':
      return `linear-gradient(to bottom, ${a}, ${b} 60%, ${d})`
    case 'displaced':
      return `linear-gradient(120deg, ${a}, ${b} 35%, ${d} 55%, ${b} 80%, ${a})`
  }
}
