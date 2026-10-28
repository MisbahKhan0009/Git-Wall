import { useMemo } from 'react'
import { Circle, Square, SquareRoundCorner, Sparkles } from 'lucide-react'
import type { ContainerStyle, GraphConfig, GraphPaletteId, LevelMapping } from '@/types/config'
import { useEditor } from '@/store/editor'
import { GRAPH_PALETTES, recommendGraphPalette } from '@/features/graph-renderer/palettes'
import { CONTAINER_STYLES } from '@/features/composition/presets'
import { graphSurface } from '@/features/composition/auto-graph'
import { Slider, pct, px } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { ColorField } from '@/components/ui/color-field'
import { Advanced, SubHeading } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

const DENSITY: { id: string; label: string; values: Partial<GraphConfig> }[] = [
  { id: 'compact', label: 'Compact', values: { cellSize: 11, gap: 2.5, showMonths: true, showWeekdays: true } },
  { id: 'spacious', label: 'Spacious', values: { cellSize: 14, gap: 5, showMonths: true, showWeekdays: true } },
  { id: 'minimal', label: 'Minimal', values: { cellSize: 13, gap: 4, showMonths: false, showWeekdays: false } },
]

function LevelSwatches({ levels, emptyOpacity }: { levels: string[]; emptyOpacity?: number }) {
  return (
    <span className="flex gap-[2px]">
      {levels.map((c, i) => (
        <span key={i} className="size-2.5 rounded-[2px]" style={{ background: c, opacity: i === 0 ? Math.max(0.2, (emptyOpacity ?? 0.1) * 2.2) : 1 }} />
      ))}
    </span>
  )
}

function GraphPalettePicker() {
  const graph = useEditor((s) => s.config.graph)
  const gradient = useEditor((s) => s.config.gradient)
  const container = useEditor((s) => s.config.container)
  const recommended = useMemo(() => {
    const cfg = useEditor.getState().config
    return recommendGraphPalette(gradient, 'harmonious', graphSurface({ ...cfg, gradient, container })).levels
  }, [gradient, container])
  const setGraphPalette = useEditor((s) => s.setGraphPalette)
  const options: { id: GraphPaletteId; name: string; levels: string[] }[] = [
    { id: 'auto', name: 'Matched', levels: recommended },
    ...GRAPH_PALETTES.map((p) => ({ id: p.id, name: p.name, levels: p.levels })),
  ]
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Graph palette">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={graph.paletteId === o.id}
          onClick={() => setGraphPalette(o.id)}
          className={cn(
            'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors',
            graph.paletteId === o.id ? 'border-white/50 bg-white/[0.05] text-ink-50' : 'border-line text-ink-300 hover:border-line-strong hover:text-ink-100',
          )}
        >
          <span className="flex items-center gap-1 truncate">
            {o.id === 'auto' && <Sparkles className="size-3 shrink-0" />}
            {o.name}
          </span>
          <LevelSwatches levels={o.levels} />
        </button>
      ))}
      {graph.paletteId === 'custom' && (
        <div className="col-span-2 flex items-center justify-between rounded-md border border-white/50 bg-white/[0.05] px-2 py-1.5 text-[11px] text-ink-50">
          Custom <LevelSwatches levels={graph.levels} />
        </div>
      )}
    </div>
  )
}

