/**
 * Background renderer. Pure: (gradient config, size) → pixels.
 *
 * Linear and radial gradients use native canvas gradients with extra stops
 * interpolated in OKLab (no muddy sRGB midpoints). The organic styles (mesh,
 * aurora, glow, atmospheric, displaced) are evaluated as continuous colour
 * fields on a low-resolution grid and smoothly upscaled, then dithered.
 */
import type { ColorStop, GradientConfig } from '@/types/config'
import { createCanvas, get2d, type Canvas, type Ctx } from '@/lib/canvas'
import {
  hexToOklab,
  hexToOklch,
  hexToRgb,
  linearToSrgb,
  oklabToHex,
  oklabToLinearRgb,
  oklchToHex,
  srgbToLinear,
  type Lab,
} from '@/lib/color'
import { clamp, deg2rad, smoothstep } from '@/lib/math'
import { createRng, hashNumbers } from '@/lib/random'

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Applies the intensity control (chroma) to stops. 0.75 = as authored. */
export function applyIntensity(stops: ColorStop[], intensity: number): ColorStop[] {
  const factor = 0.35 + intensity * (0.65 / 0.75)
  if (Math.abs(factor - 1) < 0.001) return stops
  return stops.map((s) => {
    const c = hexToOklch(s.color)
    return { ...s, color: oklchToHex({ ...c, c: c.c * factor }) }
  })
}

export function sortedStops(stops: ColorStop[]): ColorStop[] {
  return [...stops].sort((a, b) => a.position - b.position)
}

/** Smoothness 1 = linear (softest), 0 = colours hold near their stops. */
export function easeTransition(t: number, smoothness: number): number {
  const hard = smoothstep(smoothstep(t))
  return hard + (t - hard) * clamp(smoothness)
}

interface LabStop {
  pos: number
  lab: Lab
}

function toLabStops(stops: ColorStop[]): LabStop[] {
  return sortedStops(stops).map((s) => ({ pos: clamp(s.position), lab: hexToOklab(s.color) }))
}

function sampleLabStops(stops: LabStop[], t: number, smoothness: number, out: Lab): Lab {
  if (t <= stops[0].pos) {
    out[0] = stops[0].lab[0]; out[1] = stops[0].lab[1]; out[2] = stops[0].lab[2]
    return out
  }
  const last = stops[stops.length - 1]
  if (t >= last.pos) {
    out[0] = last.lab[0]; out[1] = last.lab[1]; out[2] = last.lab[2]
    return out
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a.pos && t <= b.pos) {
      const span = b.pos - a.pos
      const local = span <= 1e-6 ? 0 : easeTransition((t - a.pos) / span, smoothness)
      out[0] = a.lab[0] + (b.lab[0] - a.lab[0]) * local
      out[1] = a.lab[1] + (b.lab[1] - a.lab[1]) * local
      out[2] = a.lab[2] + (b.lab[2] - a.lab[2]) * local
      return out
    }
  }
  return out
}

/** Expands stops into a dense list of OKLab-interpolated canvas colour stops. */
export function expandStops(stops: ColorStop[], smoothness: number, steps = 12): [number, string][] {
  const lab = toLabStops(stops)
  const out: [number, string][] = []
  const tmp: Lab = [0, 0, 0]
  const first = lab[0].pos
  const last = lab[lab.length - 1].pos
  out.push([0, oklabToHex(lab[0].lab)])
  for (let i = 0; i < lab.length - 1; i++) {
    for (let k = 0; k <= steps; k++) {
      const t = lab[i].pos + ((lab[i + 1].pos - lab[i].pos) * k) / steps
      out.push([clamp(t), oklabToHex(sampleLabStops(lab, t, smoothness, tmp))])
    }
  }
  out.push([1, oklabToHex(lab[lab.length - 1].lab)])
  if (first > 0) out.splice(1, 0, [first, oklabToHex(lab[0].lab)])
  if (last < 1) out.splice(out.length - 1, 0, [last, oklabToHex(lab[lab.length - 1].lab)])
  return out
}

/* -------------------------------------------------------------------------- */
/* Noise for warps                                                            */
/* -------------------------------------------------------------------------- */

function makeValueNoise(seed: number) {
  const perm = new Uint8Array(512)
  const rng = createRng(seed)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  const values = new Float32Array(256).map(() => rng.next())
  const v = (x: number, y: number) => values[perm[(x & 255) + perm[y & 255]]]
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = smoothstep(x - xi)
    const yf = smoothstep(y - yi)
    const a = v(xi, yi)
    const b = v(xi + 1, yi)
    const c = v(xi, yi + 1)
    const d = v(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x: number, y: number) => {
    let sum = 0
    let amp = 0.5
    let f = 1
    for (let o = 0; o < 4; o++) {
      sum += noise(x * f + o * 17.3, y * f - o * 9.1) * amp
      f *= 2.03
      amp *= 0.5
    }
    return sum / 0.9375
  }
}

