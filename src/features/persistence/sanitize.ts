/**
 * Validates untrusted configuration (localStorage, share codes, saved presets)
 * against the defaults. Unknown keys are dropped, invalid colours and numbers
 * fall back to defaults, numbers are clamped into their valid ranges.
 */
import type { ColorStop, FieldPoint, WallpaperConfig } from '@/types/config'
import { normalizeColor } from '@/lib/color'
import { uid } from '@/lib/random'

type Rule = { min: number; max: number }

const RANGES: Record<string, Rule> = {
  'canvas.width': { min: 320, max: 16384 },
  'canvas.height': { min: 320, max: 16384 },
  'gradient.angle': { min: -360, max: 720 },
  'gradient.intensity': { min: 0, max: 1 },
  'gradient.smoothness': { min: 0, max: 1 },
  'gradient.warp': { min: 0, max: 1 },
  'grain.intensity': { min: 0, max: 1 },
  'grain.scale': { min: 0.5, max: 4 },
  'grain.contrast': { min: 0, max: 1 },
  'grain.opacity': { min: 0, max: 1 },
  'glass.intensity': { min: 0, max: 1 },
  'glass.layers': { min: 1, max: 3 },
  'glass.density': { min: 2, max: 80 },
  'glass.scale': { min: 0.5, max: 3 },
  'glass.softness': { min: 0, max: 1 },
  'glass.blur': { min: 0, max: 1 },
  'glass.transparency': { min: 0, max: 1 },
  'glass.highlight': { min: 0, max: 1 },
  'glass.shadow': { min: 0, max: 1 },
  'glass.distortion': { min: 0, max: 1 },
  'glass.tintAmount': { min: 0, max: 1 },
  'glass.coverage': { min: 0.1, max: 1 },
  'glass.angle': { min: -45, max: 45 },
  'graph.emptyOpacity': { min: 0, max: 1 },
  'graph.cellOpacity': { min: 0, max: 1 },
  'graph.opacity': { min: 0, max: 1 },
  'graph.cellSize': { min: 4, max: 40 },
  'graph.gap': { min: 0, max: 16 },
  'graph.radius': { min: 0, max: 0.5 },
  'graph.borderWidth': { min: 0, max: 6 },
  'graph.borderOpacity': { min: 0, max: 1 },
  'graph.glow': { min: 0, max: 1 },
  'graph.shadow': { min: 0, max: 1 },
  'graph.blur': { min: 0, max: 12 },
  'graph.labelOpacity': { min: 0, max: 1 },
  'container.opacity': { min: 0, max: 1 },
  'container.blur': { min: 0, max: 80 },
  'container.borderOpacity': { min: 0, max: 1 },
  'container.borderWidth': { min: 0, max: 8 },
  'container.radius': { min: 0, max: 120 },
  'container.padding': { min: 0, max: 160 },
  'container.shadow': { min: 0, max: 1 },
  'container.highlight': { min: 0, max: 1 },
  'composition.scale': { min: 0.2, max: 3 },
  'composition.rotation': { min: -12, max: 12 },
  'composition.margin': { min: 0, max: 0.25 },
  'typography.size': { min: 8, max: 64 },
  'typography.opacity': { min: 0, max: 1 },
  'export.quality': { min: 0.5, max: 1 },
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function clean(def: unknown, raw: unknown, path: string): unknown {
  if (raw === undefined || raw === null) return def
  if (typeof def === 'number') {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return def
    const r = RANGES[path]
    return r ? Math.min(r.max, Math.max(r.min, raw)) : raw
  }
  if (typeof def === 'boolean') return typeof raw === 'boolean' ? raw : def
  if (typeof def === 'string') {
    if (typeof raw !== 'string') return def
    if (/^#[0-9a-f]{6}$/i.test(def)) return normalizeColor(raw) ?? def
    // enums: accept only strings, and keep length sane
    return raw.slice(0, 120)
  }
  if (Array.isArray(def)) return def
  if (isObj(def)) {
    if (!isObj(raw)) return def
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(def)) out[key] = clean(def[key], raw[key], path ? `${path}.${key}` : key)
    return out
  }
  return def
}

const ENUMS: Record<string, readonly string[]> = {
  'constraints.harmony': ['auto', 'analogous', 'complementary', 'split-complementary', 'triadic', 'monochromatic'],
  'constraints.mood': ['auto', 'warm', 'cool', 'pastel', 'deep', 'neon', 'earth', 'balanced'],
  'gradient.type': ['linear', 'radial', 'mesh', 'aurora', 'glow', 'atmospheric', 'displaced'],
  'glass.style': ['soft', 'shards', 'organic', 'geometric', 'minimal'],
  'glass.blend': ['normal', 'screen', 'overlay', 'soft-light', 'lighten', 'luminosity'],
  'graph.paletteId': ['auto', 'classic', 'monochrome', 'lavender', 'neon-cyan', 'sunset', 'coral', 'arctic', 'amber', 'emerald', 'custom'],
  'graph.shape': ['square', 'rounded', 'circle'],
  'graph.mapping': ['quantile', 'linear', 'source'],
  'container.style': ['none', 'frosted', 'dark', 'light', 'bordered', 'custom', 'transparent'],
  'composition.hAlign': ['left', 'center', 'right'],
  'composition.vAlign': ['top', 'center', 'bottom'],
  'typography.font': ['sans', 'mono'],
  'typography.placement': ['above', 'below'],
  'export.format': ['png', 'jpeg', 'webp'],
}

function cleanStops(raw: unknown, fallback: ColorStop[]): ColorStop[] {
  if (!Array.isArray(raw)) return fallback
  const stops = raw
    .filter(isObj)
    .map((s) => {
      const color = normalizeColor(s.color)
      const position = typeof s.position === 'number' && Number.isFinite(s.position) ? Math.min(1, Math.max(0, s.position)) : null
      if (!color || position === null) return null
      return { id: typeof s.id === 'string' ? s.id : uid('stop'), color, position, locked: s.locked === true }
    })
    .filter((s): s is ColorStop => s !== null)
    .slice(0, 8)
  return stops.length >= 2 ? stops : fallback
}

function cleanPoints(raw: unknown, fallback: FieldPoint[]): FieldPoint[] {
  if (!Array.isArray(raw)) return fallback
  const num = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d)
  const pts = raw.filter(isObj).slice(0, 10).map((p) => ({
    x: num(p.x, -1, 2, 0.5),
    y: num(p.y, -1, 2, 0.5),
    radius: num(p.radius, 0.01, 2, 0.5),
    stop: Math.floor(num(p.stop, 0, 16, 0)),
    phase: num(p.phase, 0, 1, 0),
  }))
  return pts.length ? pts : fallback
}

