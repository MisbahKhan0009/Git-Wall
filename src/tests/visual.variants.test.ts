// Writes default-variant renders to $GITHUE_RENDER_DIR for visual inspection (skipped otherwise).
import { describe, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { installNodeCanvas, nodeCanvas } from './setup-canvas'
import { createDefaultConfig } from '@/presets/defaults'
import { sampleContributions } from '@/features/contributions/sample'
import { renderWallpaper } from '@/features/composition/render-wallpaper'
import { applyAutoGraph } from '@/features/composition/auto-graph'
import { CONTAINER_STYLES } from '@/features/composition/presets'

const dir = process.env.GITHUE_RENDER_DIR

describe.skipIf(!dir)('variant renders', () => {
  it('renders', () => {
    installNodeCanvas()
    mkdirSync(dir!, { recursive: true })
    const data = sampleContributions()
    const save = (name: string, cfg: ReturnType<typeof createDefaultConfig>) => {
      const c = nodeCanvas(1600, 900)
      renderWallpaper(c, cfg, data)
      writeFileSync(`${dir}/${name}.png`, (c as unknown as { toBuffer: (m: string) => Buffer }).toBuffer('image/png'))
    }
    for (const style of ['frosted', 'dark', 'none'] as const) {
      const c = createDefaultConfig()
      c.container = { ...c.container, ...CONTAINER_STYLES[style].values, style }
      c.graph.paletteId = 'auto'
      save(`var-${style}`, applyAutoGraph(c, true))
    }
  }, 60000)
})
