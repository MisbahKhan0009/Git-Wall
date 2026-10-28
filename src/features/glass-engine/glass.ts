/**
 * Fractal-glass effect — an original Canvas 2D implementation of reeded /
 * fluted glass. The background is sliced into flutes (or cells); each slice shows
 * a displaced, compressed and sometimes mirrored view of what lies behind it,
 * then receives edge highlights and shading. Because it only uses drawImage and
 * gradients it renders identically in the preview and in exports, everywhere.
 */
import type { GlassConfig, GlassStyle } from '@/types/config'
import { createCanvas, drawBlurred, get2d, roundRectPath, type Canvas, type Ctx } from '@/lib/canvas'
import { createRng, type Rng } from '@/lib/random'
import { clamp, deg2rad } from '@/lib/math'
import { rgba } from '@/lib/color'

export interface GlassStyleDefaults {
  label: string
  description: string
  values: Partial<GlassConfig>
}

export const GLASS_STYLES: Record<GlassStyle, GlassStyleDefaults> = {
  soft: {
    label: 'Soft glass',
    description: 'Wide, smooth flutes with gentle refraction',
    values: { density: 26, scale: 1, distortion: 0.45, softness: 0.8, blur: 0.25, highlight: 0.45, shadow: 0.35, angle: 0 },
  },
  shards: {
    label: 'Fractal shards',
    description: 'Recursive slices with mirrored fragments',
    values: { density: 18, scale: 1.4, distortion: 0.6, softness: 0.25, blur: 0.1, highlight: 0.55, shadow: 0.45, angle: 12 },
  },
  organic: {
    label: 'Organic glass',
    description: 'Flowing flutes that ripple vertically',
    values: { density: 24, scale: 1, distortion: 0.5, softness: 0.7, blur: 0.2, highlight: 0.4, shadow: 0.35, angle: 0 },
  },
  geometric: {
    label: 'Geometric glass',
    description: 'Rounded glass blocks acting as small lenses',
    values: { density: 9, scale: 1.5, distortion: 0.45, softness: 0.5, blur: 0.1, highlight: 0.5, shadow: 0.4, angle: 0 },
  },
  minimal: {
    label: 'Minimal glass',
    description: 'A few broad panes with crisp edges',
    values: { density: 6, scale: 1, distortion: 0.3, softness: 0.3, blur: 0.15, highlight: 0.35, shadow: 0.25, angle: 0 },
  },
}

interface Slice {
  x: number
  w: number
  shift: number // horizontal sampling offset, in px
  mirror: boolean
}

function fluteSlices(width: number, count: number, cfg: GlassConfig, rng: Rng): Slice[] {
  const fw = width / count
  return Array.from({ length: Math.ceil(count) }, (_, i) => ({
    x: i * fw,
    w: fw,
    shift: Math.sin(i * 0.9 + cfg.seed * 0.001) * fw * cfg.distortion * 1.4 + rng.range(-0.2, 0.2) * fw * cfg.distortion,
    mirror: false,
  }))
}

function shardSlices(width: number, count: number, cfg: GlassConfig, rng: Rng): Slice[] {
  const out: Slice[] = []
  const minW = width / (count * 2.2)
  const split = (x: number, w: number, depth: number) => {
    if (w < minW * 2 || depth > 7 || (depth > 2 && rng.next() < 0.18)) {
      out.push({ x, w, shift: rng.range(-1, 1) * w * cfg.distortion * 1.6, mirror: rng.next() < 0.5 })
      return
    }
    const r = rng.range(0.32, 0.68)
    split(x, w * r, depth + 1)
    split(x + w * r, w * (1 - r), depth + 1)
  }
  const top = Math.max(1, Math.round(count / 6))
  for (let i = 0; i < top; i++) split((i * width) / top, width / top, 0)
  return out
}

/** Maps region-space coordinates to the (possibly downscaled) source canvas. */
interface SampleMap {
  ox: number // region x → local x offset
  k: number // local → source scale divisor
  maxX: number // local width
  maxY: number // local height
}

