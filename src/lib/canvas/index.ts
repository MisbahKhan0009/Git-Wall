/**
 * Thin canvas abstraction so every renderer works with an HTMLCanvasElement,
 * an OffscreenCanvas (workers), or a Node canvas in tests.
 */
export type Canvas = HTMLCanvasElement | OffscreenCanvas
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type CanvasFactory = (width: number, height: number) => Canvas

const defaultFactory: CanvasFactory = (width, height) => {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  throw new Error('No canvas implementation available')
}

let factory: CanvasFactory = defaultFactory

export function setCanvasFactory(next: CanvasFactory | null) {
  factory = next ?? defaultFactory
  filterSupport = null
}

export function createCanvas(width: number, height: number): Canvas {
  return factory(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
}

export function get2d(canvas: Canvas, opts?: CanvasRenderingContext2DSettings): Ctx {
  const ctx = canvas.getContext('2d', opts) as Ctx | null
  if (!ctx) throw new Error('Canvas 2D context is not available (the canvas may be too large).')
  return ctx
}

let filterSupport: boolean | null = null

/** Detects real `ctx.filter` support (Safari historically ignores it silently). */
export function supportsCanvasFilter(): boolean {
  if (filterSupport !== null) return filterSupport
  try {
    const c = createCanvas(9, 9)
    const ctx = get2d(c)
    ctx.filter = 'blur(2px)'
    ctx.fillStyle = '#fff'
    ctx.fillRect(4, 4, 1, 1)
    ctx.filter = 'none'
    filterSupport = ctx.getImageData(2, 4, 1, 1).data[3] > 0
  } catch {
    filterSupport = false
  }
  return filterSupport
}

/**
 * Draws `source` into `ctx` blurred by `radius` px. Uses `ctx.filter` where
 * supported and a multi-step downscale/upscale blur everywhere else, so the
 * same effect is always rendered (never silently dropped).
 */
export function drawBlurred(
  ctx: Ctx,
  source: Canvas,
  radius: number,
  sx = 0,
  sy = 0,
  sw = source.width,
  sh = source.height,
  dx = 0,
  dy = 0,
  dw = sw,
  dh = sh,
) {
  if (radius < 0.5) {
    ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, dx, dy, dw, dh)
    return
  }
  if (supportsCanvasFilter()) {
    const prev = ctx.filter
    ctx.filter = `blur(${radius.toFixed(2)}px)`
    ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, dx, dy, dw, dh)
    ctx.filter = prev
    return
  }
  const factor = Math.max(1, radius / 1.5)
  const w = Math.max(1, Math.round(sw / factor))
  const h = Math.max(1, Math.round(sh / factor))
  const small = createCanvas(w, h)
  const sctx = get2d(small)
  sctx.imageSmoothingEnabled = true
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, w, h)
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small as CanvasImageSource, 0, 0, w, h, dx, dy, dw, dh)
  ctx.imageSmoothingEnabled = prevSmoothing
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

/** Reference unit: 1 at 1080p, 2 at 4K. All "reference px" values scale by this. */
export function referenceUnit(width: number, height: number): number {
  return Math.min(width, height) / 1080
}
