/**
 * Perceptual palette generation.
 *
 * Colours are never random hex values. A palette is built in OKLCH from a mood
 * (lightness / chroma envelope + allowed hues) and a harmony (hue relationships),
 * then gamut-mapped to sRGB.
 */
import type { ColorStop, GradientType, Harmony, Hex, Mood, PaletteConstraints } from '@/types/config'
import { hexToOklch, hueDistance, oklchToHex, type Oklch } from '@/lib/color'
import { clamp, lerp } from '@/lib/math'
import type { Rng } from '@/lib/random'
import { uid } from '@/lib/random'

export const HARMONIES: Harmony[] = [
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'monochromatic',
]

export const MOODS: Mood[] = ['balanced', 'deep', 'neon', 'pastel', 'warm', 'cool', 'earth']

interface MoodSpec {
  /** Allowed base hue ranges (degrees). */
  hues: [number, number][]
  baseL: [number, number]
  baseC: [number, number]
  stopL: [number, number]
  stopC: [number, number]
  /** Harmonies that read well for this mood, with weights (used for `auto`). */
  harmonies: [Harmony, number][]
  gradients: [GradientType, number][]
  /** Whether hue offsets from the harmony should be compressed into the mood's hue range. */
  confineHues: boolean
}

export const MOOD_SPECS: Record<Mood, MoodSpec> = {
  balanced: {
    hues: [[0, 360]],
    baseL: [0.12, 0.19],
    baseC: [0.02, 0.05],
    stopL: [0.32, 0.78],
    stopC: [0.09, 0.17],
    harmonies: [['analogous', 4], ['split-complementary', 2], ['complementary', 1.5], ['triadic', 1], ['monochromatic', 1]],
    gradients: [['mesh', 4], ['displaced', 2], ['aurora', 2], ['glow', 2], ['linear', 1], ['radial', 1], ['atmospheric', 1]],
    confineHues: false,
  },
  deep: {
    hues: [[180, 330]],
    baseL: [0.09, 0.14],
    baseC: [0.02, 0.05],
    stopL: [0.22, 0.58],
    stopC: [0.08, 0.17],
    harmonies: [['analogous', 4], ['monochromatic', 2], ['split-complementary', 1.5], ['complementary', 1]],
    gradients: [['aurora', 3], ['mesh', 3], ['glow', 3], ['atmospheric', 1.5]],
    confineHues: false,
  },
  neon: {
    hues: [[0, 360]],
    baseL: [0.07, 0.12],
    baseC: [0.02, 0.06],
    stopL: [0.58, 0.8],
    stopC: [0.2, 0.32],
    harmonies: [['complementary', 2], ['split-complementary', 3], ['triadic', 2], ['analogous', 2]],
    gradients: [['aurora', 3.5], ['glow', 3.5], ['mesh', 2], ['displaced', 1]],
    confineHues: false,
  },
  pastel: {
    hues: [[0, 360]],
    baseL: [0.88, 0.94],
    baseC: [0.015, 0.04],
    stopL: [0.76, 0.92],
    stopC: [0.05, 0.11],
    harmonies: [['analogous', 3], ['split-complementary', 2], ['triadic', 1.5], ['complementary', 1]],
    gradients: [['mesh', 4], ['displaced', 2], ['linear', 1.5], ['radial', 1.5], ['atmospheric', 1]],
    confineHues: false,
  },
  warm: {
    hues: [[330, 360], [0, 85]],
    baseL: [0.12, 0.2],
    baseC: [0.03, 0.06],
    stopL: [0.36, 0.8],
    stopC: [0.1, 0.19],
    harmonies: [['analogous', 5], ['monochromatic', 1.5], ['split-complementary', 1]],
    gradients: [['mesh', 3], ['atmospheric', 2.5], ['glow', 2], ['radial', 1], ['displaced', 1.5]],
    confineHues: true,
  },
  cool: {
    hues: [[165, 295]],
    baseL: [0.1, 0.17],
    baseC: [0.025, 0.055],
    stopL: [0.3, 0.76],
    stopC: [0.08, 0.17],
    harmonies: [['analogous', 5], ['monochromatic', 1.5], ['split-complementary', 1]],
    gradients: [['aurora', 3], ['mesh', 3], ['atmospheric', 1.5], ['linear', 1], ['displaced', 1.5]],
    confineHues: true,
  },
  earth: {
    hues: [[25, 150]],
    baseL: [0.14, 0.22],
    baseC: [0.015, 0.035],
    stopL: [0.32, 0.72],
    stopC: [0.04, 0.11],
    harmonies: [['analogous', 4], ['monochromatic', 2], ['split-complementary', 1]],
    gradients: [['atmospheric', 3], ['mesh', 3], ['displaced', 2], ['linear', 1]],
    confineHues: true,
  },
}

