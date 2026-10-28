import { beforeAll, describe, expect, it } from 'vitest'
import { installNodeCanvas, nodeCanvas } from './setup-canvas'
import { buildCalendar, computeThresholds, lastYearWindow, levelFor, parseDateKey } from '@/features/contributions/calendar'
import { generateSampleDays } from '@/features/contributions/sample'
import { parseContributionText, ImportError } from '@/features/contributions/import'
import { parseContributionsResponse, isValidUsername } from '@/features/github/api'
import { computeLayout } from '@/features/composition/layout'
import { renderWallpaper } from '@/features/composition/render-wallpaper'
import { createDefaultConfig } from '@/presets/defaults'
import type { ContributionData } from '@/types/contributions'
import type { WallpaperConfig } from '@/types/config'

beforeAll(installNodeCanvas)

const days = generateSampleDays('2026-10-28')
const data: ContributionData = { source: 'sample', sourceLabel: 'test', username: null, days, total: days.reduce((s, d) => s + d.count, 0), fetchedAt: '' }

describe('calendar', () => {
  it('covers exactly 365 consecutive days ending on the last day', () => {
    const cal = buildCalendar(days)
    expect(cal.cells).toHaveLength(365)
    expect(cal.end).toBe('2026-10-28')
    expect(cal.start).toBe('2025-10-29')
    for (let i = 1; i < cal.cells.length; i++) {
      expect(parseDateKey(cal.cells[i].date).getTime() - parseDateKey(cal.cells[i - 1].date).getTime()).toBe(86_400_000)
    }
  })

  it('aligns every day to its real weekday and week column', () => {
    const cal = buildCalendar(days)
    for (const c of cal.cells) expect(c.weekday).toBe(parseDateKey(c.date).getUTCDay())
    // a new week column starts on every Sunday
    for (let i = 1; i < cal.cells.length; i++) {
      const prev = cal.cells[i - 1]
      const cur = cal.cells[i]
      expect(cur.week).toBe(cur.weekday === 0 ? prev.week + 1 : prev.week)
    }
    expect(cal.weeks).toBeGreaterThanOrEqual(53)
    expect(cal.weeks).toBeLessThanOrEqual(54)
  })

  it('fills missing days with zero and drops days outside the window', () => {
    const w = lastYearWindow([{ date: '2026-01-10', count: 5 }, { date: '2020-01-01', count: 99 }], '2026-03-01')
    expect(w).toHaveLength(365)
    expect(w.find((d) => d.date === '2026-01-10')?.count).toBe(5)
    expect(w.filter((d) => d.count > 0)).toHaveLength(1)
  })

  it('places month labels on increasing columns', () => {
    const cal = buildCalendar(days)
    expect(cal.months.length).toBeGreaterThanOrEqual(11)
    for (let i = 1; i < cal.months.length; i++) expect(cal.months[i].week).toBeGreaterThan(cal.months[i - 1].week)
  })
})

describe('intensity mapping', () => {
  it('maps zero to level 0 and any contribution to at least level 1', () => {
    const cal = buildCalendar(days)
    for (const c of cal.cells) {
      if (c.count === 0) expect(c.level).toBe(0)
      else expect(c.level).toBeGreaterThanOrEqual(1)
    }
  })

  it('uses quantiles of active days and reaches level 4 for the busiest day', () => {
    const counts = [0, 0, 1, 1, 2, 3, 4, 5, 8, 13, 40]
    const t = computeThresholds(counts, 'quantile')
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1])
    expect(levelFor(40, t)).toBe(4)
    expect(levelFor(1, t)).toBe(1)
    expect(levelFor(0, t)).toBe(0)
    // levels never decrease as counts grow
    let last = 0
    for (let n = 0; n <= 50; n++) {
      const l = levelFor(n, t)
      expect(l).toBeGreaterThanOrEqual(last)
      last = l
    }
  })

  it('supports linear and source-provided levels', () => {
    const t = computeThresholds([0, 10, 20, 40], 'linear')
    expect(levelFor(40, t)).toBe(4)
    const cal = buildCalendar([{ date: '2026-01-01', count: 3, level: 2 }], 'source')
    expect(cal.cells.find((c) => c.date === '2026-01-01')?.level).toBe(2)
  })
})