/** Draws one refracted slice from `src` into the region layer. */
function drawSlice(ctx: Ctx, src: Canvas, map: SampleMap, s: Slice, y: number, h: number, mag: number, spread = 1) {
  // Each flute acts like a cylindrical lens: it shows a wider strip of the scene, compressed.
  const sw = (s.w * spread) / mag
  const lx = Math.max(0, Math.min(map.maxX - sw, s.x + map.ox + s.w / 2 - sw / 2 + s.shift))
  const k = map.k
  if (s.mirror) {
    ctx.save()
    ctx.translate(s.x * 2 + s.w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(src as CanvasImageSource, lx / k, y / k, sw / k, h / k, s.x, y, s.w, h)
    ctx.restore()
  } else {
    ctx.drawImage(src as CanvasImageSource, lx / k, y / k, sw / k, h / k, s.x, y, s.w, h)
  }
}

function shadeSlice(ctx: Ctx, x: number, y: number, w: number, h: number, cfg: GlassConfig, horizontal = true) {
  const soft = clamp(cfg.softness)
  const g = horizontal ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h)
  const hi = clamp(cfg.highlight)
  const sh = clamp(cfg.shadow)
  const edge = 0.02 + soft * 0.3
  g.addColorStop(0, `rgba(255,255,255,${(hi * 0.55).toFixed(3)})`)
  g.addColorStop(edge, `rgba(255,255,255,${(hi * 0.12).toFixed(3)})`)
  g.addColorStop(Math.min(0.55, edge + 0.25), 'rgba(255,255,255,0)')
  g.addColorStop(Math.max(0.6, 1 - edge - 0.2), 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${(sh * 0.5).toFixed(3)})`)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  if (soft < 0.5) {
    // crisp specular line on hard-edged glass
    ctx.fillStyle = `rgba(255,255,255,${(hi * 0.5 * (1 - soft * 2)).toFixed(3)})`
    if (horizontal) ctx.fillRect(x, y, Math.max(1, w * 0.012), h)
    else ctx.fillRect(x, y, w, Math.max(1, h * 0.012))
  }
}

function renderLayer(ctx: Ctx, src: Canvas, map: SampleMap, height: number, fullW: number, cfg: GlassConfig, layer: number, regionW: number) {
  const rng = createRng(cfg.seed + layer * 7919)
  const count = Math.max(2, cfg.density * (layer === 0 ? 1 : 1.618 * layer) * (regionW / fullW))
  const mag = Math.max(0.3, cfg.scale)
  const spread = cfg.style === 'shards' ? 1 : 1 + clamp(cfg.distortion) * 3
  const k = map.k

  if (cfg.style === 'geometric') {
    const cell = regionW / count
    const rows = Math.ceil(height / cell)
    const radius = cell * 0.5 * clamp(cfg.softness)
    const gap = Math.max(1, cell * 0.04)
    const yOff = (height - rows * cell) / 2
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < Math.ceil(count); c++) {
        const x = c * cell
        const y = yOff + r * cell
        ctx.save()
        roundRectPath(ctx, x + gap / 2, y + gap / 2, cell - gap, cell - gap, radius)
        ctx.clip()
        const shift = Math.sin(c * 2.1 + r * 1.3 + cfg.seed * 0.01) * cell * cfg.distortion * 0.8
        const sw = (cell * (1 + cfg.distortion)) / mag
        const lx = clamp(map.ox + x + cell / 2 - sw / 2 + shift, 0, map.maxX - sw)
        const ly = clamp(y + cell / 2 - sw / 2 - shift * 0.6, 0, map.maxY - sw)
        ctx.drawImage(src as CanvasImageSource, lx / k, ly / k, sw / k, sw / k, x, y, cell, cell)
        const g = ctx.createLinearGradient(x, y, x + cell, y + cell)
        g.addColorStop(0, `rgba(255,255,255,${(cfg.highlight * 0.45).toFixed(3)})`)
        g.addColorStop(0.45, 'rgba(255,255,255,0)')
        g.addColorStop(1, `rgba(0,0,0,${(cfg.shadow * 0.45).toFixed(3)})`)
        ctx.fillStyle = g
        ctx.fillRect(x, y, cell, cell)
        ctx.restore()
        ctx.strokeStyle = `rgba(255,255,255,${(cfg.highlight * 0.3).toFixed(3)})`
        ctx.lineWidth = Math.max(1, cell * 0.012)
        roundRectPath(ctx, x + gap / 2, y + gap / 2, cell - gap, cell - gap, radius)
        ctx.stroke()
      }
    }
    return
  }

  const slices = cfg.style === 'shards' ? shardSlices(regionW, count, cfg, rng) : fluteSlices(regionW, count, cfg, rng)
  if (cfg.style === 'organic') {
    const rows = 90
    const rh = height / rows
    for (const s of slices) {
      for (let r = 0; r < rows; r++) {
        const y = r * rh
        const wave = Math.sin((y / height) * Math.PI * 3 + (s.x / regionW) * 6 + cfg.seed * 0.01) * s.w * cfg.distortion * 1.2
        drawSlice(ctx, src, map, { ...s, shift: s.shift + wave }, y, rh + 0.6, mag, spread)
      }
      shadeSlice(ctx, s.x, 0, s.w, height, cfg)
    }
  } else {
    for (const s of slices) {
      drawSlice(ctx, src, map, s, 0, height, mag, spread)
      shadeSlice(ctx, s.x, 0, s.w, height, cfg)
    }
  }
}

/**
 * Renders the glass effect over `target`, using `background` as the scene behind the glass.
 * Work happens in a local frame rotated about the canvas centre; only the glass
 * region itself is rasterised, and blur is computed on a downscaled copy.
 */
export function applyGlass(target: Ctx, background: Canvas, cfg: GlassConfig, width: number, height: number) {
  if (!cfg.enabled || cfg.intensity <= 0) return
  const angle = deg2rad(clamp(cfg.angle, -45, 45))
  const rotated = Math.abs(angle) > 1e-4
  const Lw = rotated ? Math.ceil(Math.hypot(width, height)) : width
  const Lh = rotated ? Lw : height

  // 1. the scene in the local frame
  let local: Canvas = background
  if (rotated) {
    local = createCanvas(Lw, Lh)
    const lctx = get2d(local)
    lctx.translate(Lw / 2, Lh / 2)
    lctx.rotate(-angle)
    lctx.translate(-width / 2, -height / 2)
    // stretched underlay so slices near the border never sample emptiness
    lctx.drawImage(background as CanvasImageSource, -width, -height, width * 3, height * 3)
    lctx.drawImage(background as CanvasImageSource, 0, 0)
  }

  // 2. optional blur, computed at reduced resolution (visually identical for soft blurs)
  const blurPx = clamp(cfg.blur) * (width / Math.max(4, cfg.density)) * 0.18
  let src: Canvas = local
  let k = 1
  if (blurPx >= 0.5) {
    k = Math.max(1, Math.min(6, blurPx / 2.5))
    const small = createCanvas(Lw / k, Lh / k)
    const sctx = get2d(small)
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(local as CanvasImageSource, 0, 0, small.width, small.height)
    src = createCanvas(small.width, small.height)
    drawBlurred(get2d(src), small, blurPx / k)
    k = Lw / small.width
  }

  // 3. glass region (local coordinates)
  const regionW = Math.max(16, Math.min(Lw, clamp(cfg.coverage, 0.05, 1) >= 0.999 ? Lw : clamp(cfg.coverage, 0.05, 1) * width))
  const gx = clamp(cfg.position.x) * width - width / 2
  const gy = clamp(cfg.position.y) * height - height / 2
  const lcx = Lw / 2 + gx * Math.cos(-angle) - gy * Math.sin(-angle)
  const rx0 = regionW >= Lw ? 0 : Math.round(lcx - regionW / 2)
  const map: SampleMap = { ox: rx0, k, maxX: Lw, maxY: Lh }

  const layer = createCanvas(Math.ceil(regionW), Lh)
  const gctx = get2d(layer)
  // Extra layers add depth to flutes; tiled styles would only overlap into clutter.
  const layers = cfg.style === 'geometric' ? 1 : Math.max(1, Math.min(3, Math.round(cfg.layers)))
  for (let i = 0; i < layers; i++) {
    gctx.globalAlpha = i === 0 ? 1 : 0.45 / i
    renderLayer(gctx, src, map, Lh, Lw, cfg, i, regionW)
  }
  gctx.globalAlpha = 1

  // material: frosting & tint (clipped to the drawn glass)
  gctx.globalCompositeOperation = 'source-atop'
  const frost = (1 - clamp(cfg.transparency)) * 0.4
  if (frost > 0) {
    gctx.fillStyle = `rgba(255,255,255,${frost.toFixed(3)})`
    gctx.fillRect(0, 0, layer.width, Lh)
  }
  if (cfg.tintAmount > 0) {
    gctx.fillStyle = rgba(cfg.tint, clamp(cfg.tintAmount) * 0.45)
    gctx.fillRect(0, 0, layer.width, Lh)
  }
  gctx.globalCompositeOperation = 'source-over'

  // pane edges for partial coverage
  if (regionW < Lw) {
    const line = Math.max(1, width * 0.0012)
    gctx.fillStyle = `rgba(255,255,255,${(cfg.highlight * 0.6).toFixed(3)})`
    gctx.fillRect(0, 0, line, Lh)
    gctx.fillStyle = `rgba(0,0,0,${(cfg.shadow * 0.4).toFixed(3)})`
    gctx.fillRect(layer.width - line, 0, line, Lh)
  }

  // 4. composite back in canvas space
  target.save()
  target.globalAlpha = clamp(cfg.intensity)
  target.globalCompositeOperation = cfg.blend === 'normal' ? 'source-over' : (cfg.blend as GlobalCompositeOperation)
  if (rotated) {
    target.translate(width / 2, height / 2)
    target.rotate(angle)
    target.translate(-Lw / 2, -Lh / 2)
  }
  target.drawImage(layer as CanvasImageSource, rx0, 0)
  target.restore()
}
