/**
 * Public, unauthenticated GitHub data access — no tokens, no proxy.
 *
 * Profile: the official REST API (`api.github.com/users/{user}`), 60 requests/hour per IP.
 *
 * Contribution calendar: GitHub has no unauthenticated, CORS-enabled endpoint for
 * the yearly calendar (REST public events only cover ~90 days of some activity, and
 * GraphQL requires a token). We therefore read the calendar from
 * github-contributions-api.jogruber.de — an open-source, public, CORS-enabled
 * service that mirrors the contribution calendar shown on a GitHub profile.
 * The interface names this source explicitly, and offers manual import otherwise.
 */
import type { ContributionData, ContributionDay, GitHubProfile } from '@/types/contributions'
import { isDateKey } from '@/features/contributions/calendar'

export const CONTRIBUTIONS_SOURCE = {
  name: 'github-contributions-api.jogruber.de',
  url: 'https://github.com/grubersjoe/github-contributions-api',
}

const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export function isValidUsername(name: string): boolean {
  return USERNAME.test(name.trim())
}

export type GitHubErrorKind = 'invalid' | 'not-found' | 'rate-limited' | 'network' | 'unavailable'

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind
  readonly resetAt?: Date
  constructor(kind: GitHubErrorKind, message: string, resetAt?: Date) {
    super(message)
    this.kind = kind
    this.resetAt = resetAt
  }
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new GitHubError('network', 'Could not reach the server. Check your connection, or an extension may be blocking the request.')
  }
}

export async function fetchProfile(username: string, signal?: AbortSignal): Promise<GitHubProfile> {
  const name = username.trim()
  if (!isValidUsername(name)) throw new GitHubError('invalid', 'That is not a valid GitHub username.')
  const res = await request(`https://api.github.com/users/${encodeURIComponent(name)}`, signal)
  if (res.status === 404) throw new GitHubError('not-found', `No GitHub user named “${name}”.`)
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    const resetAt = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : undefined
    throw new GitHubError(
      'rate-limited',
      `GitHub's public API rate limit was reached${resetAt ? ` — it resets at ${resetAt.toLocaleTimeString()}` : ''}.`,
      resetAt,
    )
  }
  if (!res.ok) throw new GitHubError('unavailable', `GitHub responded with ${res.status}.`)
  const j = (await res.json()) as Record<string, unknown>
  return {
    login: String(j.login ?? name),
    name: typeof j.name === 'string' ? j.name : null,
    avatarUrl: String(j.avatar_url ?? ''),
    htmlUrl: String(j.html_url ?? `https://github.com/${name}`),
    publicRepos: Number(j.public_repos ?? 0),
    followers: Number(j.followers ?? 0),
    createdAt: String(j.created_at ?? ''),
  }
}

export function parseContributionsResponse(json: unknown): ContributionDay[] {
  if (!json || typeof json !== 'object') throw new GitHubError('unavailable', 'Unexpected response from the contribution service.')
  const list = (json as Record<string, unknown>).contributions
  if (!Array.isArray(list)) throw new GitHubError('unavailable', 'Unexpected response from the contribution service.')
  const days: ContributionDay[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (!isDateKey(o.date) || typeof o.count !== 'number' || o.count < 0) continue
    days.push({ date: o.date, count: Math.floor(o.count), level: typeof o.level === 'number' ? o.level : undefined })
  }
  if (!days.length) throw new GitHubError('unavailable', 'The contribution service returned no days.')
  return days.sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchContributions(username: string, signal?: AbortSignal): Promise<ContributionData> {
  const name = username.trim()
  if (!isValidUsername(name)) throw new GitHubError('invalid', 'That is not a valid GitHub username.')
  const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(name)}?y=last`
  let res: Response
  try {
    res = await request(url, signal)
  } catch (err) {
    // one retry for transient network failures (connection resets, cold starts)
    if (!(err instanceof GitHubError) || err.kind !== 'network') throw err
    await new Promise((r) => setTimeout(r, 900))
    res = await request(url, signal)
  }
  if (res.status === 404) throw new GitHubError('not-found', `No contribution calendar found for “${name}”.`)
  if (res.status === 429) throw new GitHubError('rate-limited', 'The contribution service is rate limiting requests. Try again in a few seconds.')
  if (!res.ok) throw new GitHubError('unavailable', `The contribution service responded with ${res.status}.`)
  const days = parseContributionsResponse(await res.json())
  return {
    source: 'github',
    sourceLabel: `Public contribution calendar of @${name} via ${CONTRIBUTIONS_SOURCE.name}`,
    username: name,
    days,
    total: days.reduce((s, d) => s + d.count, 0),
    fetchedAt: new Date().toISOString(),
  }
}
