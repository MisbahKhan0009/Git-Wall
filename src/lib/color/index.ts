import { clampChroma, formatHex, parse, wcagContrast, converter } from 'culori'
import type { Hex } from '@/types/config'
import { clamp } from '@/lib/math'

export interface Oklch {
  l: number // 0..1
  c: number // 0..~0.37
  h: number // degrees
}

export type Rgb = [number, number, number] // 0..255
export type Lab = [number, number, number] // OKLab

const toOklch = converter('oklch')

/* -------------------------------------------------------------------------- */
/* Parsing & validation                                                       */
/* -------------------------------------------------------------------------- */

const HEX6 = /^#[0-9a-f]{6}$/

export function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && HEX6.test(value)
}

/**
 * Accepts anything a user might paste (`#abc`, `abc`, `#AABBCC`, `rgb(…)`,
 * `hsl(…)`, `oklch(…)`, named colours) and returns a normalised `#rrggbb`,
 * or `null` when the input is not a colour.
 */
export function normalizeColor(input: unknown): Hex | null {
  if (typeof input !== 'string') return null
  let s = input.trim().toLowerCase()
  if (!s) return null
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(s)) s = `#${s}`
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  if (HEX6.test(s)) return s
  try {
    const parsed = parse(s)
    if (!parsed) return null
    const hex = formatHex(parsed)
    return hex && HEX6.test(hex) ? hex : null
  } catch {
    return null
  }
}

/** Returns `value` when it is a valid hex colour, otherwise `fallback`. */
export function safeHex(value: unknown, fallback: Hex): Hex {
  return normalizeColor(value) ?? fallback
}

/* -------------------------------------------------------------------------- */
/* Conversions                                                                */
/* -------------------------------------------------------------------------- */

export function hexToRgb(hex: Hex): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: Rgb): Hex {
  const h = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function rgba(hex: Hex, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`
}

const srgbToLinearLut = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  srgbToLinearLut[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function srgbToLinear(v255: number): number {
  return srgbToLinearLut[Math.round(clamp(v255, 0, 255))]
}

export function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055
  return c * 255
}

export function linearRgbToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function hexToOklab(hex: Hex): Lab {
  const [r, g, b] = hexToRgb(hex)
  return linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b))
}

export function oklabToHex([L, a, b]: Lab): Hex {
  const [r, g, bl] = oklabToLinearRgb(L, a, b)
  return rgbToHex([linearToSrgb(r), linearToSrgb(g), linearToSrgb(bl)])
}

export function hexToOklch(hex: Hex): Oklch {
  const c = toOklch(hex)
  return { l: c?.l ?? 0, c: c?.c ?? 0, h: c?.h ?? 0 }
}

/** Converts OKLCH to hex, reducing chroma until the colour fits in sRGB. */
export function oklchToHex({ l, c, h }: Oklch): Hex {
  const color = { mode: 'oklch' as const, l: clamp(l), c: Math.max(0, c), h: ((h % 360) + 360) % 360 }
  return formatHex(clampChroma(color, 'oklch')) ?? '#000000'
}

/* -------------------------------------------------------------------------- */
/* Perceptual helpers                                                         */
/* -------------------------------------------------------------------------- */

export function mixOklab(a: Hex, b: Hex, t: number): Hex {
  const A = hexToOklab(a)
  const B = hexToOklab(b)
  return oklabToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}

export function adjustOklch(hex: Hex, fn: (c: Oklch) => Partial<Oklch>): Hex {
  const c = hexToOklch(hex)
  return oklchToHex({ ...c, ...fn(c) })
}

export function contrastRatio(a: Hex, b: Hex): number {
  return wcagContrast(a, b)
}

export function relativeLuminance(hex: Hex): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}
