// Writes sample renders to $GITHUE_RENDER_DIR for visual inspection (skipped otherwise).
import { describe, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { installNodeCanvas, nodeCanvas } from './setup-canvas'
import { createDefaultConfig } from '@/presets/defaults'
import { sampleContributions } from '@/features/contributions/sample'
import { renderWallpaper } from '@/features/composition/render-wallpaper'
import { applyPalettePreset, generateComposition } from '@/features/gradient-engine/generate'
import { PALETTE_PRESETS } from '@/presets/palettes'

const dir = process.env.GITHUE_RENDER_DIR

describe.skipIf(!dir)('visual renders', () => {
  it('renders presets and seeds', () => {
    installNodeCanvas()
    mkdirSync(dir!, { recursive: true })
    const data = sampleContributions()
    const save = (name: string, cfg: ReturnType<typeof createDefaultConfig>) => {
      const c = nodeCanvas(1600, 900)
      const t = performance.now()
      renderWallpaper(c, cfg, data)
      console.log(name, Math.round(performance.now() - t), 'ms')
      writeFileSync(`${dir}/${name}.png`, (c as unknown as { toBuffer: (m: string) => Buffer }).toBuffer('image/png'))
    }
    const base = createDefaultConfig()
    save('default', base)
    const only = process.env.GITHUE_ONLY
    for (const p of PALETTE_PRESETS) if (!only || only.includes('presets')) save(`preset-${p.id}`, applyPalettePreset(base, p))
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) if (!only || only.includes('seeds')) save(`seed-${seed}`, generateComposition(base, seed * 7919, 'all'))
  }, 120000)
})