/* -------------------------------------------------------------------------- */
/* Field gradients                                                            */
/* -------------------------------------------------------------------------- */

type FieldFn = (u: number, v: number, out: [number, number, number]) => void

/** Soft-knee tone mapping so additive light never clips harshly. */
function tone(v: number): number {
  if (v <= 0.62) return Math.max(0, v)
  return 0.62 + 0.38 * (1 - Math.exp(-(v - 0.62) / 0.38))
}

function buildField(cfg: GradientConfig, width: number, height: number): FieldFn {
  const stops = applyIntensity(cfg.stops, cfg.intensity)
  const labStops = toLabStops(stops)
  const stopLabs = stops.map((s) => hexToOklab(s.color))
  const stopLin = stops.map((s) => hexToRgb(s.color).map(srgbToLinear) as [number, number, number])
  const baseLab = hexToOklab(cfg.base)
  const baseLin = hexToRgb(cfg.base).map(srgbToLinear) as [number, number, number]
  const aspect = width / height
  const points = cfg.points.length ? cfg.points : [{ x: 0.5, y: 0.5, radius: 0.6, stop: 0, phase: 0 }]
  const noiseSeed = hashNumbers(...points.map((p) => p.phase * 1e6), stops.length)
  const fbm = makeValueNoise(noiseSeed)
  const warp = clamp(cfg.warp)
  const smooth = clamp(cfg.smoothness)
  const light = 0.3 + cfg.intensity * 0.7
  const angle = deg2rad(cfg.angle)
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  // projection range so t spans 0..1 across the canvas in the gradient direction
  const corners = [
    [0, 0],
    [aspect, 0],
    [0, 1],
    [aspect, 1],
  ].map(([x, y]) => x * dirX + y * dirY)
  const pMin = Math.min(...corners)
  const pMax = Math.max(...corners)
  const tmp: Lab = [0, 0, 0]

  const warpXY = (u: number, v: number): [number, number] => {
    if (warp <= 0) return [u, v]
    const n1 = fbm(u * 1.6 + 3.1, v * 1.6 - 1.7) - 0.5
    const n2 = fbm(u * 1.6 - 7.4, v * 1.6 + 5.2) - 0.5
    return [u + n1 * warp * 0.45, v + n2 * warp * 0.45]
  }

  switch (cfg.type) {
    case 'mesh': {
      const k = 4.2 - smooth * 2.8
      const bw = 0.06
      return (u, v, out) => {
        const [wu, wv] = warpXY(u, v)
        const X = wu * aspect
        let L = baseLab[0] * bw
        let A = baseLab[1] * bw
        let B = baseLab[2] * bw
        let wsum = bw
        for (const p of points) {
          const dx = X - p.x * aspect
          const dy = wv - p.y
          const r = p.radius * (aspect > 1 ? Math.sqrt(aspect) : 1)
          const w = Math.exp(-((dx * dx + dy * dy) / (r * r)) * k)
          const c = stopLabs[p.stop % stopLabs.length]
          L += c[0] * w
          A += c[1] * w
          B += c[2] * w
          wsum += w
        }
        const lin = oklabToLinearRgb(L / wsum, A / wsum, B / wsum)
        out[0] = lin[0]; out[1] = lin[1]; out[2] = lin[2]
      }
    }
    case 'glow': {
      const k = 2.6 - smooth * 1.6
      return (u, v, out) => {
        const [wu, wv] = warpXY(u, v)
        const X = wu * aspect
        // gentle vertical falloff in the base
        const vertical = 0.85 + 0.3 * v
        let r = baseLin[0] * vertical
        let g = baseLin[1] * vertical
        let b = baseLin[2] * vertical
        for (const p of points) {
          const dx = X - p.x * aspect
          const dy = wv - p.y
          const rad = p.radius * (aspect > 1 ? Math.sqrt(aspect) : 1)
          const w = Math.exp(-((dx * dx + dy * dy) / (rad * rad)) * k) * light * 0.9
          const c = stopLin[p.stop % stopLin.length]
          r += c[0] * w
          g += c[1] * w
          b += c[2] * w
        }
        out[0] = tone(r); out[1] = tone(g); out[2] = tone(b)
      }
    }
    case 'aurora': {
      const softness = 0.7 + smooth * 0.9
      // Colours drift along each curtain through the whole palette (by position).
      const sorted = sortedStops(stops)
      const ribbonLin = sorted.map((st) => hexToRgb(st.color).map(srgbToLinear) as [number, number, number])
      const ribbonPos = sorted.map((st) => st.position)
      const horizon = ribbonLin[0]
      const palette = (t: number, out: [number, number, number]) => {
        const x = t - Math.floor(t)
        // ping-pong so the palette wraps without a seam
        const tt = x < 0.5 ? x * 2 : 2 - x * 2
        let i = 0
        while (i < ribbonPos.length - 2 && tt > ribbonPos[i + 1]) i++
        const a = ribbonPos[i]
        const b = ribbonPos[Math.min(i + 1, ribbonPos.length - 1)]
        const f = b > a ? clamp((tt - a) / (b - a)) : 0
        const c1 = ribbonLin[i]
        const c2 = ribbonLin[Math.min(i + 1, ribbonLin.length - 1)]
        out[0] = c1[0] + (c2[0] - c1[0]) * f
        out[1] = c1[1] + (c2[1] - c1[1]) * f
        out[2] = c1[2] + (c2[2] - c1[2]) * f
      }
      const col: [number, number, number] = [0, 0, 0]
      return (u, v, out) => {
        const [wu, wv] = warpXY(u * 0.6 + 0.2, v)
        const X = (wu - 0.2) / 0.6 * aspect
        const sky = 0.55 + 0.9 * v * v
        // faint horizon glow from the first stop
        const hz = Math.exp(-(((1 - v) / 0.32) ** 2)) * 0.22 * light
        let r = baseLin[0] * sky + horizon[0] * hz
        let g = baseLin[1] * sky + horizon[1] * hz
        let b = baseLin[2] * sky + horizon[2] * hz
        for (const p of points) {
          const phase = p.phase * Math.PI * 2
          const center =
            p.y +
            0.09 * Math.sin(X * p.x + phase) +
            0.035 * Math.sin(X * p.x * 2.7 + phase * 3.1) +
            0.02 * Math.sin(X * 9 + phase * 5)
          const dy = wv - center
          const thick = p.radius * softness
          const profile = dy < 0 ? Math.exp(-((dy / (thick * 2.4)) ** 2)) : Math.exp(-((dy / (thick * 0.45)) ** 2))
          const rays = Math.sin(X * 31 + phase * 7 + Math.sin(X * 4.3 + phase) * 3)
          const curtains = 0.62 + 0.38 * rays * Math.abs(rays)
          const fade = 0.3 + 0.7 * Math.sin(X * 0.85 + phase * 2.4) ** 2
          const w = profile * curtains * fade * light
          const height = clamp(-dy / (thick * 2.4))
          palette(p.stop / Math.max(1, stops.length) * 0.5 + (X / aspect) * 0.55 + p.phase * 0.3 + height * 0.35 + 0.25, col)
          r += col[0] * w
          g += col[1] * w
          b += col[2] * w
        }
        out[0] = tone(r); out[1] = tone(g); out[2] = tone(b)
      }
    }
    case 'atmospheric': {
      return (u, v, out) => {
        const X = u * aspect
        const n = warp > 0 ? (fbm(u * 1.2 + 4.2, v * 3.2) - 0.5) * warp * 0.18 : 0
        const swell = 0.05 * warp * Math.sin(X * 2.1 + points[0].phase * 6.28)
        let t = (X * dirX + v * dirY - pMin) / (pMax - pMin)
        t = clamp(t + n + swell)
        sampleLabStops(labStops, t, smooth, tmp)
        const lin = oklabToLinearRgb(tmp[0], tmp[1], tmp[2])
        // horizon haze around the focal point
        const fx = cfg.focal.x * aspect
        const fy = cfg.focal.y
        const d = ((X - fx) / (aspect * 0.9)) ** 2 + ((v - fy) / 0.22) ** 2
        const haze = Math.exp(-d * 2.2) * 0.35 * light
        const h = stopLin[stopLin.length - 1]
        out[0] = tone(lin[0] + h[0] * haze)
        out[1] = tone(lin[1] + h[1] * haze)
        out[2] = tone(lin[2] + h[2] * haze)
      }
    }
    case 'displaced':
    default: {
      return (u, v, out) => {
        const X = u * aspect
        const n = fbm(u * 2.2, v * 2.2) - 0.5
        const n2 = fbm(u * 5.1 + 11, v * 5.1 - 3) - 0.5
        let t = (X * dirX + v * dirY - pMin) / (pMax - pMin)
        t = clamp(t + n * (0.15 + warp * 0.55) + n2 * warp * 0.08)
        sampleLabStops(labStops, t, smooth, tmp)
        const lin = oklabToLinearRgb(tmp[0], tmp[1], tmp[2])
        out[0] = lin[0]; out[1] = lin[1]; out[2] = lin[2]
      }
    }
  }
}