describe('data import & API parsing', () => {
  it('parses JSON arrays, API responses, GraphQL output and CSV', () => {
    expect(parseContributionText('[{"date":"2026-01-02","count":3}]')).toEqual([{ date: '2026-01-02', count: 3 }])
    expect(parseContributionText('{"contributions":[{"date":"2026-01-02","count":4,"level":2}]}')[0]).toMatchObject({ count: 4, level: 2 })
    const gql = { data: { user: { contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: [{ date: '2026-01-03', contributionCount: 7 }] }] } } } } }
    expect(parseContributionText(JSON.stringify(gql))).toEqual([{ date: '2026-01-03', count: 7 }])
    expect(parseContributionText('date,count\n2026-01-04,2\n2026-01-05,0')).toHaveLength(2)
    expect(parseContributionText('2026-01-04;9')).toEqual([{ date: '2026-01-04', count: 9 }])
  })

  it('rejects malformed files with a clear error', () => {
    expect(() => parseContributionText('')).toThrow(ImportError)
    expect(() => parseContributionText('{oops')).toThrow(ImportError)
    expect(() => parseContributionText('name,value\nx,y')).toThrow(ImportError)
    expect(() => parseContributionText('[{"date":"2026-02-31","count":1}]')).toThrow(ImportError)
  })

  it('validates the contribution service response', () => {
    expect(parseContributionsResponse({ contributions: [{ date: '2026-01-01', count: 2, level: 1 }] })).toHaveLength(1)
    expect(() => parseContributionsResponse({ error: 'nope' })).toThrow()
    expect(isValidUsername('octocat')).toBe(true)
    expect(isValidUsername('a-b-c')).toBe(true)
    expect(isValidUsername('-bad')).toBe(false)
    expect(isValidUsername('bad--name')).toBe(false)
    expect(isValidUsername('x'.repeat(40))).toBe(false)
  })
})

describe('graph rendering', () => {
  const plain = (): WallpaperConfig => {
    const c = createDefaultConfig()
    c.gradient.transparent = true
    c.glass.enabled = false
    c.grain.enabled = false
    c.container.style = 'none'
    c.graph = { ...c.graph, glow: 0, shadow: 0, blur: 0, opacity: 1, cellOpacity: 1, shape: 'square', borderWidth: 0 }
    return c
  }
  const pixelAt = (cfg: WallpaperConfig, date: string, w = 1920, h = 1080) => {
    const canvas = nodeCanvas(w, h)
    const { layout, calendar } = renderWallpaper(canvas, cfg, data)
    const cell = calendar.cells.find((c) => c.date === date)!
    const x = layout.box.x + layout.padding + layout.grid.x + cell.week * layout.step + layout.cell / 2
    const y = layout.box.y + layout.padding + layout.grid.y + cell.weekday * layout.step + layout.cell / 2
    const d = (canvas.getContext('2d') as CanvasRenderingContext2D).getImageData(Math.round(x), Math.round(y), 1, 1).data
    return { rgba: [...d], cell }
  }

  it('applies custom colours to every intensity level', () => {
    const cfg = plain()
    cfg.graph.levels = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00']
    const cal = buildCalendar(days)
    for (const level of [1, 2, 3, 4]) {
      const cell = cal.cells.find((c) => c.level === level)!
      const { rgba } = pixelAt(cfg, cell.date)
      const hex = '#' + rgba.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')
      expect(hex).toBe(cfg.graph.levels[level])
    }
  })

  it('keeps empty days visible yet distinct from active days', () => {
    const cfg = plain()
    const cal = buildCalendar(days)
    const empty = pixelAt(cfg, cal.cells.find((c) => c.level === 0)!.date)
    const active = pixelAt(cfg, cal.cells.find((c) => c.level === 1)!.date)
    expect(empty.rgba[3]).toBeGreaterThan(0) // visible
    expect(empty.rgba[3]).toBeLessThan(80) // but quiet
    expect(empty.rgba).not.toEqual(active.rgba)
  })

  it('scales geometry with the resolution', () => {
    const cfg = createDefaultConfig()
    const cal = buildCalendar(days)
    const a = computeLayout(cfg, cal, null, 1920, 1080)
    const b = computeLayout(cfg, cal, null, 3840, 2160)
    expect(b.cell).toBeCloseTo(a.cell * 2, 6)
    expect(b.box.w).toBeCloseTo(a.box.w * 2, 6)
    expect(b.box.x).toBeCloseTo(a.box.x * 2, 6)
    expect(b.center.y).toBeCloseTo(a.center.y * 2, 6)
  })
})
