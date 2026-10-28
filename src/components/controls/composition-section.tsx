import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, FoldVertical, RotateCcw } from 'lucide-react'
import type { CompositionConfig, TypographyConfig } from '@/types/config'
import { useEditor } from '@/store/editor'
import { COMPOSITION_PRESETS } from '@/features/composition/presets'
import { Slider, deg, pct, px, times } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { ColorField } from '@/components/ui/color-field'
import { Input } from '@/components/ui/input'
import { Advanced, SubHeading } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

function PresetMini({ id }: { id: string }) {
  const cls: Record<string, string> = {
    centered: 'inset-x-[22%] top-[40%] h-[20%]',
    minimal: 'inset-x-[30%] top-[44%] h-[12%]',
    editorial: 'left-[10%] w-[44%] bottom-[12%] h-[16%]',
    'floating-glass': 'inset-x-[20%] top-[37%] h-[26%] bg-white/25! border border-white/40',
    asymmetric: 'right-[9%] w-[38%] bottom-[14%] h-[18%] bg-black/50! border border-white/15',
    'full-width': 'inset-x-[7%] top-[38%] h-[24%]',
  }
  return (
    <span className="relative block aspect-video w-full overflow-hidden rounded-[5px] bg-gradient-to-br from-white/[0.08] to-white/[0.02]">
      <span className={cn('absolute rounded-[3px] bg-white/45', cls[id])} />
      {id === 'editorial' && <span className="absolute bottom-[32%] left-[10%] h-[5%] w-[20%] rounded-full bg-white/35" />}
    </span>
  )
}

export function CompositionSection() {
  const c = useEditor((s) => s.config.composition)
  const t = useEditor((s) => s.config.typography)
  const patch = useEditor((s) => s.patch)
  const applyPreset = useEditor((s) => s.applyCompositionPreset)
  const reset = useEditor((s) => s.resetComposition)
  const isSample = useEditor((s) => s.data.source === 'sample' || !s.data.username)
  const set = (values: Partial<CompositionConfig>, key?: string) => patch('composition', values, key ? { coalesce: `composition.${key}` } : undefined)
  const setT = (values: Partial<TypographyConfig>, key?: string) => patch('typography', values, key ? { coalesce: `typography.${key}` } : undefined)

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {COMPOSITION_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.description}
            onClick={() => applyPreset(p.id)}
            className="grid gap-1 rounded-md border border-line p-1 text-left transition-colors hover:border-line-strong"
          >
            <PresetMini id={p.id} />
            <span className="truncate px-0.5 text-[10.5px] font-medium text-ink-300">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <span className="text-xs text-ink-300">Horizontal</span>
          <Segmented
            label="Horizontal alignment"
            value={c.hAlign}
            options={[
              { value: 'left', label: <AlignLeft />, title: 'Left' },
              { value: 'center', label: <AlignCenter />, title: 'Center' },
              { value: 'right', label: <AlignRight />, title: 'Right' },
            ]}
            onChange={(v) => set({ hAlign: v, offset: { ...c.offset, x: 0 } })}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs text-ink-300">Vertical</span>
          <Segmented
            label="Vertical alignment"
            value={c.vAlign}
            options={[
              { value: 'top', label: <ArrowUpToLine />, title: 'Top' },
              { value: 'center', label: <FoldVertical />, title: 'Middle' },
              { value: 'bottom', label: <ArrowDownToLine />, title: 'Bottom' },
            ]}
            onChange={(v) => set({ vAlign: v, offset: { ...c.offset, y: 0 } })}
          />
        </div>
      </div>

      <Slider label="Scale" value={c.scale} min={0.3} max={2.5} step={0.01} onChange={(v) => set({ scale: v }, 'scale')} format={times} resetTo={1} hint="The graph never grows past the safe margins, whatever the aspect ratio." />
      <Slider label="Horizontal offset" value={c.offset.x} min={-0.4} max={0.4} step={0.005} onChange={(v) => set({ offset: { ...c.offset, x: v } }, 'offsetX')} format={pct} resetTo={0} />
      <Slider label="Vertical offset" value={c.offset.y} min={-0.4} max={0.4} step={0.005} onChange={(v) => set({ offset: { ...c.offset, y: v } }, 'offsetY')} format={pct} resetTo={0} />
      <Advanced>
        <Slider label="Rotation" value={c.rotation} min={-12} max={12} step={0.5} onChange={(v) => set({ rotation: v }, 'rotation')} format={deg} resetTo={0} />
        <Slider label="Safe margin" value={c.margin} min={0} max={0.2} step={0.005} onChange={(v) => set({ margin: v }, 'margin')} format={pct} resetTo={0.08} />
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={reset}>
          <RotateCcw /> Reset composition
        </Button>
      </Advanced>

      <div className="grid gap-3">
        <SubHeading>Text</SubHeading>
        <Switch label="Username" description={isSample ? 'Shown once a GitHub profile is loaded' : undefined} checked={t.showUsername} onChange={(v) => setT({ showUsername: v })} />
        <Switch label="Contribution summary" checked={t.showSummary} onChange={(v) => setT({ showSummary: v })} />
        <Switch label="Date range" checked={t.showDateRange} onChange={(v) => setT({ showDateRange: v })} />
        <Switch label="Divider" checked={t.showDivider} onChange={(v) => setT({ showDivider: v })} />
        <div className="grid gap-1.5">
          <label htmlFor="custom-title" className="text-xs text-ink-300">
            Title
          </label>
          <Input id="custom-title" value={t.title} maxLength={80} placeholder="Optional short text" onChange={(e) => setT({ title: e.target.value }, 'title')} />
        </div>
        <Advanced title="Typography">
          <Segmented
            label="Typeface"
            value={t.font}
            options={[
              { value: 'sans', label: 'Sans' },
              { value: 'mono', label: 'Mono' },
            ]}
            onChange={(v) => setT({ font: v })}
          />
          <Segmented
            label="Text placement"
            value={t.placement}
            options={[
              { value: 'above', label: 'Above graph' },
              { value: 'below', label: 'Below graph' },
            ]}
            onChange={(v) => setT({ placement: v })}
          />
          <Slider label="Size" value={t.size} min={10} max={48} step={0.5} onChange={(v) => setT({ size: v }, 'size')} format={px} resetTo={18} />
          <ColorField label="Colour" value={t.color} onChange={(hex) => setT({ color: hex }, 'color')} />
          <Slider label="Opacity" value={t.opacity} min={0} max={1} onChange={(v) => setT({ opacity: v }, 'opacity')} format={pct} />
        </Advanced>
      </div>
    </>
  )
}
