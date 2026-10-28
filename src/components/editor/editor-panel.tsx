import { useState, type ReactNode } from 'react'
import { Blend, Download, Grid3x3, LayoutTemplate, Palette, Sparkles, User } from 'lucide-react'
import { Section } from '@/components/ui/section'
import { ProfileSection } from '@/components/controls/profile-section'
import { BackgroundSection } from '@/components/controls/background-section'
import { PaletteSection } from '@/components/controls/palette-section'
import { GraphSection } from '@/components/controls/graph-section'
import { EffectsSection } from '@/components/controls/effects-section'
import { CompositionSection } from '@/components/controls/composition-section'
import { ExportSection } from '@/components/controls/export-section'
import { cn } from '@/lib/cn'

interface SectionDef {
  id: string
  title: string
  short: string
  icon: ReactNode
  defaultOpen: boolean
  render: () => ReactNode
}

const SECTIONS: SectionDef[] = [
  { id: 'profile', title: 'Profile', short: 'Profile', icon: <User />, defaultOpen: true, render: () => <ProfileSection /> },
  { id: 'background', title: 'Background', short: 'Gradient', icon: <Blend />, defaultOpen: true, render: () => <BackgroundSection /> },
  { id: 'palette', title: 'Palette', short: 'Palette', icon: <Palette />, defaultOpen: false, render: () => <PaletteSection /> },
  { id: 'graph', title: 'Contribution graph', short: 'Graph', icon: <Grid3x3 />, defaultOpen: false, render: () => <GraphSection /> },
  { id: 'effects', title: 'Effects', short: 'Effects', icon: <Sparkles />, defaultOpen: false, render: () => <EffectsSection /> },
  { id: 'composition', title: 'Composition', short: 'Layout', icon: <LayoutTemplate />, defaultOpen: false, render: () => <CompositionSection /> },
  { id: 'export', title: 'Export', short: 'Export', icon: <Download />, defaultOpen: false, render: () => <ExportSection /> },
]

/** Desktop & tablet: a narrow scrollable column of collapsible sections. */
export function EditorPanel() {
  return (
    <aside aria-label="Editor" className="scroll-thin relative z-10 hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-ink-900 md:block lg:w-[340px]">
      {SECTIONS.map((s) => (
        <Section key={s.id} id={s.id} title={s.title} icon={s.icon} defaultOpen={s.defaultOpen}>
          {s.render()}
        </Section>
      ))}
      <p className="px-4 pt-2 pb-6 text-2xs leading-relaxed text-ink-500">
        Everything runs in your browser. Settings are stored on this device only.
      </p>
    </aside>
  )
}

/** Mobile: canvas first, with a tabbed bottom sheet. */
export function MobileEditor() {
  const [tab, setTab] = useState('background')
  const active = SECTIONS.find((s) => s.id === tab)!
  return (
    <div className="relative z-10 flex max-h-[52dvh] min-h-[38dvh] shrink-0 flex-col border-t border-line bg-ink-900 md:hidden">
      <nav aria-label="Editor sections" className="scroll-thin flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={tab === s.id}
            aria-controls={`mobile-panel-${s.id}`}
            onClick={() => setTab(s.id)}
            className={cn(
              'flex shrink-0 flex-col items-center gap-0.5 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors [&_svg]:size-4',
              tab === s.id ? 'bg-white/[0.08] text-ink-50' : 'text-ink-400',
            )}
          >
            {s.icon}
            {s.short}
          </button>
        ))}
      </nav>
      <div id={`mobile-panel-${active.id}`} role="tabpanel" className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Section key={active.id} id={`m-${active.id}`} title={active.title} icon={active.icon} forceOpen>
          {active.render()}
        </Section>
      </div>
    </div>
  )
}
