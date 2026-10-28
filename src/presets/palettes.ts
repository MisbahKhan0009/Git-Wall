import type { GradientType, GraphPaletteId, Hex } from '@/types/config'

export interface PalettePreset {
  id: string
  name: string
  type: GradientType
  base: Hex
  colors: Hex[]
  angle: number
  focal: { x: number; y: number }
  /** Seed for the procedural geometry of field gradients. */
  seed: number
  warp: number
  intensity: number
  smoothness: number
  graph: GraphPaletteId
}

/** An original, curated collection. Each preset is a complete, coherent palette. */
export const PALETTE_PRESETS: PalettePreset[] = [
  { id: 'arctic-bloom', name: 'Arctic Bloom', type: 'mesh', base: '#0b1220', colors: ['#1d3557', '#6aa8ff', '#9fd8ff', '#c7b8ff', '#f3c6e8'], angle: 135, focal: { x: 0.62, y: 0.38 }, seed: 1101, warp: 0.45, intensity: 0.72, smoothness: 0.7, graph: 'arctic' },
  { id: 'midnight-iris', name: 'Midnight Iris', type: 'aurora', base: '#07081a', colors: ['#1e1b4b', '#3b2f8f', '#6b5cff', '#9e7bff', '#4fc3f7'], angle: 90, focal: { x: 0.5, y: 0.4 }, seed: 1202, warp: 0.35, intensity: 0.78, smoothness: 0.6, graph: 'lavender' },
  { id: 'solar-flare', name: 'Solar Flare', type: 'glow', base: '#140806', colors: ['#c2185b', '#ff6a3d', '#ffb347', '#ffd56b'], angle: 45, focal: { x: 0.7, y: 0.3 }, seed: 1303, warp: 0.3, intensity: 0.8, smoothness: 0.55, graph: 'amber' },
  { id: 'lavender-haze', name: 'Lavender Haze', type: 'mesh', base: '#efe9fb', colors: ['#c7d8ff', '#d9c8ff', '#f6d5ec', '#ece0ff', '#fbe7d9'], angle: 160, focal: { x: 0.4, y: 0.4 }, seed: 1404, warp: 0.5, intensity: 0.75, smoothness: 0.8, graph: 'auto' },
  { id: 'obsidian-aurora', name: 'Obsidian Aurora', type: 'aurora', base: '#05070c', colors: ['#0f766e', '#22d3a6', '#3b82f6', '#a78bfa'], angle: 90, focal: { x: 0.5, y: 0.35 }, seed: 1505, warp: 0.4, intensity: 0.75, smoothness: 0.55, graph: 'auto' },
  { id: 'rosewater', name: 'Rosewater', type: 'displaced', base: '#1a0f14', colors: ['#3d1f2b', '#b56576', '#e98aa5', '#f4a6b8', '#ffd3c4'], angle: 120, focal: { x: 0.6, y: 0.5 }, seed: 1606, warp: 0.55, intensity: 0.7, smoothness: 0.85, graph: 'coral' },
  { id: 'electric-moss', name: 'Electric Moss', type: 'glow', base: '#070d07', colors: ['#14b8a6', '#22c55e', '#a3e635', '#facc15'], angle: 30, focal: { x: 0.3, y: 0.6 }, seed: 1707, warp: 0.35, intensity: 0.7, smoothness: 0.6, graph: 'emerald' },
  { id: 'deep-ocean', name: 'Deep Ocean', type: 'atmospheric', base: '#020b16', colors: ['#020b16', '#03132b', '#0b3d6b', '#126e8c', '#47b5c6'], angle: 90, focal: { x: 0.5, y: 0.82 }, seed: 1808, warp: 0.5, intensity: 0.75, smoothness: 0.8, graph: 'neon-cyan' },
  { id: 'peach-nebula', name: 'Peach Nebula', type: 'mesh', base: '#1c0f17', colors: ['#3a1c4a', '#8e5bd6', '#ff7e8a', '#ffb199', '#ffd6a5'], angle: 140, focal: { x: 0.65, y: 0.4 }, seed: 1909, warp: 0.6, intensity: 0.74, smoothness: 0.7, graph: 'sunset' },
  { id: 'cosmic-violet', name: 'Cosmic Violet', type: 'aurora', base: '#0a0614', colors: ['#5b21b6', '#c026d3', '#6366f1', '#f472b6'], angle: 90, focal: { x: 0.5, y: 0.4 }, seed: 2010, warp: 0.45, intensity: 0.76, smoothness: 0.6, graph: 'lavender' },
  { id: 'glacier-blue', name: 'Glacier Blue', type: 'linear', base: '#0b1a2b', colors: ['#0f2a44', '#2f5d8a', '#6fa8dc', '#a5d8f3', '#dff3ff'], angle: 115, focal: { x: 0.5, y: 0.5 }, seed: 2111, warp: 0.2, intensity: 0.72, smoothness: 0.9, graph: 'auto' },
  { id: 'ember', name: 'Ember', type: 'radial', base: '#0c0503', colors: ['#ffb05c', '#ff5e1a', '#b3261e', '#3b0d0c', '#120605'], angle: 90, focal: { x: 0.5, y: 1.05 }, seed: 2212, warp: 0.2, intensity: 0.75, smoothness: 0.75, graph: 'amber' },
  { id: 'soft-monochrome', name: 'Soft Monochrome', type: 'mesh', base: '#121214', colors: ['#1c1c1f', '#2a2a2e', '#4a4a50', '#8a8a90', '#d8d8d4'], angle: 135, focal: { x: 0.5, y: 0.5 }, seed: 2313, warp: 0.5, intensity: 0.75, smoothness: 0.8, graph: 'monochrome' },
  { id: 'dreamscape', name: 'Dreamscape', type: 'displaced', base: '#150f2a', colors: ['#2a1b5c', '#7f5af0', '#2cb1bc', '#f9a8d4', '#fde68a'], angle: 150, focal: { x: 0.5, y: 0.5 }, seed: 2414, warp: 0.65, intensity: 0.72, smoothness: 0.85, graph: 'auto' },
  { id: 'ultraviolet', name: 'Ultraviolet', type: 'glow', base: '#06020f', colors: ['#4f46e5', '#7c3aed', '#a855f7', '#db2777'], angle: 60, focal: { x: 0.5, y: 0.5 }, seed: 2515, warp: 0.4, intensity: 0.8, smoothness: 0.6, graph: 'neon-cyan' },
  { id: 'forest-after-dark', name: 'Forest After Dark', type: 'atmospheric', base: '#050a07', colors: ['#050a07', '#0b1f17', '#14432f', '#2f6b4f', '#c9a96e'], angle: 90, focal: { x: 0.62, y: 0.78 }, seed: 2616, warp: 0.45, intensity: 0.7, smoothness: 0.8, graph: 'emerald' },
]
