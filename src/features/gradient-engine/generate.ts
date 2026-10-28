/**
 * Seeded composition generator. The same seed, constraints and locked colours
 * always produce the same configuration.
 */
import type { ColorStop, GlassStyle, GradientType, Mood, WallpaperConfig } from '@/types/config'
import { createRng, uid } from '@/lib/random'
import { hexToOklch, hueDistance } from '@/lib/color'
import { chooseGradientType, generatePalette } from './palette'
import { generateFieldPoints, pickAngle, pickFocal } from './geometry'
import { GRAPH_PALETTES, recommendGraphPalette } from '@/features/graph-renderer/palettes'
import { GLASS_STYLES } from '@/features/glass-engine/glass'
import { PALETTE_PRESETS, type PalettePreset } from '@/presets/palettes'
import { applyAutoGraph, graphSurface } from '@/features/composition/auto-graph'

export type RandomizeScope = 'all' | 'colors' | 'geometry' | 'graph' | 'effects'

// Salts keep each sub-system's random stream independent of the others.
const SALT = { palette: 11, type: 23, geometry: 37, graph: 41, grain: 53, glass: 67 }

/** The most vivid colour of the gradient — the hue the graph should relate to. */
function estimateBackgroundAccent(config: WallpaperConfig): string {
  const stops = config.gradient.stops
  return [...stops].sort((a, b) => hexToOklch(b.color).c - hexToOklch(a.color).c)[0]?.color ?? config.gradient.base
}

function inferMood(stops: ColorStop[]): Mood {
  const lch = stops.map((s) => hexToOklch(s.color))
  const L = lch.reduce((s, c) => s + c.l, 0) / lch.length
  const C = lch.reduce((s, c) => s + c.c, 0) / lch.length
  if (L > 0.75) return 'pastel'
  if (C > 0.18) return 'neon'
  if (L < 0.45) return 'deep'
  return 'balanced'
}

export function regenerateGeometry(config: WallpaperConfig, seed: number, type: GradientType = config.gradient.type): WallpaperConfig['gradient'] {
  const rng = createRng(seed).fork(SALT.geometry)
  return {
    ...config.gradient,
    type,
    angle: pickAngle(rng),
    focal: pickFocal(rng),
    points: generateFieldPoints(type, config.gradient.stops.length, rng),
    warp: Math.round(rng.range(0.25, 0.65) * 100) / 100,
  }
}

export function randomizeGraphPalette(config: WallpaperConfig, seed: number): WallpaperConfig['graph'] {
  const rng = createRng(seed).fork(SALT.graph)
  const choice = rng.weighted<'auto' | 'contrast' | 'preset'>([
    ['auto', 3],
    ['contrast', 1.5],
    ['preset', 2],
  ])
  if (choice === 'preset') {
    // Only presets whose accent sits near the background's hue (or its complement) or is neutral.
    const accent = hexToOklch(estimateBackgroundAccent(config)).h
    const fitting = GRAPH_PALETTES.filter((p) => {
      const top = hexToOklch(p.levels[4])
      if (top.c < 0.04) return true
      const d = hueDistance(top.h, accent)
      return d < 55 || d > 150
    })
    const p = rng.pick(fitting.length ? fitting : GRAPH_PALETTES)
    const rec = recommendGraphPalette(config.gradient, 'harmonious', graphSurface(config))
    return { ...config.graph, paletteId: p.id, levels: [rec.dark ? p.levels[0] : rec.levels[0], ...p.levels.slice(1)] as WallpaperConfig['graph']['levels'], emptyOpacity: rec.emptyOpacity, labelColor: rec.labelColor }
  }
  const rec = recommendGraphPalette(config.gradient, choice === 'contrast' ? 'contrast' : 'harmonious')
  return {
    ...config.graph,
    paletteId: choice === 'auto' ? 'auto' : 'custom',
    levels: rec.levels,
    emptyOpacity: rec.emptyOpacity,
    labelColor: rec.labelColor,
  }
}

