/**
 * Contribution calendar model: day normalisation, week/weekday layout and
 * intensity levels. Pure functions, independent of any rendering.
 */
import type { ContributionDay } from '@/types/contributions'
import type { LevelMapping } from '@/types/config'

export const DAY_MS = 86_400_000

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = parseDateKey(value)
  return !Number.isNaN(d.getTime()) && toDateKey(d) === value
}

/** Today's calendar date in UTC, as a date key. */
export function todayKey(now = new Date()): string {
  return toDateKey(now)
}

/**
 * Returns exactly 365 consecutive days ending at `end` (inclusive). Days that are
 * missing from `days` are filled with zero contributions; days outside the window are dropped.
 */
export function lastYearWindow(days: ContributionDay[], end?: string): ContributionDay[] {
  const map = new Map<string, ContributionDay>()
  for (const d of days) if (isDateKey(d.date)) map.set(d.date, d)
  const endKey = end ?? (days.length ? [...map.keys()].sort().at(-1)! : todayKey())
  const endDate = parseDateKey(endKey).getTime()
  const out: ContributionDay[] = []
  for (let i = 364; i >= 0; i--) {
    const key = toDateKey(new Date(endDate - i * DAY_MS))
    const found = map.get(key)
    out.push(found ? { ...found, count: Math.max(0, Math.floor(found.count) || 0) } : { date: key, count: 0 })
  }
  return out
}

export interface CalendarCell {
  date: string
  count: number
  level: number // 0..4
  week: number // column
  weekday: number // row, 0 = Sunday
}

export interface MonthLabel {
  week: number
  label: string
}

export interface Calendar {
  cells: CalendarCell[]
  weeks: number
  months: MonthLabel[]
  total: number
  start: string
  end: string
  thresholds: number[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Thresholds (lower bounds for levels 1..4). Quantile mapping uses the
 * distribution of non-zero days so a few huge days don't flatten everything else.
 */
export function computeThresholds(counts: number[], mapping: LevelMapping): number[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b)
  if (!nonZero.length) return [1, 2, 3, 4]
  if (mapping === 'linear') {
    const max = nonZero[nonZero.length - 1]
    return [1, Math.max(2, Math.ceil(max * 0.25)), Math.max(3, Math.ceil(max * 0.5)), Math.max(4, Math.ceil(max * 0.75))]
  }
  const q = (p: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))]
  const t = [1, q(0.25), q(0.5), q(0.75)]
  // keep thresholds strictly increasing so each level is reachable when data allows
  for (let i = 1; i < t.length; i++) if (t[i] <= t[i - 1]) t[i] = t[i - 1] + 1
  return t
}

export function levelFor(count: number, thresholds: number[]): number {
  if (count <= 0) return 0
  let level = 1
  for (let i = 1; i < thresholds.length; i++) if (count >= thresholds[i]) level = i + 1
  return Math.min(4, level)
}

export function buildCalendar(days: ContributionDay[], mapping: LevelMapping = 'quantile'): Calendar {
  const window = lastYearWindow(days)
  const thresholds = computeThresholds(window.map((d) => d.count), mapping)
  const first = parseDateKey(window[0].date)
  const firstWeekday = first.getUTCDay()
  const cells: CalendarCell[] = window.map((d, i) => {
    const index = i + firstWeekday
    const level =
      mapping === 'source' && typeof d.level === 'number'
        ? Math.max(0, Math.min(4, Math.round(d.level)))
        : levelFor(d.count, thresholds)
    return {
      date: d.date,
      count: d.count,
      level: d.count > 0 ? Math.max(1, level) : 0,
      week: Math.floor(index / 7),
      weekday: index % 7,
    }
  })
  const weeks = cells[cells.length - 1].week + 1

  // Month labels sit above the first full week of each month, like GitHub.
  const months: MonthLabel[] = []
  let lastMonth = -1
  for (const c of cells) {
    if (c.weekday !== 0 && c !== cells[0]) continue
    const m = parseDateKey(c.date).getUTCMonth()
    if (m !== lastMonth) {
      lastMonth = m
      const prev = months[months.length - 1]
      if (!prev || c.week - prev.week >= 3) months.push({ week: c.week, label: MONTHS[m] })
      else prev.label = MONTHS[m]
    }
  }
  // Drop a leading label that has no room before the next one.
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift()

  return {
    cells,
    weeks,
    months,
    total: window.reduce((s, d) => s + d.count, 0),
    start: window[0].date,
    end: window[window.length - 1].date,
    thresholds,
  }
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (k: string) =>
    parseDateKey(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}
