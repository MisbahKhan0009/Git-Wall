/**
 * Resolution-independent layout of the graph block (container, labels, text).
 * All sizes are expressed in reference pixels (1080p) and multiplied by the
 * reference unit, so a layout looks identical at 1080p and at 4K, and the
 * graph's cells always stay square regardless of aspect ratio.
 */
import type { WallpaperConfig } from '@/types/config'
import type { Calendar } from '@/features/contributions/calendar'
import { formatDateRange } from '@/features/contributions/calendar'
import { referenceUnit } from '@/lib/canvas'
import { deg2rad } from '@/lib/math'

export const FONT_SANS = '"Geist Variable", "Geist", Inter, ui-sans-serif, system-ui, -apple-system, sans-serif'
export const FONT_MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

export interface TextLine {
  text: string
  size: number
  weight: number
  family: string
  alpha: number
  tracking: number
  y: number // top, relative to the content box
  height: number
}

export interface GraphLayout {
  unit: number
  scale: number
  cell: number
  gap: number
  step: number
  labelSize: number
  weekdayWidth: number
  monthHeight: number
  grid: { x: number; y: number; w: number; h: number } // relative to the content box
  content: { w: number; h: number }
  padding: number
  box: { x: number; y: number; w: number; h: number } // in canvas space (before rotation)
  center: { x: number; y: number }
  rotation: number // radians
  lines: TextLine[]
  divider: { y: number; w: number } | null
  textAlign: 'left' | 'center' | 'right'
}

export type Measure = (text: string, font: string) => number

const defaultMeasure: Measure = (text, font) => {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '16')
  return text.length * size * 0.56
}

export function fontString(weight: number, size: number, family: string) {
  return `${weight} ${size.toFixed(2)}px ${family}`
}

export function summaryText(total: number) {
  return `${total.toLocaleString('en-US')} contribution${total === 1 ? '' : 's'} in the last year`
}

export function buildTextLines(config: WallpaperConfig, calendar: Calendar, username: string | null) {
  const t = config.typography
  const family = t.font === 'mono' ? FONT_MONO : FONT_SANS
  const lines: Omit<TextLine, 'y' | 'height'>[] = []
  if (t.title.trim()) lines.push({ text: t.title.trim().slice(0, 80), size: t.size * 1.55, weight: 600, family, alpha: 1, tracking: -0.01 })
  if (t.showUsername && username) lines.push({ text: `@${username}`, size: t.size, weight: 550, family, alpha: 0.95, tracking: 0 })
  if (t.showSummary) lines.push({ text: summaryText(calendar.total), size: t.size * 0.82, weight: 420, family, alpha: 0.7, tracking: 0 })
  if (t.showDateRange) lines.push({ text: formatDateRange(calendar.start, calendar.end), size: t.size * 0.68, weight: 420, family: FONT_MONO, alpha: 0.55, tracking: 0.02 })
  return lines
}

