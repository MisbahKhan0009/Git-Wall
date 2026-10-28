/**
 * High-resolution export. Renders the complete wallpaper at the requested size
 * on a fresh canvas — independent of the on-screen preview and device pixel ratio.
 */
import type { ExportFormat, WallpaperConfig } from '@/types/config'
import type { ContributionData } from '@/types/contributions'
import { renderWallpaper } from '@/features/composition/render-wallpaper'
import { createCanvas, type Canvas } from '@/lib/canvas'

/** Conservative limits that hold across Chrome, Firefox and Safari. */
export const MAX_DIMENSION = 16384
export const MAX_PIXELS = 8192 * 8192

export class ExportError extends Error {}

export const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export function exportFilename(config: WallpaperConfig, data: ContributionData, format: ExportFormat = config.export.format) {
  const who = (data.source === 'sample' ? 'sample' : data.username ?? 'wallpaper').toLowerCase().replace(/[^a-z0-9-]/g, '')
  return `githue-${who || 'wallpaper'}-${config.canvas.width}x${config.canvas.height}.${format === 'jpeg' ? 'jpg' : format}`
}

/** Transparent wallpapers need alpha, which only PNG (and WebP) keep. */
export function effectiveFormat(config: WallpaperConfig): ExportFormat {
  if (config.gradient.transparent && config.export.format === 'jpeg') return 'png'
  return config.export.format
}

export function validateExportSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) {
    throw new ExportError('Choose a width and height of at least 16 pixels.')
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new ExportError(
      `${width} × ${height} is larger than browsers can reliably render. Try 3840 × 2160 or another size under ${MAX_DIMENSION}px per side.`,
    )
  }
}

function canvasToBlob(canvas: Canvas, mime: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: mime, quality })
  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ExportError('The browser could not encode this image. Try a lower resolution.'))),
      mime,
      quality,
    )
  })
}

export interface ExportResult {
  blob: Blob
  filename: string
  width: number
  height: number
  format: ExportFormat
}

export async function renderExport(config: WallpaperConfig, data: ContributionData): Promise<ExportResult> {
  const { width, height } = config.canvas
  validateExportSize(width, height)
  const format = effectiveFormat(config)
  let canvas: Canvas
  try {
    canvas = createCanvas(width, height)
    renderWallpaper(canvas, config, data)
  } catch (err) {
    throw new ExportError(
      `Rendering at ${width} × ${height} failed — the browser may be out of canvas memory. Try a lower resolution. (${(err as Error).message})`,
    )
  }
  const blob = await canvasToBlob(canvas, MIME[format], config.export.quality)
  if (!blob.size) throw new ExportError('The exported image was empty. Try a lower resolution.')
  // Some browsers silently fall back to PNG for unsupported types (e.g. WebP in older Safari).
  const actual = (Object.entries(MIME).find(([, m]) => m === blob.type)?.[0] as ExportFormat | undefined) ?? format
  // release memory early
  canvas.width = 1
  canvas.height = 1
  return { blob, filename: exportFilename(config, data, actual), width, height, format: actual }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
