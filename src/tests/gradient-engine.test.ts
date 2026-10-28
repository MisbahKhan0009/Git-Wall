import { beforeAll, describe, expect, it } from 'vitest'
import { installNodeCanvas, nodeCanvas } from './setup-canvas'
import { generateComposition } from '@/features/gradient-engine/generate'
import { generatePalette, hueInRanges, MOOD_SPECS } from '@/features/gradient-engine/palette'
import { renderGradient } from '@/features/gradient-engine/render'
import { pointsForType } from '@/features/gradient-engine/geometry'
import { createDefaultConfig } from '@/presets/defaults'
import { createRng } from '@/lib/random'
import { hexToOklch, hueDistance, isHex, normalizeColor } from '@/lib/color'
import { sanitizeConfig } from '@/features/persistence/sanitize'
import type { GradientType, WallpaperConfig } from '@/types/config'

beforeAll(installNodeCanvas)

const colorsOf = (c: WallpaperConfig) => c.gradient.stops.map((s) => [s.color, s.position])

describe('seeded generation', () => {
  it('produces the same palette and geometry for the same seed', () => {
    const base = createDefaultConfig()
    for (const seed of [1, 42, 9001, 0xdeadbeef]) {
      const a = generateComposition(base, seed, 'all')
      const b = generateComposition(base, seed, 'all')
      expect(colorsOf(a)).toEqual(colorsOf(b))
      expect(a.gradient.base).toBe(b.gradient.base)
      expect(a.gradient.type).toBe(b.gradient.type)
      expect(a.gradient.points).toEqual(b.gradient.points)
      expect(a.gradient.angle).toBe(b.gradient.angle)
      expect(a.graph.levels).toEqual(b.graph.levels)
      expect(a.seed).toBe(seed)
    }
  })

  it('produces different compositions for different seeds', () => {
    const base = createDefaultConfig()
    const results = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(colorsOf(generateComposition(base, s, 'all')))))
    expect(results.size).toBe(6)
  })

  it('never changes locked colours, for every randomisation scope', () => {
    const base = createDefaultConfig()
    base.gradient.stops[0] = { ...base.gradient.stops[0], color: '#ff5500', locked: true }
    base.gradient.stops[2] = { ...base.gradient.stops[2], color: '#00a3ff', locked: true }
    for (let seed = 1; seed < 60; seed++) {
      for (const scope of ['all', 'colors', 'geometry', 'graph', 'effects'] as const) {
        const next = generateComposition(base, seed * 97, scope)
        const locked = next.gradient.stops.filter((s) => s.locked)
        expect(locked.map((s) => [s.id, s.color, s.position])).toEqual([
          [base.gradient.stops[0].id, '#ff5500', base.gradient.stops[0].position],
          [base.gradient.stops[2].id, '#00a3ff', base.gradient.stops[2].position],
        ])
      }
    }
  })

  it('derives new colours from the hue of a locked colour', () => {
    const base = createDefaultConfig()
    base.gradient.stops[0] = { ...base.gradient.stops[0], color: '#e0402a', locked: true }
    const lockedHue = hexToOklch('#e0402a').h
    const next = generateComposition({ ...base, constraints: { harmony: 'analogous', mood: 'balanced' } }, 1234, 'colors')
    const others = next.gradient.stops.filter((s) => !s.locked).map((s) => hexToOklch(s.color))
    for (const c of others) expect(hueDistance(c.h, lockedHue)).toBeLessThan(80)
  })

  it('generates valid colour stops', () => {
    const base = createDefaultConfig()
    for (let seed = 1; seed < 200; seed++) {
      const { stops, base: bg } = generateComposition(base, seed, 'all').gradient
      expect(stops.length).toBeGreaterThanOrEqual(2)
      expect(stops.length).toBeLessThanOrEqual(8)
      for (const s of stops) {
        expect(isHex(s.color)).toBe(true)
        expect(s.position).toBeGreaterThanOrEqual(0)
        expect(s.position).toBeLessThanOrEqual(1)
      }
      const sorted = [...stops].sort((a, b) => a.position - b.position)
      expect(sorted[0].position).toBe(0)
      expect(sorted[sorted.length - 1].position).toBe(1)
      expect(isHex(bg)).toBe(true)
    }
  })
})

