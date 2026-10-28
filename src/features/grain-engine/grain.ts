/**
 * Seeded film grain. A small noise tile is generated once per (seed, character)
 * and tiled at the requested scale, so moving the opacity or scale sliders never
 * regenerates noise.
 */
import type { GrainConfig } from '@/types/config'
import { createCanvas, drawBlurred, get2d, type Canvas, type Ctx } from '@/lib/canvas'
import { createRng } from '@/lib/random'
import { clamp } from '@/lib/math'

export const GRAIN_TILE = 512

export const GRAIN_PRESETS: Record<'subtle' | 'balanced' | 'heavy', Partial<GrainConfig>> = {
  subtle: { enabled: true, intensity: 0.32, opacity: 0.55, contrast: 0.35, scale: 1, coarse: false, film: false },
  balanced: { enabled: true, intensity: 0.5, opacity: 0.75, contrast: 0.5, scale: 1.2, coarse: false, film: true },
  heavy: { enabled: true, intensity: 0.8, opacity: 0.9, contrast: 0.7, scale: 1.8, coarse: true, film: true },
}

const tileCache = new Map<string, Canvas>()

function tileKey(cfg: GrainConfig) {
  return [cfg.seed, cfg.colored, cfg.coarse, cfg.contrast.toFixed(2), cfg.intensity.toFixed(2)].join('|')
}

/** Generates the grain tile: per-pixel signed noise stored as white/black with alpha. */
export function getGrainTile(cfg: GrainConfig): Canvas {
  const key = tileKey(cfg)
  const hit = tileCache.get(key)
  if (hit) return hit
  const size = GRAIN_TILE
  const rng = createRng(cfg.seed)
  const n = size * size
  let mono = new Float32Array(n)
  for (let i = 0; i < n; i++) mono[i] = rng.normal()

  if (cfg.coarse) {
    // clumped grain: blend in a softened copy of the noise
    const soft = new Float32Array(n)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) s += mono[((y + dy + size) % size) * size + ((x + dx + size) % size)]
        soft[y * size + x] = s / 3
      }
    }
    for (let i = 0; i < n; i++) soft[i] = soft[i] * 0.75 + mono[i] * 0.35
    mono = soft
  }

  const gamma = 1.6 - clamp(cfg.contrast) * 1.1 // < 1 pushes values to the extremes
  const amp = clamp(cfg.intensity)
  const canvas = createCanvas(size, size)
  const ctx = get2d(canvas)
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < n; i++) {
    const v = clamp(mono[i] / 1.4, -1, 1)
    const shaped = Math.sign(v) * Math.abs(v) ** gamma
    const a = Math.abs(shaped) * amp
    let r = shaped > 0 ? 255 : 0
    let g = r
    let b = r
    if (cfg.colored) {
      // subtle chroma: nudge channels independently around the mono value
      r = clamp(r + rng.normal() * 90, 0, 255)
      g = clamp(g + rng.normal() * 90, 0, 255)
      b = clamp(b + rng.normal() * 90, 0, 255)
    }
    const j = i * 4
    d[j] = r
    d[j + 1] = g
    d[j + 2] = b
    d[j + 3] = Math.round(a * 140)
  }
  ctx.putImageData(img, 0, 0)
  if (tileCache.size > 12) tileCache.delete(tileCache.keys().next().value!)
  tileCache.set(key, canvas)
  return canvas
}

/**
 * Applies grain to `ctx` covering width×height. `unit` is the reference unit
 * (1 at 1080p) so grain keeps the same apparent size at any export resolution.
 */
export function applyGrain(ctx: Ctx, cfg: GrainConfig, width: number, height: number, unit: number, onlyPainted = false) {
  if (!cfg.enabled || cfg.opacity <= 0 || cfg.intensity <= 0) return
  const tile = getGrainTile(cfg)
  const px = Math.max(0.35, cfg.scale * unit)
  ctx.save()
  // on transparent canvases grain only lands on what is already painted
  if (onlyPainted) ctx.globalCompositeOperation = 'source-atop'
  ctx.globalAlpha = clamp(cfg.opacity)
  ctx.imageSmoothingEnabled = cfg.coarse || px < 1
  const pattern = ctx.createPattern(tile as CanvasImageSource, 'repeat')
  if (pattern) {
    if (typeof DOMMatrix !== 'undefined' && pattern.setTransform) pattern.setTransform(new DOMMatrix().scale(px, px))
    else ctx.scale(px, px)
    ctx.fillStyle = pattern
    const scaledByCtx = !(typeof DOMMatrix !== 'undefined' && pattern.setTransform)
    ctx.fillRect(0, 0, scaledByCtx ? width / px : width, scaledByCtx ? height / px : height)
  }
  ctx.restore()

  if (cfg.film && !onlyPainted) applyFilmTexture(ctx, cfg, width, height, unit)
}

/** Film character: mid-tone grain emphasis, sparse dust and a soft vignette. */
function applyFilmTexture(ctx: Ctx, cfg: GrainConfig, width: number, height: number, unit: number) {
  const rng = createRng(cfg.seed ^ 0x5bd1e995)
  ctx.save()
  // second, larger and softer grain layer in overlay for organic clumping
  const tile = getGrainTile({ ...cfg, coarse: true, seed: cfg.seed + 7 })
  const soft = createCanvas(GRAIN_TILE, GRAIN_TILE)
  drawBlurred(get2d(soft), tile, 0.8)
  const pattern = ctx.createPattern(soft as CanvasImageSource, 'repeat')
  if (pattern) {
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = clamp(cfg.opacity * cfg.intensity * 0.8)
    const s = Math.max(1, cfg.scale * unit * 2.2)
    ctx.scale(s, s)
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width / s, height / s)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  // dust
  ctx.globalCompositeOperation = 'source-over'
  const specks = Math.round(((width * height) / 1e6) * 6 * cfg.intensity)
  for (let i = 0; i < specks; i++) {
    const light = rng.next() < 0.6
    ctx.fillStyle = light ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.25)'
    ctx.globalAlpha = clamp(cfg.opacity * rng.range(0.3, 1))
    const r = rng.range(0.4, 1.4) * unit
    ctx.beginPath()
    ctx.arc(rng.next() * width, rng.next() * height, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // vignette
  ctx.globalAlpha = 1
  const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.hypot(width, height) * 0.6)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, `rgba(0,0,0,${(0.28 * cfg.opacity).toFixed(3)})`)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}
