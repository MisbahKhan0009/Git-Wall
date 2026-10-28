/**
 * The complete, serialisable description of a wallpaper.
 *
 * Every renderer is a pure function of this object (plus contribution data),
 * which is what makes presets, seeds, undo/redo and high-resolution export work.
 */

export type Hex = string // '#rrggbb'

export interface Point {
  x: number // 0..1, relative to canvas width
  y: number // 0..1, relative to canvas height
}

/* ----------------------------------------------------------------------------
 * Palette & gradient
 * ------------------------------------------------------------------------- */

export type Harmony =
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'monochromatic'

export type Mood = 'warm' | 'cool' | 'pastel' | 'deep' | 'neon' | 'earth' | 'balanced'

export interface PaletteConstraints {
  harmony: Harmony | 'auto'
  mood: Mood | 'auto'
}

export interface ColorStop {
  id: string
  color: Hex
  position: number // 0..1
  locked: boolean
}

export type GradientType =
  | 'linear'
  | 'radial'
  | 'mesh'
  | 'aurora'
  | 'glow'
  | 'atmospheric'
  | 'displaced'

/** A procedurally placed light source / colour field used by the field gradients. */
export interface FieldPoint {
  x: number
  y: number
  radius: number // relative to the canvas diagonal-ish unit (0..1.5)
  stop: number // index into stops (wrapped)
  phase: number // 0..1, used for warps and ribbons
}

export interface GradientConfig {
  /** When true the shuffle chooses a gradient style that suits the palette. */
  autoType: boolean
  type: GradientType
  stops: ColorStop[]
  /** Deep base colour that the luminous gradient types glow out of. */
  base: Hex
  angle: number // degrees, 0 = left→right
  focal: Point
  intensity: number // 0..1
  smoothness: number // 0..1
  /** Procedural geometry for mesh / aurora / glow / atmospheric / displaced. */
  points: FieldPoint[]
  warp: number // 0..1 organic displacement used by field gradients
  transparent: boolean // export without a background (PNG alpha)
}

/* ----------------------------------------------------------------------------
 * Grain
 * ------------------------------------------------------------------------- */

export interface GrainConfig {
  enabled: boolean
  intensity: number // 0..1 amplitude of the noise
  scale: number // 0.5..4 grain size in reference pixels
  contrast: number // 0..1
  opacity: number // 0..1 blend alpha
  coarse: boolean
  colored: boolean
  film: boolean // luminance-weighted grain, dust and a gentle vignette
  overGraph: boolean
  seed: number
}

/* ----------------------------------------------------------------------------
 * Glass
 * ------------------------------------------------------------------------- */

export type GlassStyle = 'soft' | 'shards' | 'organic' | 'geometric' | 'minimal'
export type GlassBlend = 'normal' | 'screen' | 'overlay' | 'soft-light' | 'lighten' | 'luminosity'

export interface GlassConfig {
  enabled: boolean
  style: GlassStyle
  intensity: number // 0..1 overall strength (mix with the background)
  layers: number // 1..3
  density: number // flutes / cells across (4..60)
  scale: number // 0.5..3 magnification of the refracted image
  softness: number // 0..1 corner / edge softness
  blur: number // 0..1
  transparency: number // 0..1 (1 = fully see-through)
  highlight: number // 0..1
  shadow: number // 0..1
  distortion: number // 0..1
  tint: Hex
  tintAmount: number // 0..1
  blend: GlassBlend
  position: Point // centre of the glass region
  coverage: number // 0.2..1 width of the glass region
  angle: number // -45..45
  seed: number
}

/* ----------------------------------------------------------------------------
 * Contribution graph
 * ------------------------------------------------------------------------- */

export type GraphPaletteId =
  | 'auto'
  | 'classic'
  | 'monochrome'
  | 'lavender'
  | 'neon-cyan'
  | 'sunset'
  | 'coral'
  | 'arctic'
  | 'amber'
  | 'emerald'
  | 'custom'

export type CellShape = 'square' | 'rounded' | 'circle'
export type LevelMapping = 'quantile' | 'linear' | 'source'

export interface GraphConfig {
  paletteId: GraphPaletteId
  levels: [Hex, Hex, Hex, Hex, Hex]
  emptyOpacity: number // alpha of level-0 cells
  cellOpacity: number
  opacity: number // whole graph layer
  cellSize: number // reference px (at 1080p)
  gap: number // reference px
  shape: CellShape
  radius: number // 0..0.5 of cell size
  borderWidth: number // reference px
  borderColor: Hex
  borderOpacity: number
  glow: number // 0..1
  shadow: number // 0..1
  blur: number // reference px
  showMonths: boolean
  showWeekdays: boolean
  labelColor: Hex
  labelOpacity: number
  mapping: LevelMapping
}

export type ContainerStyle =
  | 'none'
  | 'frosted'
  | 'dark'
  | 'light'
  | 'bordered'
  | 'custom'
  | 'transparent'

export interface ContainerConfig {
  style: ContainerStyle
  color: Hex
  opacity: number
  blur: number // reference px
  borderColor: Hex
  borderOpacity: number
  borderWidth: number // reference px
  radius: number // reference px
  padding: number // reference px
  shadow: number // 0..1
  highlight: number // 0..1
}

/* ----------------------------------------------------------------------------
 * Composition & typography
 * ------------------------------------------------------------------------- */

export type HAlign = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'center' | 'bottom'
export type CompositionPresetId =
  | 'centered'
  | 'minimal'
  | 'editorial'
  | 'floating-glass'
  | 'asymmetric'
  | 'full-width'

export interface CompositionConfig {
  hAlign: HAlign
  vAlign: VAlign
  offset: Point // -0.5..0.5 nudges, relative to canvas
  scale: number // 0.3..2.5
  rotation: number // -12..12 degrees
  margin: number // safe margin, fraction of the short side (0..0.2)
}

export interface TypographyConfig {
  showUsername: boolean
  showSummary: boolean
  showDateRange: boolean
  showDivider: boolean
  title: string
  font: 'sans' | 'mono'
  size: number // reference px
  color: Hex
  opacity: number
  placement: 'above' | 'below'
}

/* ----------------------------------------------------------------------------
 * Export
 * ------------------------------------------------------------------------- */

export type ExportFormat = 'png' | 'jpeg' | 'webp'

export interface CanvasConfig {
  width: number
  height: number
}

export interface ExportConfig {
  format: ExportFormat
  quality: number // 0.5..1 for lossy formats
}

/* ----------------------------------------------------------------------------
 * The root config
 * ------------------------------------------------------------------------- */

export interface WallpaperConfig {
  version: 1
  seed: number
  constraints: PaletteConstraints
  canvas: CanvasConfig
  gradient: GradientConfig
  grain: GrainConfig
  glass: GlassConfig
  graph: GraphConfig
  container: ContainerConfig
  composition: CompositionConfig
  typography: TypographyConfig
  export: ExportConfig
}