export function sanitizeConfig(raw: unknown, defaults: WallpaperConfig): WallpaperConfig {
  const out = clean(defaults, raw, '') as WallpaperConfig
  for (const [path, values] of Object.entries(ENUMS)) {
    const [section, key] = path.split('.') as [keyof WallpaperConfig, string]
    const obj = out[section] as unknown as Record<string, unknown>
    const d = (defaults[section] as unknown as Record<string, unknown>)[key]
    if (!values.includes(obj[key] as string)) obj[key] = d
  }
  const r = isObj(raw) ? raw : {}
  const rg = isObj(r.gradient) ? r.gradient : {}
  const rgraph = isObj(r.graph) ? r.graph : {}
  out.gradient.stops = cleanStops(rg.stops, defaults.gradient.stops)
  out.gradient.points = cleanPoints(rg.points, defaults.gradient.points)
  out.gradient.focal = { x: clampN(out.gradient.focal.x, -0.5, 1.5), y: clampN(out.gradient.focal.y, -0.5, 1.5) }
  out.glass.position = { x: clampN(out.glass.position.x, 0, 1), y: clampN(out.glass.position.y, 0, 1) }
  out.composition.offset = { x: clampN(out.composition.offset.x, -0.5, 0.5), y: clampN(out.composition.offset.y, -0.5, 0.5) }
  const levels = Array.isArray(rgraph.levels) ? rgraph.levels.map(normalizeColor) : []
  out.graph.levels = levels.length === 5 && levels.every(Boolean) ? (levels as WallpaperConfig['graph']['levels']) : [...defaults.graph.levels]
  out.seed = typeof r.seed === 'number' && Number.isFinite(r.seed) ? r.seed >>> 0 : defaults.seed
  out.version = 1
  out.canvas.width = Math.round(out.canvas.width)
  out.canvas.height = Math.round(out.canvas.height)
  return out
}

const clampN = (v: number, min: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (min + max) / 2)

/** Compact, URL-safe share code for a configuration. */
export function encodeShareCode(config: WallpaperConfig): string {
  const json = JSON.stringify(config)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeShareCode(code: string, defaults: WallpaperConfig): WallpaperConfig | null {
  try {
    const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes))
    if (!isObj(parsed)) return null
    return sanitizeConfig(parsed, defaults)
  } catch {
    return null
  }
}
