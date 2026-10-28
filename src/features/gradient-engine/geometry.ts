/**
 * Composition-aware placement of gradient focal points and light sources.
 * Points favour rule-of-thirds / golden-ratio anchors, keep their distance from
 * one another, and are allowed to sit slightly off-canvas so light "enters" the frame.
 */
import type { FieldPoint, GradientType, Point } from '@/types/config'
import { createRng, type Rng } from '@/lib/random'
import { clamp } from '@/lib/math'

const ANCHORS: Point[] = [
  { x: 0.333, y: 0.333 },
  { x: 0.667, y: 0.333 },
  { x: 0.333, y: 0.667 },
  { x: 0.667, y: 0.667 },
  { x: 0.382, y: 0.618 },
  { x: 0.618, y: 0.382 },
  { x: -0.05, y: 0.15 },
  { x: 1.05, y: 0.85 },
  { x: 0.15, y: 1.05 },
  { x: 0.85, y: -0.05 },
  { x: 0.5, y: -0.1 },
  { x: 0.5, y: 1.1 },
]

const PLEASING_ANGLES = [115, 135, 150, 160, 200, 225, 245, 315, 330, 30, 45, 60, 90, 270]

export function pickAngle(rng: Rng): number {
  return Math.round((rng.pick(PLEASING_ANGLES) + rng.range(-10, 10) + 360) % 360)
}

export function pickFocal(rng: Rng): Point {
  const a = rng.pick(ANCHORS.slice(0, 6))
  return { x: round3(clamp(a.x + rng.range(-0.06, 0.06))), y: round3(clamp(a.y + rng.range(-0.06, 0.06))) }
}

/**
 * Every stop gets at least one light source / colour field, so every colour in
 * the palette always contributes to the rendered background.
 */
export function generateFieldPoints(type: GradientType, stopCount: number, rng: Rng): FieldPoint[] {
  if (type === 'aurora') return auroraRibbons(stopCount, rng)
  const n = Math.max(1, stopCount)
  const count = type === 'glow' ? Math.min(8, Math.max(2, n)) : type === 'mesh' ? Math.max(3, n + rng.int(0, 2)) : rng.int(3, 5)
  const shrink = type === 'glow' ? Math.sqrt(3 / Math.max(3, count)) : 1
  const placed: FieldPoint[] = []
  let attempts = 0
  while (placed.length < count && attempts < 200) {
    attempts++
    const a = rng.pick(ANCHORS)
    const p = { x: a.x + rng.range(-0.12, 0.12), y: a.y + rng.range(-0.12, 0.12) }
    const minDist = (type === 'glow' ? 0.42 : 0.3) * Math.sqrt(4 / Math.max(4, count))
    if (placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < minDist) && attempts < 150) continue
    placed.push({
      x: round3(p.x),
      y: round3(p.y),
      radius: round3((type === 'glow' ? rng.range(0.38, 0.7) : rng.range(0.32, 0.62)) * shrink),
      stop: placed.length % n,
      phase: round3(rng.next()),
    })
  }
  return placed
}

function auroraRibbons(stopCount: number, rng: Rng): FieldPoint[] {
  const count = rng.int(2, 4)
  return Array.from({ length: count }, (_, i) => ({
    // x: wave frequency, y: baseline, radius: ribbon thickness
    x: round3(rng.range(1.2, 3.2)),
    y: round3(clamp(0.28 + (i / Math.max(1, count - 1)) * 0.38 + rng.range(-0.06, 0.06), 0.18, 0.78)),
    radius: round3(rng.range(0.06, 0.12)),
    stop: (i + 1) % Math.max(1, stopCount),
    phase: round3(rng.next()),
  }))
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Deterministic geometry for a gradient style, used when switching styles or stop counts. */
export function pointsForType(type: GradientType, stopCount: number, seed: number): FieldPoint[] {
  return generateFieldPoints(type, stopCount, createRng(seed).fork(37))
}
