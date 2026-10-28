/**
 * Contribution graph & container renderer. Draws purely from the layout and
 * config — never from the DOM — so preview and export are identical.
 */
import type { WallpaperConfig } from '@/types/config'
import type { Calendar } from '@/features/contributions/calendar'
import type { GraphLayout } from '@/features/composition/layout'
import { FONT_SANS, fontString } from '@/features/composition/layout'
import { createCanvas, drawBlurred, get2d, roundRectPath, type Canvas, type Ctx } from '@/lib/canvas'
import { rgba } from '@/lib/color'
import { clamp } from '@/lib/math'

const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

/** Axis-aligned bounds of the (rotated) block, expanded by `margin` and clipped to the canvas. */
export function boxBounds(layout: GraphLayout, margin: number, width: number, height: number) {
  const { w, h } = layout.box
  const cos = Math.abs(Math.cos(layout.rotation))
  const sin = Math.abs(Math.sin(layout.rotation))
  const hw = (w * cos + h * sin) / 2 + margin
  const hh = (w * sin + h * cos) / 2 + margin
  const x = Math.max(0, Math.floor(layout.center.x - hw))
  const y = Math.max(0, Math.floor(layout.center.y - hh))
  const x2 = Math.min(width, Math.ceil(layout.center.x + hw))
  const y2 = Math.min(height, Math.ceil(layout.center.y + hh))
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) }
}

/** Moves the context into the block's rotated local frame (origin = box top-left). */
function enterBox(ctx: Ctx, layout: GraphLayout) {
  ctx.translate(layout.center.x, layout.center.y)
  ctx.rotate(layout.rotation)
  ctx.translate(-layout.box.w / 2, -layout.box.h / 2)
}

