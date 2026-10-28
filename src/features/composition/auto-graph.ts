import type { Hex, WallpaperConfig } from '@/types/config'
import { estimateBackground, recommendGraphPalette } from '@/features/graph-renderer/palettes'
import { mixOklab } from '@/lib/color'

/** The colour the graph actually sits on: the background, or an opaque-enough container. */
export function graphSurface(config: WallpaperConfig): Hex {
  const bg = estimateBackground(config.gradient)
  const c = config.container
  const hasFill = c.style !== 'none' && c.style !== 'transparent' && c.style !== 'bordered'
  if (!hasFill || c.opacity <= 0.01) return bg
  return mixOklab(bg, c.color, Math.min(1, c.opacity * 1.1))
}

/**
 * Keeps an `auto` graph palette in sync with the background. With `updateLabels`
 * the label colour and empty-cell opacity follow the surface for any palette.
 */
export function applyAutoGraph(config: WallpaperConfig, updateLabels = false): WallpaperConfig {
  const isAuto = config.graph.paletteId === 'auto'
  if (!isAuto && !updateLabels) return config
  const rec = recommendGraphPalette(config.gradient, 'harmonious', graphSurface(config))
  const graph = { ...config.graph, labelColor: rec.labelColor, emptyOpacity: rec.emptyOpacity }
  if (isAuto) graph.levels = rec.levels
  else if (!rec.dark) graph.levels = [rec.levels[0], ...config.graph.levels.slice(1)] as typeof graph.levels
  const typography = updateLabels || isAuto ? { ...config.typography, color: rec.labelColor } : config.typography
  return { ...config, graph, typography }
}
