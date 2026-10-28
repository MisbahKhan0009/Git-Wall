/** Deterministic, seedable PRNG (mulberry32). */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    weighted: <T>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [item, w] of items) {
        r -= w
        if (r <= 0) return item
      }
      return items[items.length - 1][0]
    },
    /** Gaussian-ish value centred on 0 (sum of uniforms). */
    normal: () => (next() + next() + next() - 1.5) / 1.5,
    fork: (salt: number) => createRng(hashNumbers(seed, salt)),
  }
}

export type Rng = ReturnType<typeof createRng>

export function hashNumbers(...values: number[]): number {
  let h = 2166136261
  for (const v of values) {
    h ^= Math.floor(v) | 0
    h = Math.imul(h, 16777619)
    h ^= h >>> 13
  }
  return h >>> 0
}

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/** Seeds are displayed as short base-36 codes, e.g. `k3f9qz`. */
export function formatSeed(seed: number): string {
  return (seed >>> 0).toString(36).padStart(6, '0')
}

export function parseSeed(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!/^[0-9a-z]{1,7}$/.test(s)) return null
  const n = parseInt(s, 36)
  if (!Number.isFinite(n) || n > 0xffffffff) return null
  return n >>> 0
}

let idCounter = 0
export function uid(prefix = 'id'): string {
  idCounter = (idCounter + 1) % 1e9
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}
