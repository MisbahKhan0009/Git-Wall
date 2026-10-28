export interface ContributionDay {
  date: string // YYYY-MM-DD (UTC calendar date)
  count: number
  /** Level as reported by the source (0..4), if any. */
  level?: number
}

export type ContributionSource = 'sample' | 'github' | 'imported'

export interface ContributionData {
  source: ContributionSource
  /** Human readable provenance, shown in the interface. */
  sourceLabel: string
  username: string | null
  days: ContributionDay[]
  total: number
  fetchedAt: string
}

export interface GitHubProfile {
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
  publicRepos: number
  followers: number
  createdAt: string
}