const LUT_SIZE = 4096
const linearToSrgbLut = new Uint8ClampedArray(LUT_SIZE + 1)
for (let i = 0; i <= LUT_SIZE; i++) linearToSrgbLut[i] = Math.round(linearToSrgb(i / LUT_SIZE))
const toSrgb8 = (v: number) => linearToSrgbLut[v <= 0 ? 0 : v >= 1 ? LUT_SIZE : Math.round(v * LUT_SIZE)]

function renderField(ctx: Ctx, cfg: GradientConfig, width: number, height: number) {
  const long = Math.max(width, height)
  const gridLong = clamp(Math.round(long / 6), 64, 400)
  const gw = Math.max(2, Math.round((width / long) * gridLong))
  const gh = Math.max(2, Math.round((height / long) * gridLong))
  const field = buildField(cfg, width, height)
  const grid = createCanvas(gw, gh)
  const gctx = get2d(grid)
  const img = gctx.createImageData(gw, gh)
  const out: [number, number, number] = [0, 0, 0]
  let i = 0
  for (let y = 0; y < gh; y++) {
    const v = (y + 0.5) / gh
    for (let x = 0; x < gw; x++) {
      field((x + 0.5) / gw, v, out)
      img.data[i++] = toSrgb8(out[0])
      img.data[i++] = toSrgb8(out[1])
      img.data[i++] = toSrgb8(out[2])
      img.data[i++] = 255
    }
  }
  gctx.putImageData(img, 0, 0)
  // Upscale in two passes for a smoother (near-bicubic) result.
  const midW = Math.min(width, gw * 4)
  const midH = Math.min(height, gh * 4)
  const mid = createCanvas(midW, midH)
  const mctx = get2d(mid)
  mctx.imageSmoothingEnabled = true
  mctx.imageSmoothingQuality = 'high'
  mctx.drawImage(grid as CanvasImageSource, 0, 0, midW, midH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mid as CanvasImageSource, 0, 0, width, height)
}

