/**
 * Manual contribution import. Accepts:
 *  - JSON array: [{ "date": "2025-01-31", "count": 4 }, …]
 *  - JSON object with `contributions` (github-contributions-api format)
 *  - GitHub GraphQL `contributionCalendar` output (weeks → contributionDays)
 *  - CSV with `date,count` columns (header optional)
 */
import type { ContributionData, ContributionDay } from '@/types/contributions'
import { isDateKey } from './calendar'

export class ImportError extends Error {}

function fromRecord(r: unknown): ContributionDay | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const date = o.date ?? o.day
  const count = o.count ?? o.contributionCount ?? o.contributions
  if (!isDateKey(date)) return null
  const n = typeof count === 'string' ? Number(count) : count
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null
  const level = typeof o.level === 'number' ? o.level : undefined
  return { date, count: Math.floor(n), ...(level !== undefined ? { level } : {}) }
}

function collectJson(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const o = value as Record<string, unknown>
  if (Array.isArray(o.contributions)) return o.contributions
  if (Array.isArray(o.days)) return o.days
  // GraphQL: data.user.contributionsCollection.contributionCalendar.weeks[].contributionDays[]
  const find = (v: unknown): unknown[] | null => {
    if (!v || typeof v !== 'object') return null
    const rec = v as Record<string, unknown>
    if (Array.isArray(rec.weeks)) {
      return rec.weeks.flatMap((w) => (w && typeof w === 'object' && Array.isArray((w as Record<string, unknown>).contributionDays) ? ((w as Record<string, unknown>).contributionDays as unknown[]) : []))
    }
    for (const key of Object.keys(rec)) {
      const r = find(rec[key])
      if (r) return r
    }
    return null
  }
  return find(o) ?? []
}

export function parseContributionText(text: string): ContributionDay[] {
  const trimmed = text.trim()
  if (!trimmed) throw new ImportError('The file is empty.')
  let records: ContributionDay[] = []
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown
    try {
      json = JSON.parse(trimmed)
    } catch {
      throw new ImportError('This looks like JSON but could not be parsed.')
    }
    records = collectJson(json).map(fromRecord).filter((d): d is ContributionDay => d !== null)
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim())
    const split = (l: string) => l.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ''))
    let dateCol = 0
    let countCol = 1
    const header = split(lines[0]).map((h) => h.toLowerCase())
    if (!isDateKey(header[0]) && !isDateKey(header[1])) {
      dateCol = header.findIndex((h) => h.includes('date') || h === 'day')
      countCol = header.findIndex((h) => h.includes('count') || h.includes('contribution'))
      if (dateCol < 0 || countCol < 0) throw new ImportError('CSV needs "date" and "count" columns.')
      lines.shift()
    }
    records = lines
      .map((l) => {
        const cols = split(l)
        return fromRecord({ date: cols[dateCol], count: cols[countCol] })
      })
      .filter((d): d is ContributionDay => d !== null)
  }
  if (!records.length) throw new ImportError('No valid rows found. Expected dates as YYYY-MM-DD with a numeric count.')
  const map = new Map<string, ContributionDay>()
  for (const r of records) map.set(r.date, r)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function importedContributions(days: ContributionDay[], fileName: string, username: string | null): ContributionData {
  return {
    source: 'imported',
    sourceLabel: `Imported from ${fileName}`,
    username,
    days,
    total: days.reduce((s, d) => s + d.count, 0),
    fetchedAt: new Date().toISOString(),
  }
}

export const GRAPHQL_SNIPPET = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`
