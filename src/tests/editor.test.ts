import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { installNodeCanvas, nodeCanvas } from './setup-canvas'
import { defaultConfig, useEditor } from '@/store/editor'
import { renderWallpaper, createRenderCache } from '@/features/composition/render-wallpaper'
import { computeLayout } from '@/features/composition/layout'
import { buildCalendar } from '@/features/contributions/calendar'

beforeAll(installNodeCanvas)

const reset = () =>
  useEditor.setState({ config: defaultConfig(), past: [], future: [], lastCoalesce: null, presets: [], activePresetId: null, savedSnapshot: null })

beforeEach(reset)

const renderHash = () => {
  const { config, data } = useEditor.getState()
  const c = nodeCanvas(480, 270)
  renderWallpaper(c, config, data, createRenderCache())
  const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, 480, 270).data
  return createHash('sha1').update(d).digest('hex')
}

describe('controls update the real render', () => {
  const cases: [string, () => void][] = [
    ['gradient type', () => useEditor.getState().patch('gradient', { type: 'linear' })],
    ['stop colour', () => useEditor.getState().updateStop(useEditor.getState().config.gradient.stops[0].id, { color: '#ff0000' })],
    ['gradient angle', () => useEditor.getState().patch('gradient', { type: 'linear', angle: 10 })],
    ['grain intensity', () => useEditor.getState().patch('grain', { intensity: 1, opacity: 1 })],
    ['glass style', () => useEditor.getState().patch('glass', { style: 'geometric' })],
    ['graph cell size', () => useEditor.getState().patch('graph', { cellSize: 20 })],
    ['graph opacity', () => useEditor.getState().patch('graph', { opacity: 0.3 })],
    ['graph radius', () => useEditor.getState().patch('graph', { radius: 0 })],
    ['container style', () => useEditor.getState().setContainerStyle('light')],
    ['container blur', () => useEditor.getState().patch('container', { blur: 0 })],
    ['composition', () => useEditor.getState().applyCompositionPreset('editorial')],
    ['rotation', () => useEditor.getState().patch('composition', { rotation: 6 })],
    ['typography', () => useEditor.getState().patch('typography', { title: 'Hello' })],
    ['palette preset', () => useEditor.getState().applyPalettePreset('ember')],
  ]
  it.each(cases)('%s changes the rendered pixels', (_, act) => {
    const before = renderHash()
    act()
    expect(renderHash()).not.toBe(before)
  })
})

describe('history', () => {
  it('undo and redo restore exact previous settings', () => {
    const s = useEditor.getState
    const original = s().config
    s().patch('graph', { cellSize: 18 })
    const second = s().config
    s().randomize('all', 777)
    const third = s().config
    s().undo()
    expect(s().config).toEqual(second)
    s().undo()
    expect(s().config).toEqual(original)
    s().redo()
    s().redo()
    expect(s().config).toEqual(third)
  })

  it('coalesces a slider drag into one undo step', () => {
    const s = useEditor.getState
    const original = s().config
    for (let i = 0; i < 20; i++) s().patch('grain', { intensity: i / 20 }, { coalesce: 'grain.intensity' })
    expect(s().past).toHaveLength(1)
    s().undo()
    expect(s().config).toEqual(original)
  })

  it('clears redo after a new edit', () => {
    const s = useEditor.getState
    s().patch('graph', { gap: 2 })
    s().undo()
    s().patch('graph', { gap: 6 })
    expect(s().future).toHaveLength(0)
  })
})

describe('presets & reset', () => {
  it('restores a saved composition exactly', () => {
    const s = useEditor.getState
    s().randomize('all', 4242)
    s().savePreset('Mine')
    const saved = structuredClone(s().config)
    const id = s().activePresetId!
    s().randomize('all', 1)
    s().patch('composition', { scale: 0.5 })
    s().loadPreset(id)
    expect(s().config).toEqual(saved)
    s().renamePreset(id, 'Renamed')
    expect(s().presets[0].name).toBe('Renamed')
    s().duplicatePreset(id)
    expect(s().presets).toHaveLength(2)
    s().deletePreset(id)
    expect(s().presets.map((p) => p.name)).toEqual(['Renamed copy'])
  })

  it('restore defaults returns to the default configuration (keeping export size)', () => {
    const s = useEditor.getState
    s().patch('canvas', { width: 2560, height: 1440 })
    s().randomize('all', 99)
    s().restoreDefaults()
    const d = defaultConfig()
    expect({ ...s().config, gradient: { ...s().config.gradient, stops: [] } }).toEqual({ ...d, canvas: { width: 2560, height: 1440 }, gradient: { ...d.gradient, stops: [] } })
    expect(s().config.gradient.stops.map((x) => x.color)).toEqual(d.gradient.stops.map((x) => x.color))
  })

  it('composition presets change layout without touching the palette', () => {
    const s = useEditor.getState
    const stops = s().config.gradient.stops
    s().applyCompositionPreset('asymmetric')
    expect(s().config.gradient.stops).toEqual(stops)
    expect(s().config.composition.hAlign).toBe('right')
  })

  it('keeps at least two colour stops', () => {
    const s = useEditor.getState
    while (s().config.gradient.stops.length > 2) s().removeStop(s().config.gradient.stops[0].id)
    s().removeStop(s().config.gradient.stops[0].id)
    expect(s().config.gradient.stops).toHaveLength(2)
  })
})

describe('aspect ratios', () => {
  it.each([
    [1920, 1080],
    [3440, 1440],
    [2160, 2160],
    [1290, 2796],
    [2048, 1536],
  ])('keeps cells square and the graph inside the canvas at %i×%i', (w, h) => {
    const { config, data } = useEditor.getState()
    const cfg = { ...config, composition: { ...config.composition, scale: 2.5 } }
    const layout = computeLayout(cfg, buildCalendar(data.days), null, w, h)
    // cells are drawn as cell × cell squares; the box must fit the safe area
    expect(layout.cell).toBeGreaterThan(0)
    expect(layout.box.x).toBeGreaterThanOrEqual(-0.5)
    expect(layout.box.y).toBeGreaterThanOrEqual(-0.5)
    expect(layout.box.x + layout.box.w).toBeLessThanOrEqual(w + 0.5)
    expect(layout.box.y + layout.box.h).toBeLessThanOrEqual(h + 0.5)
    expect(layout.grid.w / layout.grid.h).toBeCloseTo((layout.step * buildCalendar(data.days).weeks - layout.gap) / (layout.step * 7 - layout.gap), 6)
  })
})
