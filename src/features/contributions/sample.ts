import type { ContributionData, ContributionDay } from '@/types/contributions'
import { createRng } from '@/lib/random'
import { DAY_MS, toDateKey, todayKey, parseDateKey } from './calendar'

/**
 * A realistic, deterministic sample year: weekday rhythm, streaks, quiet
 * weeks and a few bursts. Always labelled as sample data in the interface.
 */
export function generateSampleDays(end = todayKey(), seed = 20240917): ContributionDay[] {
  const rng = createRng(seed)
  const endMs = parseDateKey(end).getTime()
  const days: ContributionDay[] = []
  let momentum = 0.5
  let vacation = 0
  for (let i = 364; i >= 0; i--) {
    const date = new Date(endMs - i * DAY_MS)
    const weekday = date.getUTCDay()
    if (vacation > 0) {
      vacation--
      days.push({ date: toDateKey(date), count: rng.next() < 0.08 ? 1 : 0 })
      continue
    }
    if (rng.next() < 0.012) vacation = rng.int(4, 11)
    momentum = Math.min(1, Math.max(0.05, momentum + rng.range(-0.18, 0.18)))
    const weekend = weekday === 0 || weekday === 6
    const activeChance = (weekend ? 0.35 : 0.86) * (0.55 + momentum * 0.5)
    let count = 0
    if (rng.next() < activeChance) {
      count = Math.round(1 + rng.next() ** 2 * (weekend ? 6 : 14) * (0.5 + momentum))
      if (rng.next() < 0.03) count += rng.int(12, 28)
    }
    days.push({ date: toDateKey(date), count })
  }
  return days
}

export function sampleContributions(): ContributionData {
  const days = generateSampleDays()
  return {
    source: 'sample',
    sourceLabel: 'Sample data — not from any GitHub account',
    username: null,
    days,
    total: days.reduce((s, d) => s + d.count, 0),
    fetchedAt: new Date().toISOString(),
  }
}