export function randomizeEffects(config: WallpaperConfig, seed: number): Pick<WallpaperConfig, 'grain' | 'glass'> {
  const grng = createRng(seed).fork(SALT.grain)
  const lrng = createRng(seed).fork(SALT.glass)
  const style = lrng.weighted<GlassStyle>([
    ['soft', 3],
    ['organic', 2],
    ['shards', 1.5],
    ['geometric', 1],
    ['minimal', 2],
  ])
  const full = style !== 'geometric' && style !== 'shards' && lrng.next() < 0.45
  return {
    grain: {
      ...config.grain,
      seed: grng.int(1, 1e9),
      intensity: Math.round(grng.range(0.25, 0.6) * 100) / 100,
      scale: Math.round(grng.range(0.9, 1.6) * 10) / 10,
      contrast: Math.round(grng.range(0.3, 0.6) * 100) / 100,
    },
    glass: {
      ...config.glass,
      ...GLASS_STYLES[style].values,
      style,
      seed: lrng.int(1, 1e9),
      coverage: full ? 1 : Math.round(lrng.range(0.32, 0.6) * 100) / 100,
      position: full ? { x: 0.5, y: 0.5 } : { x: lrng.pick([0.25, 0.72, 0.78, 0.3]), y: 0.5 },
      intensity: Math.round(lrng.range(0.65, 0.95) * 100) / 100,
      layers: style === 'soft' || style === 'organic' ? lrng.weighted([[1, 4], [2, 1.5]]) : 1,
    },
  }
}

/** Produces a new composition from `seed`, honouring constraints and locked colours. */
export function generateComposition(config: WallpaperConfig, seed: number, scope: RandomizeScope = 'all'): WallpaperConfig {
  const base = createRng(seed)
  let next: WallpaperConfig = { ...config }

  if (scope === 'all' || scope === 'colors') {
    const palette = generatePalette({
      rng: base.fork(SALT.palette),
      constraints: config.constraints,
      current: config.gradient.stops,
      keepStructure: scope === 'colors',
    })
    let type = config.gradient.type
    if (scope === 'all' && config.gradient.autoType) type = chooseGradientType(palette.mood, base.fork(SALT.type))
    next.gradient = { ...config.gradient, stops: palette.stops, base: palette.base, type }
    if (scope === 'all') {
      next.gradient = regenerateGeometry(next, seed, type)
      next.gradient.intensity = 0.75
      next.gradient.smoothness = Math.round(createRng(seed).fork(SALT.type).range(0.55, 0.9) * 100) / 100
    }
  }

  if (scope === 'geometry') {
    let type = config.gradient.type
    if (config.gradient.autoType) type = chooseGradientType(inferMood(config.gradient.stops), base.fork(SALT.type))
    next.gradient = regenerateGeometry(next, seed, type)
  }

  if (scope === 'graph' || scope === 'all') next.graph = randomizeGraphPalette(next, seed)
  if (scope === 'effects' || scope === 'all') next = { ...next, ...randomizeEffects(next, seed) }

  next = applyAutoGraph(next, scope === 'all')
  return { ...next, seed: scope === 'all' ? seed : next.seed }
}

/** Applies a curated palette preset (colours + geometry) without touching layout or effects. */
export function applyPalettePreset(config: WallpaperConfig, preset: PalettePreset): WallpaperConfig {
  const n = preset.colors.length
  const stops: ColorStop[] = preset.colors.map((color, i) => ({ id: uid('stop'), color, position: n === 1 ? 0 : i / (n - 1), locked: false }))
  const rng = createRng(preset.seed).fork(SALT.geometry)
  const gradient = {
    ...config.gradient,
    autoType: false,
    type: preset.type,
    stops,
    base: preset.base,
    angle: preset.angle,
    focal: { ...preset.focal },
    points: generateFieldPoints(preset.type, n, rng),
    warp: preset.warp,
    intensity: preset.intensity,
    smoothness: preset.smoothness,
  }
  let next: WallpaperConfig = { ...config, gradient }
  const graphPreset = GRAPH_PALETTES.find((p) => p.id === preset.graph)
  if (graphPreset) next.graph = { ...next.graph, paletteId: graphPreset.id, levels: [...graphPreset.levels] }
  else next.graph = { ...next.graph, paletteId: 'auto' }
  next = applyAutoGraph(next, true)
  return next
}

export function findPreset(id: string): PalettePreset | undefined {
  return PALETTE_PRESETS.find((p) => p.id === id)
}