function renderLinear(ctx: Ctx, cfg: GradientConfig, width: number, height: number) {
  const stops = applyIntensity(cfg.stops, cfg.intensity)
  const a = deg2rad(cfg.angle)
  const cx = width / 2
  const cy = height / 2
  const half = (Math.abs(width * Math.cos(a)) + Math.abs(height * Math.sin(a))) / 2
  const g = ctx.createLinearGradient(cx - Math.cos(a) * half, cy - Math.sin(a) * half, cx + Math.cos(a) * half, cy + Math.sin(a) * half)
  for (const [pos, color] of expandStops(stops, cfg.smoothness)) g.addColorStop(pos, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

function renderRadial(ctx: Ctx, cfg: GradientConfig, width: number, height: number) {
  const stops = applyIntensity(cfg.stops, cfg.intensity)
  const fx = cfg.focal.x * width
  const fy = cfg.focal.y * height
  const r = Math.max(
    Math.hypot(fx, fy),
    Math.hypot(width - fx, fy),
    Math.hypot(fx, height - fy),
    Math.hypot(width - fx, height - fy),
  )
  const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r)
  for (const [pos, color] of expandStops(stops, cfg.smoothness)) g.addColorStop(pos, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

/** Breaks up 8-bit banding with ±1 LSB triangular noise (deterministic). */
function dither(ctx: Ctx, width: number, height: number, seed: number) {
  const img = ctx.getImageData(0, 0, width, height)
  const d = img.data
  let s = seed >>> 0 || 1
  for (let i = 0; i < d.length; i += 4) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    const n1 = (s & 255) / 255
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    const n2 = (s & 255) / 255
    const n = n1 - n2 // triangular, -1..1
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

export function renderGradient(ctx: Ctx, cfg: GradientConfig, width: number, height: number, opts: { dither?: boolean } = {}) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  if (cfg.type === 'linear') renderLinear(ctx, cfg, width, height)
  else if (cfg.type === 'radial') renderRadial(ctx, cfg, width, height)
  else renderField(ctx, cfg, width, height)
  ctx.restore()
  if (opts.dither !== false) dither(ctx, width, height, hashNumbers(width, height, cfg.angle))
}

/** Renders the background to a new canvas. */
export function renderGradientCanvas(cfg: GradientConfig, width: number, height: number, opts: { dither?: boolean } = {}): Canvas {
  const canvas = createCanvas(width, height)
  const ctx = get2d(canvas)
  renderGradient(ctx, cfg, width, height, opts)
  return canvas
}

/** CSS approximation used for small UI swatches and preset thumbnails. */
export function gradientToCss(cfg: Pick<GradientConfig, 'stops' | 'angle'>): string {
  const stops = sortedStops(cfg.stops)
    .map((s) => `${s.color} ${(s.position * 100).toFixed(1)}%`)
    .join(', ')
  return `linear-gradient(${cfg.angle + 90}deg, ${stops})`
}
