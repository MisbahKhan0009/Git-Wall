import type { WallpaperConfig } from '@/types/config'
import { applyPalettePreset } from '@/features/gradient-engine/generate'
import { PALETTE_PRESETS } from './palettes'
import { applyAutoGraph } from '@/features/composition/auto-graph'

export const DEFAULT_PRESET_ID = 'midnight-iris'

export const RESOLUTION_PRESETS = [
  { id: '1080p', label: '1920 × 1080', ratio: '16:9', width: 1920, height: 1080 },
  { id: '1440p', label: '2560 × 1440', ratio: '16:9', width: 2560, height: 1440 },
  { id: '4k', label: '3840 × 2160', ratio: '16:9', width: 3840, height: 2160 },
  { id: '1600p', label: '2560 × 1600', ratio: '16:10', width: 2560, height: 1600 },
  { id: 'mbp', label: '3024 × 1964', ratio: '16:10', width: 3024, height: 1964 },
  { id: 'uw', label: '3440 × 1440', ratio: '21:9', width: 3440, height: 1440 },
  { id: '3:2', label: '2880 × 1920', ratio: '3:2', width: 2880, height: 1920 },
  { id: '4:3', label: '2048 × 1536', ratio: '4:3', width: 2048, height: 1536 },
  { id: 'square', label: '2160 × 2160', ratio: '1:1', width: 2160, height: 2160 },
  { id: 'phone', label: '1290 × 2796', ratio: '9:19.5', width: 1290, height: 2796 },
] as const

export const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '16:10', label: '16:10', w: 16, h: 10 },
  { id: '21:9', label: '21:9', w: 21, h: 9 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
  { id: '1:1', label: 'Square', w: 1, h: 1 },
] as const

export const BASE_CONFIG: WallpaperConfig = {
  version: 1,
  seed: 0x1202,
  constraints: { harmony: 'auto', mood: 'auto' },
  canvas: { width: 3840, height: 2160 },
  gradient: {
    autoType: true,
    type: 'aurora',
    stops: [],
    base: '#07081a',
    angle: 90,
    focal: { x: 0.5, y: 0.4 },
    intensity: 0.75,
    smoothness: 0.7,
    points: [],
    warp: 0.4,
    transparent: false,
  },
  grain: {
    enabled: true,
    intensity: 0.38,
    scale: 1.1,
    contrast: 0.42,
    opacity: 0.65,
    coarse: false,
    colored: false,
    film: false,
    overGraph: false,
    seed: 7331,
  },
  glass: {
    enabled: true,
    style: 'soft',
    intensity: 0.9,
    layers: 1,
    density: 26,
    scale: 1,
    softness: 0.8,
    blur: 0.25,
    transparency: 0.85,
    highlight: 0.45,
    shadow: 0.35,
    distortion: 0.45,
    tint: '#ffffff',
    tintAmount: 0,
    blend: 'normal',
    position: { x: 0.78, y: 0.5 },
    coverage: 0.42,
    angle: 0,
    seed: 4242,
  },
  graph: {
    paletteId: 'lavender',
    levels: ['#ece6ff', '#463b6e', '#6c5cae', '#9d8cf0', '#d8cfff'],
    emptyOpacity: 0.09,
    cellOpacity: 1,
    opacity: 1,
    cellSize: 14,
    gap: 4,
    shape: 'rounded',
    radius: 0.3,
    borderWidth: 0,
    borderColor: '#ffffff',
    borderOpacity: 0.15,
    glow: 0.3,
    shadow: 0.25,
    blur: 0,
    showMonths: true,
    showWeekdays: true,
    labelColor: '#f5f5f2',
    labelOpacity: 0.5,
    mapping: 'quantile',
  },
  container: {
    style: 'frosted',
    color: '#ffffff',
    opacity: 0.07,
    blur: 28,
    borderColor: '#ffffff',
    borderOpacity: 0.18,
    borderWidth: 1,
    radius: 28,
    padding: 40,
    shadow: 0.35,
    highlight: 0.5,
  },
  composition: {
    hAlign: 'center',
    vAlign: 'center',
    offset: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    margin: 0.08,
  },
  typography: {
    showUsername: false,
    showSummary: false,
    showDateRange: false,
    showDivider: false,
    title: '',
    font: 'sans',
    size: 18,
    color: '#f5f5f2',
    opacity: 0.8,
    placement: 'above',
  },
  export: { format: 'png', quality: 0.95 },
}

export function createDefaultConfig(): WallpaperConfig {
  const preset = PALETTE_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  const cfg = applyPalettePreset(structuredClone(BASE_CONFIG), preset)
  cfg.gradient.autoType = true
  return applyAutoGraph(cfg)
}