const HARMONY_OFFSETS: Record<Harmony, number[]> = {
  analogous: [0, 32, 64, -28, 16],
  complementary: [0, 180, 24, 196, -16],
  'split-complementary': [0, 152, 208, 22, 172],
  triadic: [0, 120, 240, 18, 138],
  monochromatic: [0, 7, -7, 14, -12],
}

/* -------------------------------------------------------------------------- */

export function resolveMood(constraints: PaletteConstraints, rng: Rng): Mood {
  if (constraints.mood !== 'auto') return constraints.mood
  return rng.weighted<Mood>([
    ['balanced', 3],
    ['deep', 3],
    ['neon', 1.5],
    ['pastel', 1.2],
    ['warm', 2],
    ['cool', 2],
    ['earth', 1],
  ])
}

export function resolveHarmony(constraints: PaletteConstraints, mood: Mood, rng: Rng): Harmony {
  if (constraints.harmony !== 'auto') return constraints.harmony
  return rng.weighted(MOOD_SPECS[mood].harmonies)
}

export function chooseGradientType(mood: Mood, rng: Rng): GradientType {
  return rng.weighted(MOOD_SPECS[mood].gradients)
}

function pickHueInRanges(ranges: [number, number][], rng: Rng): number {
  const total = ranges.reduce((s, [a, b]) => s + (b - a), 0)
  let r = rng.next() * total
  for (const [a, b] of ranges) {
    if (r <= b - a) return a + r
    r -= b - a
  }
  return ranges[0][0]
}

export function hueInRanges(hue: number, ranges: [number, number][], tolerance = 0): boolean {
  const h = ((hue % 360) + 360) % 360
  return ranges.some(([a, b]) => h >= a - tolerance && h <= b + tolerance)
}

function rangeSpan(ranges: [number, number][]): number {
  return ranges.reduce((s, [a, b]) => s + (b - a), 0)
}

/** Maps a hue into the mood's allowed range by compressing harmony offsets. */
function confineHue(base: number, offset: number, ranges: [number, number][]): number {
  const span = rangeSpan(ranges)
  if (span >= 359) return base + offset
  const wrapped = ((offset + 180) % 360 + 360) % 360 - 180 // -180..180
  const compressed = (wrapped / 180) * (span * 0.42)
  let h = base + compressed
  // pull back inside the closest range if we wandered off
  if (!hueInRanges(h, ranges)) {
    let best = h
    let bestD = Infinity
    for (const [a, b] of ranges) {
      for (const edge of [a + 2, b - 2]) {
        const d = hueDistance(h, edge)
        if (d < bestD) {
          bestD = d
          best = edge
        }
      }
    }
    h = best
  }
  return h
}

export interface GeneratedPalette {
  mood: Mood
  harmony: Harmony
  baseHue: number
  stops: ColorStop[]
  base: Hex
}

export interface PaletteRequest {
  rng: Rng
  constraints: PaletteConstraints
  /** Existing stops. Locked stops are preserved verbatim. */
  current?: ColorStop[]
  /** Keep the number of stops and their positions. */
  keepStructure?: boolean
}

