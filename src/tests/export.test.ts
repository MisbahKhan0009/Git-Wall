import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { installNodeCanvas } from './setup-canvas'
import { setCanvasFactory, type Canvas } from '@/lib/canvas'
import { effectiveFormat, ExportError, exportFilename, renderExport, validateExportSize } from '@/features/export/export'
import { renderWallpaper } from '@/features/composition/render-wallpaper'
import { createDefaultConfig } from '@/presets/defaults'
import { sampleContributions } from '@/features/contributions/sample'
import type { WallpaperConfig } from '@/types/config'

const data = sampleContributions()

/** Node canvas with the browser's `convertToBlob`, so the real export path runs. */
function blobCanvasFactory(w: number, h: number) {
  const c = createCanvas(w, h) as unknown as Record<string, unknown>
  c.convertToBlob = async ({ type, quality }: { type: string; quality?: number }) => {
    const napi = c as unknown as { encode: (f: string, q?: number) => Promise<Buffer> }
    const fmt = type === 'image/jpeg' ? 'jpeg' : type === 'image/webp' ? 'webp' : 'png'
    const buf = await napi.encode(fmt, fmt === 'png' ? undefined : Math.round((quality ?? 0.92) * 100))
    return new Blob([new Uint8Array(buf)], { type })
  }
  return c as unknown as Canvas
}

const pngSize = async (blob: Blob) => {
  const b = new DataView(await blob.arrayBuffer())
  return { w: b.getUint32(16), h: b.getUint32(20), sig: b.getUint32(0) }
}

const small = (mut?: (c: WallpaperConfig) => void) => {
  const c = createDefaultConfig()
  c.canvas = { width: 640, height: 360 }
  mut?.(c)
  return c
}

const pixels = (cfg: WallpaperConfig) => {
  const c = createCanvas(cfg.canvas.width, cfg.canvas.height)
  renderWallpaper(c as unknown as Canvas, cfg, data)
  return c.getContext('2d').getImageData(0, 0, cfg.canvas.width, cfg.canvas.height).data
}

const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let n = 0
  for (let i = 0; i < a.length; i++) n += Math.abs(a[i] - b[i])
  return n / a.length
}

beforeAll(installNodeCanvas)
afterEach(() => {
  setCanvasFactory(null)
  installNodeCanvas()
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as Canvas)
})

describe('export', () => {
  it('renders at exactly the requested dimensions, independent of the preview', async () => {
    setCanvasFactory(blobCanvasFactory)
    for (const [w, h] of [
      [1920, 1080],
      [1000, 1000],
    ]) {
      const cfg = small((c) => (c.canvas = { width: w, height: h }))
      const res = await renderExport(cfg, data)
      const size = await pngSize(res.blob)
      expect(size.sig).toBe(0x89504e47)
      expect([size.w, size.h]).toEqual([w, h])
      expect(res.filename).toBe(`githue-sample-${w}x${h}.png`)
    }
  }, 30000)

  it('produces the selected file type', async () => {
    setCanvasFactory(blobCanvasFactory)
    const jpeg = await renderExport(small((c) => (c.export.format = 'jpeg')), data)
    const bytes = new Uint8Array(await jpeg.blob.arrayBuffer())
    expect(jpeg.blob.type).toBe('image/jpeg')
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8])
    expect(jpeg.filename.endsWith('.jpg')).toBe(true)
    const webp = await renderExport(small((c) => (c.export.format = 'webp')), data)
    expect(webp.blob.type).toBe('image/webp')
  }, 30000)

  it('falls back to PNG when transparency is enabled with JPEG', () => {
    expect(effectiveFormat(small((c) => ((c.export.format = 'jpeg'), (c.gradient.transparent = true))))).toBe('png')
    expect(effectiveFormat(small((c) => (c.export.format = 'jpeg')))).toBe('jpeg')
  })

  it('includes grain in the exported pixels', () => {
    const on = pixels(small((c) => ((c.grain.enabled = true), (c.grain.intensity = 0.6), (c.grain.opacity = 0.8))))
    const off = pixels(small((c) => (c.grain.enabled = false)))
    expect(diff(on, off)).toBeGreaterThan(1)
  })

  it('includes the glass effect in the exported pixels', () => {
    const on = pixels(small((c) => ((c.glass.enabled = true), (c.glass.coverage = 1))))
    const off = pixels(small((c) => (c.glass.enabled = false)))
    expect(diff(on, off)).toBeGreaterThan(1)
  })

  it('keeps alpha when transparency is requested and is fully opaque otherwise', () => {
    const t = pixels(small((c) => (c.gradient.transparent = true)))
    expect(t[3]).toBe(0) // top-left corner is transparent
    const o = pixels(small())
    for (let i = 3; i < o.length; i += 4 * 211) expect(o[i]).toBe(255)
  })

  it('names files after the user', () => {
    const cfg = createDefaultConfig()
    expect(exportFilename(cfg, { ...data, source: 'github', username: 'Octo-Cat' })).toBe('githue-octo-cat-3840x2160.png')
  })

  it('rejects impossible sizes with a helpful message', () => {
    expect(() => validateExportSize(20000, 20000)).toThrow(ExportError)
    expect(() => validateExportSize(10, 10)).toThrow(/at least/)
    expect(() => validateExportSize(3840, 2160)).not.toThrow()
  })

  it('turns rendering failures into a friendly error', async () => {
    setCanvasFactory(() => {
      throw new Error('out of memory')
    })
    await expect(renderExport(small(), data)).rejects.toThrow(/lower resolution/)
  })
})
