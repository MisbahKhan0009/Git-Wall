import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { defaultConfig, useEditor } from '@/store/editor'
import { WallpaperPreview } from '@/components/canvas/wallpaper-preview'
import { Wordmark } from '@/components/navigation/top-bar'
import { UsernameForm } from '@/components/controls/profile-section'
import { GradientThumb } from '@/components/presets/preset-thumb'
import { PALETTE_PRESETS } from '@/presets/palettes'
import { applyPalettePreset } from '@/features/gradient-engine/generate'
import { cn } from '@/lib/cn'

const FEATURED = ['midnight-iris', 'obsidian-aurora', 'peach-nebula', 'deep-ocean', 'solar-flare', 'lavender-haze']

/** Introductory state: the live wallpaper full-bleed, a headline and the username field. */
export function Landing() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const width = useEditor((s) => s.config.canvas.width)
  const height = useEditor((s) => s.config.canvas.height)
  const dismiss = useEditor((s) => s.dismissLanding)
  const applyPreset = useEditor((s) => s.applyPalettePreset)
  const currentBase = useEditor((s) => s.config.gradient.base)
  const featured = useMemo(() => {
    const base = defaultConfig()
    return FEATURED.map((id) => PALETTE_PRESETS.find((p) => p.id === id)!).map((p) => ({ preset: p, gradient: applyPalettePreset(base, p).gradient }))
  }, [])

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])

  // cover the viewport while keeping the wallpaper's real aspect ratio
  const scale = Math.max(size.w / width, size.h / height)
  const cw = Math.ceil(width * scale)
  const ch = Math.ceil(height * scale)

  return (
    <div ref={ref} className="fixed inset-0 z-30 overflow-hidden bg-ink-950">
      {size.w > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fade-in">
          <WallpaperPreview cssWidth={cw} cssHeight={ch} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(6,6,8,0.92)_0%,rgba(6,6,8,0.6)_32%,rgba(6,6,8,0)_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent" />

      <header className="absolute top-0 left-0 flex w-full items-center justify-between p-5 sm:p-7">
        <Wordmark />
        <button type="button" onClick={dismiss} className="rounded-full px-3 py-1.5 text-xs text-ink-200 transition-colors hover:bg-white/10 hover:text-white">
          Open studio
        </button>
      </header>

      <main className="absolute inset-x-0 bottom-0 flex flex-col gap-8 p-5 pb-7 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl animate-rise">
          <p className="mb-3 font-mono text-2xs tracking-[0.18em] text-white/55 uppercase">Generative wallpaper studio</p>
          <h1 className="text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-white">
            Your year of code,
            <br />
            rendered as light.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
            Enter a GitHub username. GitHue lays your contribution calendar over generative gradients, film grain and fractal glass — then exports it at up to 8K.
          </p>
          <div className="mt-6 max-w-md">
            <UsernameForm size="lg" autoFocus onSubmitted={dismiss} />
            <button type="button" onClick={dismiss} className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60 transition-colors hover:text-white">
              Explore with sample data <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 animate-rise">
          <span className="font-mono text-2xs tracking-[0.14em] text-white/45 uppercase">Try a style</span>
          <div className="flex gap-2">
            {featured.map(({ preset, gradient }) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                aria-label={`Preview ${preset.name}`}
                title={preset.name}
                className={cn(
                  'overflow-hidden rounded-lg border-2 transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
                  currentBase === gradient.base ? 'border-white/90' : 'border-white/15 hover:border-white/40',
                )}
              >
                <GradientThumb gradient={gradient} className="h-10 w-16 sm:h-12 sm:w-20" />
              </button>
            ))}
          </div>
          <span className="text-2xs text-white/40">No sign-in, no tokens. Public data only, processed in your browser.</span>
        </div>
      </main>
    </div>
  )
}