export function generatePalette({ rng, constraints, current = [], keepStructure = false }: PaletteRequest): GeneratedPalette {
  const locked = current.filter((s) => s.locked)
  const mood = resolveMood(constraints, rng)
  const harmony = resolveHarmony(constraints, mood, rng)
  const spec = MOOD_SPECS[mood]

  // 1. Base hue — derived from a locked colour so new colours harmonise with it.
  const lockedChromatic = locked.map((s) => hexToOklch(s.color)).find((c) => c.c > 0.03)
  const baseHue = lockedChromatic ? lockedChromatic.h : pickHueInRanges(spec.hues, rng)

  // 2. Structure: how many stops, and where.
  const preserve = keepStructure || locked.length > 0
  const count = preserve && current.length >= 2 ? current.length : rng.int(3, 5)
  const positions = preserve && current.length >= 2
    ? current.map((s) => s.position)
    : Array.from({ length: count }, (_, i) => clamp(i / (count - 1) + (i > 0 && i < count - 1 ? rng.range(-0.08, 0.08) : 0)))

  // 3. Hues from the harmony, with gentle jitter.
  const offsets = HARMONY_OFFSETS[harmony]
  const hues = Array.from({ length: count }, (_, i) => {
    const offset = offsets[i % offsets.length] + rng.range(-7, 7)
    return spec.confineHues ? confineHue(baseHue, offset, spec.hues) : baseHue + offset
  })
  // Give the primary hue the largest share: shuffle all but the first.
  for (let i = hues.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(rng.next() * i)
    ;[hues[i], hues[j]] = [hues[j], hues[i]]
  }

  // 4. Lightness distribution — a deliberate light arc rather than noise.
  const [lMin, lMax] = spec.stopL
  const ls = Array.from({ length: count }, (_, i) => lerp(lMin, lMax, count === 1 ? 0.5 : i / (count - 1)) + rng.range(-0.025, 0.025))
  const arrangement = rng.weighted<'ascending' | 'arc' | 'descending' | 'valley'>([
    ['ascending', 3],
    ['arc', 3],
    ['descending', 1.5],
    ['valley', 1],
  ])
  const ordered = arrangeLightness(ls, arrangement)

  // 5. Chroma — compatible across stops, softened at the lightness extremes.
  const cTarget = rng.range(spec.stopC[0], spec.stopC[1])
  const colors = ordered.map((l, i) => {
    const edgeSoftening = 1 - Math.abs(l - 0.62) * (mood === 'pastel' ? 0 : 0.55)
    const c = clamp(cTarget * edgeSoftening * rng.range(0.85, 1.12), 0, 0.37)
    return oklchToHex({ l: clamp(l, 0.04, 0.97), c, h: hues[i] })
  })

  // 6. Assemble stops, reinstating locked colours in their slots.
  const stops: ColorStop[] = positions.map((position, i) => {
    const existing = preserve ? current[i] : undefined
    if (existing?.locked) return { ...existing }
    return { id: existing?.id ?? uid('stop'), color: colors[i], position, locked: false }
  })

  // 7. Deep base colour that the composition glows out of.
  const baseC = rng.range(spec.baseC[0], spec.baseC[1])
  const baseL = rng.range(spec.baseL[0], spec.baseL[1])
  // Darks read richer when nudged towards blue/violet; lights towards the base hue.
  const darkHue = baseL < 0.5 ? mixHue(baseHue, 265, 0.35) : baseHue
  const base = oklchToHex({ l: baseL, c: baseC, h: darkHue })

  return { mood, harmony, baseHue: ((baseHue % 360) + 360) % 360, stops, base }
}

function arrangeLightness(values: number[], mode: 'ascending' | 'arc' | 'descending' | 'valley'): number[] {
  const asc = [...values].sort((a, b) => a - b)
  if (mode === 'ascending') return asc
  if (mode === 'descending') return asc.reverse()
  // arc: brightest in the middle; valley: darkest in the middle
  const src = mode === 'arc' ? asc : [...asc].reverse()
  const out: number[] = new Array(src.length)
  let left = 0
  let right = src.length - 1
  src.forEach((v, i) => {
    if (i % 2 === 0) out[left++] = v
    else out[right--] = v
  })
  return out
}

function mixHue(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return a + d * t
}

/** Estimates the mood a set of colours belongs to (used for presets & custom palettes). */
export function describePalette(colors: Hex[]): { meanL: number; meanC: number; hues: Oklch[] } {
  const lch = colors.map(hexToOklch)
  const meanL = lch.reduce((s, c) => s + c.l, 0) / Math.max(1, lch.length)
  const meanC = lch.reduce((s, c) => s + c.c, 0) / Math.max(1, lch.length)
  return { meanL, meanC, hues: lch }
}
