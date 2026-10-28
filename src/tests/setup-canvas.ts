import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { createRequire } from 'node:module'
import { setCanvasFactory, type Canvas } from '@/lib/canvas'

const require = createRequire(import.meta.url)

let installed = false
/** Routes the renderers to a real Skia canvas so tests exercise actual pixels. */
export function installNodeCanvas() {
  if (installed) return
  installed = true
  setCanvasFactory((w, h) => createCanvas(w, h) as unknown as Canvas)
  try {
    GlobalFonts.registerFromPath(require.resolve('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'), 'Geist Variable')
    GlobalFonts.registerFromPath(require.resolve('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'), 'Geist Mono Variable')
  } catch {
    // fonts are cosmetic in tests
  }
}

export function nodeCanvas(w: number, h: number): Canvas {
  return createCanvas(w, h) as unknown as Canvas
}
