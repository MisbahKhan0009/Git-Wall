import type {
  CompositionConfig,
  CompositionPresetId,
  ContainerConfig,
  ContainerStyle,
  GraphConfig,
  TypographyConfig,
} from '@/types/config'

export const CONTAINER_STYLES: Record<ContainerStyle, { label: string; values: Partial<ContainerConfig> }> = {
  none: { label: 'Floating', values: { opacity: 0, blur: 0, borderOpacity: 0, borderWidth: 0, shadow: 0, highlight: 0, padding: 0 } },
  frosted: {
    label: 'Frosted glass',
    values: { color: '#ffffff', opacity: 0.08, blur: 28, borderColor: '#ffffff', borderOpacity: 0.2, borderWidth: 1, radius: 28, padding: 40, shadow: 0.35, highlight: 0.5 },
  },
  dark: {
    label: 'Dark panel',
    values: { color: '#09090b', opacity: 0.48, blur: 18, borderColor: '#ffffff', borderOpacity: 0.08, borderWidth: 1, radius: 24, padding: 40, shadow: 0.45, highlight: 0.12 },
  },
  light: {
    label: 'Light panel',
    values: { color: '#fbfaf7', opacity: 0.72, blur: 22, borderColor: '#ffffff', borderOpacity: 0.6, borderWidth: 1, radius: 24, padding: 40, shadow: 0.25, highlight: 0.3 },
  },
  bordered: {
    label: 'Soft border',
    values: { color: '#000000', opacity: 0, blur: 0, borderColor: '#ffffff', borderOpacity: 0.28, borderWidth: 1.5, radius: 22, padding: 36, shadow: 0, highlight: 0 },
  },
  custom: {
    label: 'Custom colour',
    values: { opacity: 0.55, blur: 16, borderOpacity: 0.12, borderWidth: 1, radius: 24, padding: 40, shadow: 0.3, highlight: 0.15 },
  },
  transparent: {
    label: 'Transparent',
    values: { opacity: 0, blur: 0, borderOpacity: 0, borderWidth: 0, shadow: 0, highlight: 0, padding: 40 },
  },
}

export interface CompositionPreset {
  id: CompositionPresetId
  label: string
  description: string
  composition: Partial<CompositionConfig>
  container?: ContainerStyle
  graph?: Partial<GraphConfig>
  typography?: Partial<TypographyConfig>
}

export const COMPOSITION_PRESETS: CompositionPreset[] = [
  {
    id: 'centered',
    label: 'Centered',
    description: 'Balanced, in the optical centre',
    composition: { hAlign: 'center', vAlign: 'center', offset: { x: 0, y: -0.01 }, scale: 1, rotation: 0, margin: 0.08 },
    graph: { showMonths: true, showWeekdays: true },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Just the cells, quietly placed',
    composition: { hAlign: 'center', vAlign: 'center', offset: { x: 0, y: 0 }, scale: 0.78, rotation: 0, margin: 0.08 },
    container: 'none',
    graph: { showMonths: false, showWeekdays: false },
    typography: { showUsername: false, showSummary: false, showDateRange: false, showDivider: false, title: '' },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Bottom-left with a quiet caption',
    composition: { hAlign: 'left', vAlign: 'bottom', offset: { x: 0, y: 0 }, scale: 0.82, rotation: 0, margin: 0.075 },
    container: 'none',
    graph: { showMonths: true, showWeekdays: false },
    typography: { showUsername: true, showSummary: true, showDivider: true, placement: 'above', font: 'sans' },
  },
  {
    id: 'floating-glass',
    label: 'Floating glass',
    description: 'A frosted card over the artwork',
    composition: { hAlign: 'center', vAlign: 'center', offset: { x: 0, y: 0 }, scale: 0.92, rotation: 0, margin: 0.08 },
    container: 'frosted',
    graph: { showMonths: true, showWeekdays: true },
  },
  {
    id: 'asymmetric',
    label: 'Asymmetric',
    description: 'Offset right, low on the canvas',
    composition: { hAlign: 'right', vAlign: 'bottom', offset: { x: 0, y: -0.04 }, scale: 0.72, rotation: 0, margin: 0.07 },
    container: 'dark',
    graph: { showMonths: true, showWeekdays: false },
  },
  {
    id: 'full-width',
    label: 'Full width',
    description: 'Edge to edge, inside safe margins',
    composition: { hAlign: 'center', vAlign: 'center', offset: { x: 0, y: 0 }, scale: 2.5, rotation: 0, margin: 0.05 },
    container: 'none',
    graph: { showMonths: false, showWeekdays: false },
  },
]