export function drawContainer(ctx: Ctx, config: WallpaperConfig, layout: GraphLayout, backdrop: Canvas | null, width: number, height: number) {
  const c = config.container
  if (c.style === 'none') return
  const s = layout.unit * layout.scale
  const { w, h } = layout.box
  const radius = c.radius * s

  // Shadow outside the card only (like CSS box-shadow), so translucent cards stay clean.
  if (c.shadow > 0) {
    const r = boxBounds(layout, 110 * s, width, height)
    const tmp = createCanvas(r.w, r.h)
    const t = get2d(tmp)
    t.save()
    t.translate(-r.x, -r.y)
    enterBox(t, layout)
    t.shadowColor = `rgba(0,0,0,${(0.55 * clamp(c.shadow)).toFixed(3)})`
    t.shadowBlur = 70 * s
    t.shadowOffsetY = 22 * s
    t.fillStyle = '#000'
    roundRectPath(t, 0, 0, w, h, radius)
    t.fill()
    t.shadowColor = 'transparent'
    t.globalCompositeOperation = 'destination-out'
    roundRectPath(t, 0, 0, w, h, radius)
    t.fill()
    t.restore()
    ctx.drawImage(tmp as CanvasImageSource, r.x, r.y)
  }

  ctx.save()
  enterBox(ctx, layout)
  roundRectPath(ctx, 0, 0, w, h, radius)
  ctx.clip()

  // Real backdrop blur: the actual rendered scene behind the card, blurred.
  if (backdrop && c.blur > 0.5) {
    const r = c.blur * s
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const diag = Math.hypot(w, h) / 2 + r * 3
    const ax = Math.max(0, layout.center.x - diag)
    const ay = Math.max(0, layout.center.y - diag)
    const aw = Math.min(width, layout.center.x + diag) - ax
    const ah = Math.min(height, layout.center.y + diag) - ay
    if (aw > 0 && ah > 0) drawBlurred(ctx, backdrop, r, ax, ay, aw, ah, ax, ay, aw, ah)
    ctx.restore()
  }

  if (c.opacity > 0) {
    ctx.fillStyle = rgba(c.color, c.opacity)
    ctx.fillRect(0, 0, w, h)
  }
  if (c.highlight > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, `rgba(255,255,255,${(0.16 * c.highlight).toFixed(3)})`)
    g.addColorStop(0.35, 'rgba(255,255,255,0)')
    g.addColorStop(1, `rgba(255,255,255,${(0.03 * c.highlight).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()

  // Border (and a top specular edge when highlights are on)
  ctx.save()
  enterBox(ctx, layout)
  if (c.borderWidth > 0 && c.borderOpacity > 0) {
    const bw = c.borderWidth * s
    ctx.lineWidth = bw
    ctx.strokeStyle = rgba(c.borderColor, c.borderOpacity)
    roundRectPath(ctx, bw / 2, bw / 2, w - bw, h - bw, Math.max(0, radius - bw / 2))
    ctx.stroke()
  }
  if (c.highlight > 0) {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(255,255,255,${(0.45 * c.highlight).toFixed(3)})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = Math.max(1, s)
    ctx.beginPath()
    ctx.moveTo(radius, s * 0.5)
    ctx.lineTo(w - radius, s * 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

/** Draws cells and labels into `ctx` (expected to be a dedicated, cleared layer). */
export function drawGraphCells(ctx: Ctx, config: WallpaperConfig, calendar: Calendar, layout: GraphLayout) {
  const g = config.graph
  const { cell, step } = layout
  ctx.save()
  enterBox(ctx, layout)
  ctx.translate(layout.padding, layout.padding)

  const ox = layout.grid.x
  const oy = layout.grid.y
  const radius = g.shape === 'square' ? 0 : g.shape === 'circle' ? cell / 2 : clamp(g.radius, 0, 0.5) * cell
  const bw = g.borderWidth * layout.unit * layout.scale
  const border = bw > 0 && g.borderOpacity > 0 ? rgba(g.borderColor, g.borderOpacity) : null
  const fills = g.levels.map((hex, i) => rgba(hex, clamp(g.cellOpacity) * (i === 0 ? g.emptyOpacity : 1)))

  for (const c of calendar.cells) {
    const x = ox + c.week * step
    const y = oy + c.weekday * step
    ctx.fillStyle = fills[c.level]
    if (radius <= 0.01) ctx.fillRect(x, y, cell, cell)
    else if (g.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(x + cell / 2, y + cell / 2, cell / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      roundRectPath(ctx, x, y, cell, cell, radius)
      ctx.fill()
    }
    if (border) {
      ctx.strokeStyle = border
      ctx.lineWidth = bw
      if (g.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(x + cell / 2, y + cell / 2, cell / 2 - bw / 2, 0, Math.PI * 2)
      } else roundRectPath(ctx, x + bw / 2, y + bw / 2, cell - bw, cell - bw, Math.max(0, radius - bw / 2))
      ctx.stroke()
    }
  }

  // Labels
  if (g.showMonths || g.showWeekdays) {
    ctx.fillStyle = rgba(g.labelColor, g.labelOpacity)
    ctx.font = fontString(450, layout.labelSize, FONT_SANS)
    ctx.textBaseline = 'alphabetic'
    if (g.showMonths) {
      ctx.textAlign = 'left'
      for (const m of calendar.months) ctx.fillText(m.label, ox + m.week * step, oy - layout.labelSize * 0.7)
    }
    if (g.showWeekdays) {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      WEEKDAYS.forEach((d, i) => {
        if (d) ctx.fillText(d, ox - layout.labelSize * 0.6, oy + i * step + cell / 2)
      })
    }
  }
  ctx.restore()
}

export function drawText(ctx: Ctx, config: WallpaperConfig, layout: GraphLayout) {
  const t = config.typography
  if (!layout.lines.length) return
  ctx.save()
  enterBox(ctx, layout)
  ctx.translate(layout.padding, layout.padding)
  const x = layout.textAlign === 'left' ? 0 : layout.textAlign === 'right' ? layout.content.w : layout.content.w / 2
  ctx.textAlign = layout.textAlign
  ctx.textBaseline = 'top'
  for (const l of layout.lines) {
    ctx.font = fontString(l.weight, l.size, l.family)
    ctx.fillStyle = rgba(t.color, clamp(t.opacity * l.alpha))
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = `${(l.tracking * l.size).toFixed(2)}px`
    ctx.fillText(l.text, x, l.y + (l.height - l.size) / 2)
  }
  if (layout.divider) {
    const dw = layout.divider.w
    const dx = layout.textAlign === 'left' ? 0 : layout.textAlign === 'right' ? layout.content.w - dw : (layout.content.w - dw) / 2
    ctx.fillStyle = rgba(t.color, clamp(t.opacity * 0.35))
    ctx.fillRect(dx, layout.divider.y, dw, Math.max(1, layout.unit * layout.scale))
  }
  ctx.restore()
}

/**
 * Composites the graph layer onto `ctx` with shadow, glow, blur and opacity.
 */
export function compositeGraphLayer(ctx: Ctx, layer: Canvas, origin: { x: number; y: number }, config: WallpaperConfig, layout: GraphLayout) {
  const g = config.graph
  const opacity = clamp(g.opacity)
  if (opacity <= 0) return
  const cell = layout.cell
  const { x, y } = origin
  const lw = layer.width
  const lh = layer.height

  if (g.shadow > 0) {
    const tmp = createCanvas(lw, lh)
    const t = get2d(tmp)
    drawBlurred(t, layer, cell * 0.45 * (0.5 + g.shadow))
    t.globalCompositeOperation = 'source-in'
    t.fillStyle = '#000'
    t.fillRect(0, 0, lw, lh)
    ctx.save()
    ctx.globalAlpha = clamp(g.shadow * 0.85 * opacity)
    ctx.drawImage(tmp as CanvasImageSource, x, y + cell * 0.22)
    ctx.restore()
  }

  if (g.glow > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = clamp(g.glow * opacity)
    drawBlurred(ctx, layer, cell * (0.6 + g.glow * 0.9), 0, 0, lw, lh, x, y, lw, lh)
    ctx.globalAlpha = clamp(g.glow * opacity * 0.6)
    drawBlurred(ctx, layer, cell * 0.25, 0, 0, lw, lh, x, y, lw, lh)
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = opacity
  drawBlurred(ctx, layer, g.blur * layout.unit * layout.scale, 0, 0, lw, lh, x, y, lw, lh)
  ctx.restore()
}
