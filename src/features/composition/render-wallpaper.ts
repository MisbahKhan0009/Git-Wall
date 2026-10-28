/**
 * The wallpaper pipeline. One function renders the whole composition at any
 * size — the live preview simply calls it at screen resolution, exports call it
 * at full resolution — so nothing in an export can differ from what was enabled.
 *
 *   gradient → glass → grain → container (backdrop blur) → graph (shadow, glow) → text → [grain over graph]
 */
import type { WallpaperConfig } from '@/types/config'
import type { ContributionData } from '@/types/contributions'
import { buildCalendar, type Calendar } from '@/features/contributions/calendar'
import { renderGradientCanvas } from '@/features/gradient-engine/render'
import { applyGlass } from '@/features/glass-engine/glass'
import { applyGrain } from '@/features/grain-engine/grain'
import { boxBounds, compositeGraphLayer, drawContainer, drawGraphCells, drawText } from '@/features/graph-renderer/render'
import { computeLayout, type GraphLayout } from './layout'
import { createCanvas, get2d, referenceUnit, type Canvas } from '@/lib/canvas'

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)
/** Stage timings are recorded as performance measures (visible in devtools). */
function mark(stage: string, start: number) {
  const end = now()
  try {
    performance.measure?.(`githue:${stage}`, { start, end })
  } catch {
    // measure is optional
  }
  return end
}

export interface RenderCache {
  sceneKey?: string
  scene?: Canvas
  calendarKey?: string
  calendar?: Calendar
}

export function createRenderCache(): RenderCache {
  return {}
}

export function getCalendar(data: ContributionData, config: WallpaperConfig, cache?: RenderCache): Calendar {
  const key = `${data.source}|${data.username}|${data.fetchedAt}|${data.days.length}|${data.total}|${config.graph.mapping}`
  if (cache?.calendarKey === key && cache.calendar) return cache.calendar
  const calendar = buildCalendar(data.days, config.graph.mapping)
  if (cache) {
    cache.calendarKey = key
    cache.calendar = calendar
  }
  return calendar
}

/** Background + glass, cached on their inputs (the expensive part). */
export function getScene(config: WallpaperConfig, width: number, height: number, cache?: RenderCache): Canvas | null {
  if (config.gradient.transparent) return null
  const dither = !(config.grain.enabled && config.grain.opacity * config.grain.intensity >= 0.12)
  const key = JSON.stringify([width, height, dither, config.gradient, config.glass.enabled ? config.glass : null])
  if (cache?.sceneKey === key && cache.scene) return cache.scene
  const t0 = now()
  const bg = renderGradientCanvas(config.gradient, width, height, { dither })
  const t1 = mark('gradient', t0)
  let scene = bg
  if (config.glass.enabled) {
    scene = createCanvas(width, height)
    const sctx = get2d(scene)
    sctx.drawImage(bg as CanvasImageSource, 0, 0)
    applyGlass(sctx, bg, config.glass, width, height)
    mark('glass', t1)
  }
  if (cache) {
    cache.sceneKey = key
    cache.scene = scene
  }
  return scene
}

export interface RenderResult {
  layout: GraphLayout
  calendar: Calendar
}

export function renderWallpaper(
  canvas: Canvas,
  config: WallpaperConfig,
  data: ContributionData,
  cache?: RenderCache,
): RenderResult {
  const width = canvas.width
  const height = canvas.height
  const ctx = get2d(canvas)
  const unit = referenceUnit(width, height)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)

  let t = now()
  const scene = getScene(config, width, height, cache)
  if (scene) ctx.drawImage(scene as CanvasImageSource, 0, 0)
  t = mark('scene', t)
  if (scene && !config.grain.overGraph) applyGrain(ctx, config.grain, width, height, unit)
  t = mark('grain', t)

  const calendar = getCalendar(data, config, cache)
  const layout = computeLayout(config, calendar, data.username, width, height, (text, font) => {
    ctx.font = font
    return ctx.measureText(text).width
  })

  drawContainer(ctx, config, layout, scene, width, height)
  t = mark('container', t)

  // The graph is rasterised into a layer just large enough for its glow and shadow.
  const bounds = boxBounds(layout, layout.cell * 4 + config.graph.blur * layout.unit * layout.scale * 3, width, height)
  const layer = createCanvas(bounds.w, bounds.h)
  const lctx = get2d(layer)
  lctx.translate(-bounds.x, -bounds.y)
  drawGraphCells(lctx, config, calendar, layout)
  compositeGraphLayer(ctx, layer, bounds, config, layout)
  drawText(ctx, config, layout)
  t = mark('graph', t)

  if (config.grain.overGraph || !scene) applyGrain(ctx, config.grain, width, height, unit, !scene)
  ctx.restore()
  return { layout, calendar }
}