export function computeLayout(
  config: WallpaperConfig,
  calendar: Calendar,
  username: string | null,
  width: number,
  height: number,
  measure: Measure = defaultMeasure,
): GraphLayout {
  const { graph, composition, container, typography } = config
  const unit = referenceUnit(width, height)
  const hasContainer = container.style !== 'none'

  // Measure everything at scale 1, then derive the effective scale.
  const at = (s: number) => {
    const cell = graph.cellSize * unit * s
    const gap = graph.gap * unit * s
    const step = cell + gap
    const labelSize = Math.max(graph.cellSize * 0.7, 9) * unit * s
    const weekdayWidth = graph.showWeekdays ? labelSize * 2.5 : 0
    const monthHeight = graph.showMonths ? labelSize * 1.8 : 0
    const gridW = calendar.weeks * step - gap
    const gridH = 7 * step - gap
    const textSpecs = buildTextLines(config, calendar, username)
    let textH = 0
    let textW = 0
    const lineGap = typography.size * unit * s * 0.35
    const lines: TextLine[] = textSpecs.map((l) => {
      const size = l.size * unit * s
      const h = size * 1.25
      const line = { ...l, size, y: textH, height: h }
      textH += h + lineGap
      textW = Math.max(textW, measure(l.text, fontString(l.weight, size, l.family)))
      return line
    })
    if (lines.length) textH -= lineGap
    const dividerSpace = typography.showDivider ? typography.size * unit * s * 1.6 : 0
    const blockGap = lines.length ? typography.size * unit * s * (typography.showDivider ? 0.2 : 1.1) : 0
    const graphW = weekdayWidth + gridW
    const graphH = monthHeight + gridH
    const contentW = Math.max(graphW, textW)
    const contentH = graphH + (lines.length ? textH + blockGap + dividerSpace : 0)
    const padding = hasContainer ? container.padding * unit * s : 0
    return { cell, gap, step, labelSize, weekdayWidth, monthHeight, gridW, gridH, lines, textH, blockGap, dividerSpace, graphW, graphH, contentW, contentH, padding }
  }

  const base = at(1)
  const margin = composition.margin * Math.min(width, height)
  const availW = Math.max(10, width - margin * 2)
  const availH = Math.max(10, height - margin * 2)
  const rot = deg2rad(composition.rotation)
  const bw1 = base.contentW + base.padding * 2
  const bh1 = base.contentH + base.padding * 2
  const aabbW = Math.abs(bw1 * Math.cos(rot)) + Math.abs(bh1 * Math.sin(rot))
  const aabbH = Math.abs(bw1 * Math.sin(rot)) + Math.abs(bh1 * Math.cos(rot))
  const scale = Math.max(0.05, Math.min(composition.scale, availW / aabbW, availH / aabbH))
  const m = at(scale)

  const boxW = m.contentW + m.padding * 2
  const boxH = m.contentH + m.padding * 2
  // rotation needs room too: position the rotated AABB inside the margins
  const rw = Math.abs(boxW * Math.cos(rot)) + Math.abs(boxH * Math.sin(rot))
  const rh = Math.abs(boxW * Math.sin(rot)) + Math.abs(boxH * Math.cos(rot))
  let cx = composition.hAlign === 'left' ? margin + rw / 2 : composition.hAlign === 'right' ? width - margin - rw / 2 : width / 2
  let cy = composition.vAlign === 'top' ? margin + rh / 2 : composition.vAlign === 'bottom' ? height - margin - rh / 2 : height / 2
  cx += composition.offset.x * width
  cy += composition.offset.y * height

  const textAlign = composition.hAlign === 'left' ? 'left' : composition.hAlign === 'right' ? 'right' : 'center'
  const above = typography.placement === 'above'
  const textBlockH = m.lines.length ? m.textH + m.blockGap + m.dividerSpace : 0
  const graphY = above ? textBlockH : 0
  const textY = above ? 0 : m.graphH + m.blockGap + m.dividerSpace
  const graphX = textAlign === 'left' ? 0 : textAlign === 'right' ? m.contentW - m.graphW : (m.contentW - m.graphW) / 2

  const lines = m.lines.map((l) => ({ ...l, y: l.y + textY }))
  const divider =
    typography.showDivider && m.lines.length
      ? { y: above ? m.textH + m.blockGap + m.dividerSpace / 2 : m.graphH + m.dividerSpace / 2, w: Math.min(m.graphW, 120 * unit * scale) }
      : null

  return {
    unit,
    scale,
    cell: m.cell,
    gap: m.gap,
    step: m.step,
    labelSize: m.labelSize,
    weekdayWidth: m.weekdayWidth,
    monthHeight: m.monthHeight,
    grid: { x: graphX + m.weekdayWidth, y: graphY + m.monthHeight, w: m.gridW, h: m.gridH },
    content: { w: m.contentW, h: m.contentH },
    padding: m.padding,
    box: { x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH },
    center: { x: cx, y: cy },
    rotation: rot,
    lines,
    divider,
    textAlign,
  }
}
