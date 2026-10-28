/** Safe localStorage helpers — storage can be unavailable (private mode, quotas). */
const PREFIX = 'githue:'

export const KEYS = {
  config: 'config',
  username: 'username',
  data: 'data',
  presets: 'presets',
  favorites: 'favorites',
  seeds: 'seeds',
  onboarded: 'onboarded',
} as const

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}