export function GraphSection() {
  const g = useEditor((s) => s.config.graph)
  const patch = useEditor((s) => s.patch)
  const randomize = useEditor((s) => s.randomize)
  const set = (values: Partial<GraphConfig>, key?: string) => patch('graph', values, key ? { coalesce: `graph.${key}` } : undefined)
  const setLevel = (i: number, hex: string) => {
    const levels = [...g.levels] as GraphConfig['levels']
    levels[i] = hex
    patch('graph', { levels, paletteId: 'custom' }, { coalesce: `graph.level${i}` })
  }

  return (
    <>
      <div className="grid gap-2">
        <SubHeading
          action={
            <Button size="xs" variant="ghost" onClick={() => randomize('graph')}>
              Shuffle
            </Button>
          }
        >
          Palette
        </SubHeading>
        <GraphPalettePicker />
      </div>

      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Intensity levels</span>
        <div className="grid grid-cols-5 gap-1.5">
          {g.levels.map((c, i) => (
            <label key={i} className="grid cursor-pointer gap-1 text-center">
              <span
                className="relative aspect-square rounded-md border border-line-strong shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
                style={{ background: i === 0 ? `color-mix(in srgb, ${c} ${Math.round(g.emptyOpacity * 100)}%, #17171a)` : c }}
              >
                <input type="color" value={c} onChange={(e) => setLevel(i, e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`Level ${i} colour`} />
              </span>
              <span className="text-[10px] text-ink-400">{i === 0 ? 'None' : `L${i}`}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Density</span>
        <Segmented
          label="Graph density"
          value={DENSITY.find((d) => d.values.cellSize === g.cellSize && d.values.gap === g.gap && d.values.showMonths === g.showMonths)?.id ?? ''}
          options={DENSITY.map((d) => ({ value: d.id, label: d.label }))}
          onChange={(id) => set(DENSITY.find((d) => d.id === id)!.values)}
        />
      </div>

      <Slider label="Cell size" value={g.cellSize} min={6} max={28} step={0.5} onChange={(v) => set({ cellSize: v }, 'cellSize')} format={px} resetTo={14} hint="In pixels at 1080p; scales with the export resolution." />
      <Slider label="Spacing" value={g.gap} min={0} max={12} step={0.5} onChange={(v) => set({ gap: v }, 'gap')} format={px} resetTo={4} />
      <div className="grid gap-2">
        <span className="text-xs text-ink-300">Cell shape</span>
        <Segmented
          label="Cell shape"
          value={g.shape}
          options={[
            { value: 'square', label: <><Square /> Square</> },
            { value: 'rounded', label: <><SquareRoundCorner /> Rounded</> },
            { value: 'circle', label: <><Circle /> Dots</> },
          ]}
          onChange={(v) => set({ shape: v })}
        />
      </div>
      {g.shape === 'rounded' && <Slider label="Corner radius" value={g.radius} min={0} max={0.5} onChange={(v) => set({ radius: v }, 'radius')} format={(v) => pct(v * 2)} resetTo={0.3} />}
      <Slider label="Graph opacity" value={g.opacity} min={0} max={1} onChange={(v) => set({ opacity: v }, 'opacity')} format={pct} resetTo={1} />
      <Slider label="Glow" value={g.glow} min={0} max={1} onChange={(v) => set({ glow: v }, 'glow')} format={pct} />

      <Advanced title="Cell details">
        <Slider label="Cell opacity" value={g.cellOpacity} min={0} max={1} onChange={(v) => set({ cellOpacity: v }, 'cellOpacity')} format={pct} hint="Opacity of individual cells, independent of the whole graph layer." />
        <Slider label="Empty cell opacity" value={g.emptyOpacity} min={0} max={0.6} onChange={(v) => set({ emptyOpacity: v }, 'emptyOpacity')} format={pct} hint="Days without contributions stay visible but quiet." />
        <Slider label="Shadow" value={g.shadow} min={0} max={1} onChange={(v) => set({ shadow: v }, 'shadow')} format={pct} />
        <Slider label="Blur" value={g.blur} min={0} max={8} step={0.1} onChange={(v) => set({ blur: v }, 'blur')} format={px} resetTo={0} />
        <Slider label="Outline width" value={g.borderWidth} min={0} max={3} step={0.1} onChange={(v) => set({ borderWidth: v }, 'borderWidth')} format={px} resetTo={0} />
        {g.borderWidth > 0 && (
          <>
            <ColorField label="Outline colour" value={g.borderColor} onChange={(hex) => set({ borderColor: hex }, 'borderColor')} />
            <Slider label="Outline opacity" value={g.borderOpacity} min={0} max={1} onChange={(v) => set({ borderOpacity: v }, 'borderOpacity')} format={pct} />
          </>
        )}
        <Select<LevelMapping>
          label="Intensity mapping"
          value={g.mapping}
          options={[
            { value: 'quantile', label: 'Quartiles of active days (GitHub-like)' },
            { value: 'linear', label: 'Linear to the busiest day' },
            { value: 'source', label: 'Levels from the data source' },
          ]}
          onChange={(v) => set({ mapping: v })}
        />
      </Advanced>

      <Advanced title="Labels">
        <Switch label="Month labels" checked={g.showMonths} onChange={(v) => set({ showMonths: v })} />
        <Switch label="Weekday labels" checked={g.showWeekdays} onChange={(v) => set({ showWeekdays: v })} />
        <ColorField label="Label colour" value={g.labelColor} onChange={(hex) => set({ labelColor: hex }, 'labelColor')} />
        <Slider label="Label opacity" value={g.labelOpacity} min={0} max={1} onChange={(v) => set({ labelOpacity: v }, 'labelOpacity')} format={pct} />
      </Advanced>

      <ContainerControls />
    </>
  )
}

function ContainerControls() {
  const c = useEditor((s) => s.config.container)
  const patch = useEditor((s) => s.patch)
  const setStyle = useEditor((s) => s.setContainerStyle)
  const set = (values: Partial<typeof c>, key?: string) => patch('container', values, key ? { coalesce: `container.${key}` } : undefined)
  const styles = Object.entries(CONTAINER_STYLES) as [ContainerStyle, (typeof CONTAINER_STYLES)[ContainerStyle]][]
  const has = c.style !== 'none'

  return (
    <div className="grid gap-3">
      <SubHeading>Container</SubHeading>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Container style">
        {styles.map(([id, s]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={c.style === id}
            onClick={() => setStyle(id)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors',
              c.style === id ? 'border-white/50 bg-white/[0.05] text-ink-50' : 'border-line text-ink-300 hover:border-line-strong hover:text-ink-100',
            )}
          >
            <ContainerIcon style={id} />
            {s.label}
          </button>
        ))}
      </div>
      {has && (
        <>
          {(c.style === 'custom' || c.style === 'dark' || c.style === 'light' || c.style === 'frosted') && (
            <ColorField label="Fill colour" value={c.color} onChange={(hex) => set({ color: hex }, 'color')} />
          )}
          <Slider label="Fill opacity" value={c.opacity} min={0} max={1} onChange={(v) => set({ opacity: v }, 'opacity')} format={pct} hint="Container transparency — independent from the graph's own opacity." />
          <Slider label="Backdrop blur" value={c.blur} min={0} max={80} step={1} onChange={(v) => set({ blur: v }, 'blur')} format={px} hint="Blurs the actual wallpaper behind the card, like frosted glass." />
          <Slider label="Corner radius" value={c.radius} min={0} max={80} step={1} onChange={(v) => set({ radius: v }, 'radius')} format={px} />
          <Slider label="Padding" value={c.padding} min={0} max={120} step={1} onChange={(v) => set({ padding: v }, 'padding')} format={px} />
          <Advanced title="Border & light">
            <Slider label="Border width" value={c.borderWidth} min={0} max={6} step={0.25} onChange={(v) => set({ borderWidth: v }, 'borderWidth')} format={px} />
            <Slider label="Border opacity" value={c.borderOpacity} min={0} max={1} onChange={(v) => set({ borderOpacity: v }, 'borderOpacity')} format={pct} />
            <ColorField label="Border colour" value={c.borderColor} onChange={(hex) => set({ borderColor: hex }, 'borderColor')} />
            <Slider label="Shadow" value={c.shadow} min={0} max={1} onChange={(v) => set({ shadow: v }, 'shadow')} format={pct} />
            <Slider label="Highlight" value={c.highlight} min={0} max={1} onChange={(v) => set({ highlight: v }, 'highlight')} format={pct} hint="A soft sheen and specular top edge." />
          </Advanced>
        </>
      )}
    </div>
  )
}

function ContainerIcon({ style }: { style: ContainerStyle }) {
  const base = 'h-3.5 w-5 shrink-0 rounded-[4px]'
  const map: Record<ContainerStyle, string> = {
    none: 'border border-dashed border-white/25',
    frosted: 'bg-white/20 border border-white/40',
    dark: 'bg-black/70 border border-white/10',
    light: 'bg-white/85',
    bordered: 'border border-white/50',
    custom: 'bg-[conic-gradient(from_90deg,#8b7bff,#7fd8f5,#f2c27b,#8b7bff)]',
    transparent: 'border border-white/10',
  }
  return <span className={cn(base, map[style])} />
}
