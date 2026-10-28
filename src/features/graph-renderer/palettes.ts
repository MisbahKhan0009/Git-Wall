import type { GradientConfig, GraphPaletteId, Hex } from '@/types/config'
import { hexToOklab, hexToOklch, oklabToHex, oklchToHex, contrastRatio } from '@/lib/color'
import { clamp } from '@/lib/math'

export type Levels = [Hex, Hex, Hex, Hex, Hex]

export interface GraphPalettePreset {
  id: Exclude<GraphPaletteId, 'auto' | 'custom'>
  name: string
  levels: Levels
}

/** Designed for dark and mid-tone backgrounds; level 0 is a neutral rendered at low opacity. */
export const GRAPH_PALETTES: GraphPalettePreset[] = [
  { id: 'classic', name: 'Classic green', levels: ['#e6edf3', '#0e4429', '#006d32', '#26a641', '#39d353'] },
  { id: 'monochrome', name: 'Monochrome', levels: ['#ffffff', '#4d4d52', '#85858b', '#bdbdc2', '#f7f7f5'] },
  { id: 'lavender', name: 'Soft lavender', levels: ['#ece6ff', '#463b6e', '#6c5cae', '#9d8cf0', '#d8cfff'] },
  { id: 'neon-cyan', name: 'Neon cyan', levels: ['#e0fbff', '#0a4a57', '#0b8aa0', '#19c9e0', '#86fbff'] },
  { id: 'sunset', name: 'Warm sunset', levels: ['#ffeadf', '#5c2a3c', '#a83f52', '#f06d4f', '#ffbd73'] },
  { id: 'coral', name: 'Pink & coral', levels: ['#ffe4ea', '#5b2342', '#a23c67', '#f2668a', '#ffaa9c'] },
  { id: 'arctic', name: 'Arctic blue', levels: ['#e6f3ff', '#1c3a5e', '#2e6aa6', '#5aa7ea', '#bde4ff'] },
  { id: 'amber', name: 'Amber', levels: ['#fff4d9', '#4d3410', '#8c5c13', '#dc9c1d', '#ffd36e'] },
  { id: 'emerald', name: 'Emerald', levels: ['#e3fff1', '#0f3d2e', '#13694b', '#1fae74', '#62f2ab'] },
]

export function getGraphPalette(id: GraphPaletteId): GraphPalettePreset | undefined {
  return GRAPH_PALETTES.find((p) => p.id === id)
}

/** Approximate average colour of the background, in OKLab, weighting the base for luminous styles. */
export function estimateBackground(g: Pick<GradientConfig, 'stops' | 'base' | 'type'>): Hex {
  const labs = g.stops.map((s) => hexToOklab(s.color))
  const base = hexToOklab(g.base)
  const luminous = g.type === 'aurora' || g.type === 'glow'
  const baseWeight = luminous ? 2.2 : 0
  const total = labs.length + baseWeight
  const sum = labs.reduce(
    (acc, l) => [acc[0] + l[0], acc[1] + l[1], acc[2] + l[2]] as [number, number, number],
    [base[0] * baseWeight, base[1] * baseWeight, base[2] * baseWeight] as [number, number, number],
  )
  return oklabToHex([sum[0] / total, sum[1] / total, sum[2] / total])
}

export interface GraphRecommendation {
  levels: Levels
  emptyOpacity: number
  labelColor: Hex
  dark: boolean
}

/**
 * Builds a graph palette that harmonises with the background while staying readable:
 * the accent hue comes from the most vivid stop, lightness steps are spaced
 * perceptually, and level 4 is pushed until it clears a contrast floor.
 */
export function recommendGraphPalette(
  g: Pick<GradientConfig, 'stops' | 'base' | 'type'>,
  mode: 'harmonious' | 'contrast' = 'harmonious',
  surface?: Hex,
): GraphRecommendation {
  const bg = surface ?? estimateBackground(g)
  const bgL = hexToOklch(bg).l
  const dark = bgL < 0.66
  const stops = g.stops.map((s) => hexToOklch(s.color))
  const vivid = [...stops].sort((a, b) => b.c * (0.4 + b.l) - a.c * (0.4 + a.l))[0] ?? { l: 0.7, c: 0.12, h: 250 }
  const maxChroma = Math.max(...stops.map((s) => s.c), 0)
  let hue = vivid.h
  if (mode === 'contrast') hue += 165
  const chroma = maxChroma < 0.035 ? 0.01 : clamp(vivid.c * 1.05, 0.08, 0.2)

  const ramp = dark ? [0.42, 0.6, 0.76, 0.92] : [0.8, 0.64, 0.48, 0.32]
  const cScale = dark ? [0.55, 0.8, 0.95, 0.75] : [0.45, 0.75, 0.95, 1]
  const levels = ramp.map((l, i) => oklchToHex({ l, c: chroma * cScale[i], h: hue + (dark ? i * 4 : -i * 4) })) as Hex[]

  // Push the top level until it stands clear of the background.
  let top = levels[3]
  for (let i = 0; i < 6 && contrastRatio(top, bg) < 3.2; i++) {
    const c = hexToOklch(top)
    top = oklchToHex({ ...c, l: clamp(c.l + (dark ? 0.04 : -0.05)) })
  }
  levels[3] = top

  const empty = dark ? '#ffffff' : '#101014'
  return {
    levels: [empty, levels[0], levels[1], levels[2], levels[3]],
    emptyOpacity: dark ? 0.09 : 0.08,
    labelColor: dark ? '#f5f5f2' : '#141418',
    dark,
  }
}