describe('palette constraints', () => {
  const sample = (mood: WallpaperConfig['constraints']['mood'], harmony: WallpaperConfig['constraints']['harmony'] = 'auto') =>
    Array.from({ length: 80 }, (_, i) => generatePalette({ rng: createRng(i * 31 + 7), constraints: { mood, harmony } }))

  it('keeps pastel palettes light and soft', () => {
    for (const p of sample('pastel')) {
      expect(p.mood).toBe('pastel')
      for (const s of p.stops) {
        const c = hexToOklch(s.color)
        expect(c.l).toBeGreaterThan(0.72)
        expect(c.c).toBeLessThan(0.13)
      }
    }
  })

  it('keeps warm and cool palettes inside their hue families', () => {
    for (const mood of ['warm', 'cool'] as const) {
      for (const p of sample(mood)) {
        for (const s of p.stops) {
          const c = hexToOklch(s.color)
          if (c.c < 0.03) continue
          expect(hueInRanges(c.h, MOOD_SPECS[mood].hues, 14)).toBe(true)
        }
      }
    }
  })

  it('keeps monochromatic palettes on one hue', () => {
    for (const p of sample('balanced', 'monochromatic')) {
      const hues = p.stops.map((s) => hexToOklch(s.color)).filter((c) => c.c > 0.04).map((c) => c.h)
      for (const h of hues) expect(hueDistance(h, hues[0])).toBeLessThan(32)
    }
  })

  it('makes deep palettes dark', () => {
    for (const p of sample('deep')) {
      const mean = p.stops.reduce((s, x) => s + hexToOklch(x.color).l, 0) / p.stops.length
      expect(mean).toBeLessThan(0.5)
      expect(hexToOklch(p.base).l).toBeLessThan(0.2)
    }
  })

  it('honours an explicit harmony', () => {
    for (const p of sample('balanced', 'complementary')) expect(p.harmony).toBe('complementary')
  })
})

describe('colour validation', () => {
  it('normalises valid input and rejects invalid input safely', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc')
    expect(normalizeColor('abc')).toBe('#aabbcc')
    expect(normalizeColor('#1a2B3c')).toBe('#1a2b3c')
    expect(normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000')
    expect(normalizeColor('hsl(120 100% 25%)')).toBe('#008000')
    expect(normalizeColor('rebeccapurple')).toBe('#663399')
    for (const bad of ['', 'nope', '#12345', '#gggggg', 'rgb(1,2)', null, undefined, 42, {}, '<script>']) {
      expect(normalizeColor(bad)).toBeNull()
    }
  })

  it('falls back to defaults when stored configuration contains invalid colours', () => {
    const defaults = createDefaultConfig()
    const dirty = structuredClone(defaults) as unknown as Record<string, any>
    dirty.gradient.base = 'not-a-colour'
    dirty.gradient.stops = [{ id: 'a', color: 'blue-ish', position: 0 }, { id: 'b', color: '#00ff00', position: 2 }]
    dirty.graph.levels = ['#000', 'zzz', '#fff', '#fff', '#fff']
    dirty.container.color = 12
    dirty.graph.cellSize = 9999
    dirty.gradient.type = 'hologram'
    const clean = sanitizeConfig(dirty, defaults)
    expect(clean.gradient.base).toBe(defaults.gradient.base)
    expect(clean.gradient.stops).toEqual(defaults.gradient.stops)
    expect(clean.graph.levels).toEqual(defaults.graph.levels)
    expect(clean.container.color).toBe(defaults.container.color)
    expect(clean.graph.cellSize).toBe(40)
    expect(clean.gradient.type).toBe(defaults.gradient.type)
  })
})

describe('gradient rendering', () => {
  const TYPES: GradientType[] = ['linear', 'radial', 'mesh', 'aurora', 'glow', 'atmospheric', 'displaced']

  it.each(TYPES)('renders a smooth, non-uniform, deterministic %s background', (type) => {
    const g = createDefaultConfig().gradient
    const cfg = { ...g, type, points: pointsForType(type, g.stops.length, 7) }
    const render = () => {
      const c = nodeCanvas(320, 180)
      const ctx = c.getContext('2d') as CanvasRenderingContext2D
      renderGradient(ctx, cfg, 320, 180)
      return ctx.getImageData(0, 0, 320, 180).data
    }
    const a = render()
    const b = render()
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    // non-uniform: luminance range across the image
    let min = 255
    let max = 0
    for (let i = 0; i < a.length; i += 4 * 97) {
      const l = (a[i] + a[i + 1] + a[i + 2]) / 3
      min = Math.min(min, l)
      max = Math.max(max, l)
      expect(a[i + 3]).toBe(255)
    }
    expect(max - min).toBeGreaterThan(20)
  })
})

describe('every colour stop matters', () => {
  it.each(['linear', 'radial', 'mesh', 'aurora', 'glow', 'atmospheric', 'displaced'] as GradientType[])('changing any stop changes a %s background', (type) => {
    const g0 = createDefaultConfig().gradient
    const base = { ...g0, type, points: pointsForType(type, g0.stops.length, 3) }
    const render = (g: typeof base) => {
      const c = nodeCanvas(200, 112)
      const ctx = c.getContext('2d') as CanvasRenderingContext2D
      renderGradient(ctx, g, 200, 112, { dither: false })
      return Buffer.from(ctx.getImageData(0, 0, 200, 112).data)
    }
    const ref = render(base)
    base.stops.forEach((_, i) => {
      const stops = base.stops.map((s, j) => (j === i ? { ...s, color: '#ff00aa' } : s))
      expect(render({ ...base, stops }).equals(ref)).toBe(false)
    })
  })
})
