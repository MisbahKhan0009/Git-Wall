/**
 * Central editor store. The wallpaper config is the single source of truth;
 * every action produces a new config, and history snapshots make undo/redo exact.
 */
import { create } from 'zustand'
import type { ColorStop, CompositionPresetId, ContainerStyle, GradientType, GraphPaletteId, WallpaperConfig } from '@/types/config'
import { pointsForType } from '@/features/gradient-engine/geometry'
import type { ContributionData, GitHubProfile } from '@/types/contributions'
import { createDefaultConfig } from '@/presets/defaults'
import { applyAutoGraph } from '@/features/composition/auto-graph'
import { COMPOSITION_PRESETS, CONTAINER_STYLES } from '@/features/composition/presets'
import { applyPalettePreset, generateComposition, type RandomizeScope } from '@/features/gradient-engine/generate'
import { PALETTE_PRESETS } from '@/presets/palettes'
import { GRAPH_PALETTES, recommendGraphPalette } from '@/features/graph-renderer/palettes'
import { graphSurface } from '@/features/composition/auto-graph'
import { sampleContributions } from '@/features/contributions/sample'
import { fetchContributions, fetchProfile, GitHubError } from '@/features/github/api'
import { importedContributions, parseContributionText, ImportError } from '@/features/contributions/import'
import { sanitizeConfig } from '@/features/persistence/sanitize'
import { KEYS, readJSON, writeJSON } from '@/features/persistence/storage'
import { randomSeed, uid } from '@/lib/random'
import { mixOklab } from '@/lib/color'

export interface SavedPreset {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  config: WallpaperConfig
}

export interface FavoritePalette {
  id: string
  name: string
  stops: ColorStop[]
  base: string
  type: WallpaperConfig['gradient']['type']
  createdAt: string
}

export type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; username: string }
  | { kind: 'ready' }
  | { kind: 'partial'; message: string }
  | { kind: 'error'; message: string; errorKind?: string }

export type Toast = { id: number; message: string; tone: 'neutral' | 'success' | 'error' }

type Section = keyof Omit<WallpaperConfig, 'version' | 'seed'>

interface UpdateOptions {
  /** Merges consecutive updates with the same key into one undo step (slider drags). */
  coalesce?: string
  /** Animates the preview cross-fade (palette changes, shuffles). */
  transition?: boolean
}

const HISTORY_LIMIT = 80
const COALESCE_MS = 700

export interface EditorState {
  config: WallpaperConfig
  past: WallpaperConfig[]
  future: WallpaperConfig[]
  lastCoalesce: { key: string; at: number } | null
  transitionToken: number

  data: ContributionData
  profile: GitHubProfile | null
  status: LoadStatus
  username: string

  presets: SavedPreset[]
  activePresetId: string | null
  savedSnapshot: string | null
  favorites: FavoritePalette[]
  recentSeeds: number[]

  selectedStopId: string | null
  hideUI: boolean
  landing: boolean
  toasts: Toast[]

  // config editing
  update: (fn: (c: WallpaperConfig) => WallpaperConfig, opts?: UpdateOptions) => void
  patch: <K extends Section>(section: K, values: Partial<WallpaperConfig[K]>, opts?: UpdateOptions) => void
  undo: () => void
  redo: () => void
  randomize: (scope?: RandomizeScope, seed?: number) => void
  applySeed: (seed: number) => void
  applyPalettePreset: (id: string) => void
  applyCompositionPreset: (id: CompositionPresetId) => void
  setContainerStyle: (style: ContainerStyle) => void
  setGraphPalette: (id: GraphPaletteId) => void
  setGradientType: (type: GradientType) => void
  resetComposition: () => void
  restoreDefaults: () => void
  loadConfig: (config: WallpaperConfig, label?: string) => void

  // stops
  selectStop: (id: string | null) => void
  updateStop: (id: string, values: Partial<ColorStop>, opts?: UpdateOptions) => void
  addStop: (position?: number) => void
  removeStop: (id: string) => void
  reverseStops: () => void

  // data
  setUsername: (name: string) => void
  loadUser: (username: string) => Promise<void>
  importData: (text: string, fileName: string) => boolean
  useSampleData: () => void

  // library
  savePreset: (name: string) => void
  overwritePreset: (id: string) => void
  renamePreset: (id: string, name: string) => void
  duplicatePreset: (id: string) => void
  deletePreset: (id: string) => void
  loadPreset: (id: string) => void
  saveFavorite: () => void
  applyFavorite: (id: string) => void
  deleteFavorite: (id: string) => void

  // ui
  setHideUI: (v: boolean) => void
  dismissLanding: () => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

/* -------------------------------------------------------------------------- */
/* Initial state from storage                                                 */
/* -------------------------------------------------------------------------- */

const DEFAULTS = createDefaultConfig()

export function defaultConfig(): WallpaperConfig {
  return structuredClone(DEFAULTS)
}

function loadInitialConfig(): WallpaperConfig {
  const stored = readJSON<unknown>(KEYS.config)
  return stored ? sanitizeConfig(stored, DEFAULTS) : defaultConfig()
}

function loadInitialData(): ContributionData {
  const stored = readJSON<ContributionData>(KEYS.data)
  if (stored && (stored.source === 'github' || stored.source === 'imported') && Array.isArray(stored.days) && stored.days.length) {
    return stored
  }
  return sampleContributions()
}

function loadPresets(): SavedPreset[] {
  const raw = readJSON<SavedPreset[]>(KEYS.presets)
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p) => ({ ...p, config: sanitizeConfig(p.config, DEFAULTS) }))
}

function loadFavorites(): FavoritePalette[] {
  const raw = readJSON<FavoritePalette[]>(KEYS.favorites)
  if (!Array.isArray(raw)) return []
  return raw.filter((f) => f && typeof f.id === 'string' && Array.isArray(f.stops))
}

const snapshot = (c: WallpaperConfig) => JSON.stringify(c)

/* -------------------------------------------------------------------------- */

let toastId = 0
let loadController: AbortController | null = null

export const useEditor = create<EditorState>()((set, get) => {
  const commit = (next: WallpaperConfig, opts: UpdateOptions = {}) => {
    const s = get()
    if (next === s.config) return
    const now = Date.now()
    const merge = opts.coalesce && s.lastCoalesce?.key === opts.coalesce && now - s.lastCoalesce.at < COALESCE_MS
    set({
      config: next,
      past: merge ? s.past : [...s.past, s.config].slice(-HISTORY_LIMIT),
      future: [],
      lastCoalesce: opts.coalesce ? { key: opts.coalesce, at: now } : null,
      transitionToken: opts.transition ? s.transitionToken + 1 : s.transitionToken,
    })
  }

  const initialConfig = loadInitialConfig()
  const initialData = loadInitialData()
  const storedUser = readJSON<string>(KEYS.username) ?? ''

  return {
    config: initialConfig,
    past: [],
    future: [],
    lastCoalesce: null,
    transitionToken: 0,

    data: initialData,
    profile: null,
    status: { kind: 'idle' },
    username: storedUser,

    presets: loadPresets(),
    activePresetId: null,
    savedSnapshot: null,
    favorites: loadFavorites(),
    recentSeeds: readJSON<number[]>(KEYS.seeds)?.filter((n) => typeof n === 'number').slice(0, 12) ?? [],

    selectedStopId: initialConfig.gradient.stops[0]?.id ?? null,
    hideUI: false,
    landing: !readJSON<boolean>(KEYS.onboarded),
    toasts: [],

    update: (fn, opts) => commit(fn(get().config), opts),

    patch: (section, values, opts) => {
      const c = get().config
      let next: WallpaperConfig = { ...c, [section]: { ...c[section], ...values } }
      if (section === 'gradient' || section === 'container') next = applyAutoGraph(next)
      commit(next, opts)
    },

    undo: () => {
      const { past, config, future } = get()
      if (!past.length) return
      set({ config: past[past.length - 1], past: past.slice(0, -1), future: [config, ...future], lastCoalesce: null })
    },

    redo: () => {
      const { past, config, future } = get()
      if (!future.length) return
      set({ config: future[0], future: future.slice(1), past: [...past, config], lastCoalesce: null })
    },

    randomize: (scope = 'all', seed = randomSeed()) => {
      const next = generateComposition(get().config, seed, scope)
      commit(next, { transition: true })
      if (scope === 'all') {
        const recent = [seed, ...get().recentSeeds.filter((s) => s !== seed)].slice(0, 12)
        set({ recentSeeds: recent, selectedStopId: next.gradient.stops[0]?.id ?? null })
        writeJSON(KEYS.seeds, recent)
      }
    },

    applySeed: (seed) => get().randomize('all', seed),

    applyPalettePreset: (id) => {
      const preset = PALETTE_PRESETS.find((p) => p.id === id)
      if (!preset) return
      const next = applyPalettePreset(get().config, preset)
      commit(next, { transition: true })
      set({ selectedStopId: next.gradient.stops[0]?.id ?? null })
    },

    applyCompositionPreset: (id) => {
      const preset = COMPOSITION_PRESETS.find((p) => p.id === id)
      if (!preset) return
      const c = get().config
      let next: WallpaperConfig = {
        ...c,
        composition: { ...c.composition, ...preset.composition },
        graph: { ...c.graph, ...preset.graph },
        typography: { ...c.typography, ...preset.typography },
      }
      if (preset.container) next.container = { ...c.container, ...CONTAINER_STYLES[preset.container].values, style: preset.container }
      next = applyAutoGraph(next, true)
      commit(next, { transition: true })
    },

    setContainerStyle: (style) => {
      const c = get().config
      let next: WallpaperConfig = { ...c, container: { ...c.container, ...CONTAINER_STYLES[style].values, style } }
      if (style === 'custom') next.container.color = c.container.style === 'custom' ? c.container.color : mixOklab(c.gradient.base, '#000000', 0.3)
      next = applyAutoGraph(next, true)
      commit(next)
    },

    setGraphPalette: (id) => {
      const c = get().config
      if (id === 'auto') {
        commit(applyAutoGraph({ ...c, graph: { ...c.graph, paletteId: 'auto' } }, true))
        return
      }
      if (id === 'custom') {
        commit({ ...c, graph: { ...c.graph, paletteId: 'custom' } })
        return
      }
      const p = GRAPH_PALETTES.find((g) => g.id === id)
      if (!p) return
      const rec = recommendGraphPalette(c.gradient, 'harmonious', graphSurface(c))
      commit({
        ...c,
        graph: { ...c.graph, paletteId: id, levels: [rec.dark ? p.levels[0] : rec.levels[0], ...p.levels.slice(1)] as WallpaperConfig['graph']['levels'] },
      })
    },

    setGradientType: (type) => {
      const g = get().config.gradient
      if (g.type === type) return
      get().patch('gradient', { type, points: pointsForType(type, g.stops.length, get().config.seed) }, { transition: true })
    },

    resetComposition: () => {
      const c = get().config
      const d = defaultConfig()
      commit(applyAutoGraph({ ...c, composition: d.composition, container: d.container, typography: { ...d.typography, color: c.typography.color } }, true), { transition: true })
    },

    restoreDefaults: () => {
      const d = defaultConfig()
      commit({ ...d, canvas: get().config.canvas, export: get().config.export }, { transition: true })
      set({ selectedStopId: d.gradient.stops[0]?.id ?? null, activePresetId: null, savedSnapshot: null })
    },

    loadConfig: (config) => {
      commit(sanitizeConfig(config, DEFAULTS), { transition: true })
      set({ selectedStopId: config.gradient.stops[0]?.id ?? null })
    },

    /* ----------------------------- stops ------------------------------ */

    selectStop: (id) => set({ selectedStopId: id }),

    updateStop: (id, values, opts) => {
      const c = get().config
      const stops = c.gradient.stops.map((s) => (s.id === id ? { ...s, ...values } : s))
      get().patch('gradient', { stops }, opts)
    },

    addStop: (position) => {
      const c = get().config
      const sorted = [...c.gradient.stops].sort((a, b) => a.position - b.position)
      if (sorted.length >= 8) {
        get().toast('A gradient can have up to 8 colour stops.')
        return
      }
      let pos = position
      if (pos === undefined) {
        // place it in the widest gap
        let best = 0
        let at = 0.5
        for (let i = 0; i < sorted.length - 1; i++) {
          const gap = sorted[i + 1].position - sorted[i].position
          if (gap > best) {
            best = gap
            at = (sorted[i].position + sorted[i + 1].position) / 2
          }
        }
        pos = at
      }
      const left = [...sorted].reverse().find((s) => s.position <= pos!) ?? sorted[0]
      const right = sorted.find((s) => s.position >= pos!) ?? sorted[sorted.length - 1]
      const span = right.position - left.position
      const t = span > 0 ? (pos - left.position) / span : 0.5
      const stop: ColorStop = { id: uid('stop'), color: mixOklab(left.color, right.color, t), position: pos, locked: false }
      const stops = [...c.gradient.stops, stop]
      get().patch('gradient', { stops, points: pointsForType(c.gradient.type, stops.length, c.seed) })
      set({ selectedStopId: stop.id })
    },

    removeStop: (id) => {
      const c = get().config
      if (c.gradient.stops.length <= 2) {
        get().toast('A gradient needs at least two colours.')
        return
      }
      const stops = c.gradient.stops.filter((s) => s.id !== id)
      get().patch('gradient', { stops, points: pointsForType(c.gradient.type, stops.length, c.seed) })
      set({ selectedStopId: stops[0]?.id ?? null })
    },

    reverseStops: () => {
      const c = get().config
      get().patch('gradient', { stops: c.gradient.stops.map((s) => ({ ...s, position: 1 - s.position })) }, { transition: true })
    },

    /* ------------------------------ data ------------------------------ */

    setUsername: (username) => set({ username }),

    loadUser: async (raw) => {
      const username = raw.trim().replace(/^@/, '')
      if (!username) return
      loadController?.abort()
      const controller = new AbortController()
      loadController = controller
      set({ status: { kind: 'loading', username }, username })
      writeJSON(KEYS.username, username)

      const [profileRes, dataRes] = await Promise.allSettled([
        fetchProfile(username, controller.signal),
        fetchContributions(username, controller.signal),
      ])
      if (controller.signal.aborted) return

      const profileErr = profileRes.status === 'rejected' ? (profileRes.reason as GitHubError) : null
      const dataErr = dataRes.status === 'rejected' ? (dataRes.reason as GitHubError) : null
      const profile = profileRes.status === 'fulfilled' ? profileRes.value : null

      if (profileErr?.kind === 'invalid' || (profileErr?.kind === 'not-found' && dataErr)) {
        set({ status: { kind: 'error', message: profileErr.message, errorKind: profileErr.kind }, profile: null })
        return
      }

      if (dataRes.status === 'fulfilled') {
        const data = dataRes.value
        set({ data, profile, status: profileErr ? { kind: 'partial', message: `Contributions loaded. Profile details unavailable: ${profileErr.message}` } : { kind: 'ready' } })
        writeJSON(KEYS.data, data)
        get().toast(`Loaded ${data.total.toLocaleString()} contributions for @${data.username}`, 'success')
        // put the username on the wallpaper only if the user opted in to text
        return
      }

      if (profile) {
        // Profile exists but the calendar is unavailable — never fabricate data.
        const previous = get().data
        const keep = previous.source !== 'sample' && previous.username?.toLowerCase() === username.toLowerCase()
        set({
          profile,
          data: keep ? previous : sampleContributions(),
          status: {
            kind: 'partial',
            message: `Found @${profile.login}, but the contribution calendar could not be loaded (${dataErr?.message ?? 'unknown error'}). ${keep ? 'Showing your previously loaded data.' : 'The graph shows sample data until you import your own.'}`,
          },
        })
        return
      }

      const err = profileErr ?? dataErr
      set({ status: { kind: 'error', message: err?.message ?? 'Something went wrong.', errorKind: err?.kind } })
    },

    importData: (text, fileName) => {
      try {
        const days = parseContributionText(text)
        const data = importedContributions(days, fileName, get().profile?.login ?? (get().username || null))
        set({ data, status: { kind: 'ready' } })
        writeJSON(KEYS.data, data)
        get().toast(`Imported ${days.length} days (${data.total.toLocaleString()} contributions)`, 'success')
        return true
      } catch (err) {
        get().toast(err instanceof ImportError ? err.message : 'That file could not be imported.', 'error')
        return false
      }
    },

    useSampleData: () => {
      set({ data: sampleContributions(), status: { kind: 'idle' } })
      writeJSON(KEYS.data, null)
    },

    /* ----------------------------- library ---------------------------- */

    savePreset: (name) => {
      const now = new Date().toISOString()
      const preset: SavedPreset = { id: uid('preset'), name: name.trim().slice(0, 60) || 'Untitled', createdAt: now, updatedAt: now, config: get().config }
      const presets = [preset, ...get().presets]
      set({ presets, activePresetId: preset.id, savedSnapshot: snapshot(preset.config) })
      writeJSON(KEYS.presets, presets)
      get().toast(`Saved “${preset.name}”`, 'success')
    },

    overwritePreset: (id) => {
      const config = get().config
      const presets = get().presets.map((p) => (p.id === id ? { ...p, config, updatedAt: new Date().toISOString() } : p))
      set({ presets, activePresetId: id, savedSnapshot: snapshot(config) })
      writeJSON(KEYS.presets, presets)
      get().toast('Saved changes', 'success')
    },

    renamePreset: (id, name) => {
      const presets = get().presets.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, 60) || p.name } : p))
      set({ presets })
      writeJSON(KEYS.presets, presets)
    },

    duplicatePreset: (id) => {
      const src = get().presets.find((p) => p.id === id)
      if (!src) return
      const now = new Date().toISOString()
      const copy = { ...src, id: uid('preset'), name: `${src.name} copy`, createdAt: now, updatedAt: now }
      const presets = [copy, ...get().presets]
      set({ presets })
      writeJSON(KEYS.presets, presets)
    },

    deletePreset: (id) => {
      const presets = get().presets.filter((p) => p.id !== id)
      set({ presets, ...(get().activePresetId === id ? { activePresetId: null, savedSnapshot: null } : {}) })
      writeJSON(KEYS.presets, presets)
    },

    loadPreset: (id) => {
      const p = get().presets.find((x) => x.id === id)
      if (!p) return
      const config = sanitizeConfig(p.config, DEFAULTS)
      commit(config, { transition: true })
      set({ activePresetId: id, savedSnapshot: snapshot(config), selectedStopId: config.gradient.stops[0]?.id ?? null })
    },

    saveFavorite: () => {
      const g = get().config.gradient
      const fav: FavoritePalette = {
        id: uid('fav'),
        name: `Palette ${get().favorites.length + 1}`,
        stops: g.stops.map((s) => ({ ...s })),
        base: g.base,
        type: g.type,
        createdAt: new Date().toISOString(),
      }
      const favorites = [fav, ...get().favorites].slice(0, 40)
      set({ favorites })
      writeJSON(KEYS.favorites, favorites)
      get().toast('Palette saved to favourites', 'success')
    },

    applyFavorite: (id) => {
      const f = get().favorites.find((x) => x.id === id)
      if (!f) return
      const c = get().config
      const stops = f.stops.map((s) => ({ ...s, id: uid('stop'), locked: false }))
      commit(applyAutoGraph({ ...c, gradient: { ...c.gradient, stops, base: f.base } }), { transition: true })
      set({ selectedStopId: stops[0]?.id ?? null })
    },

    deleteFavorite: (id) => {
      const favorites = get().favorites.filter((f) => f.id !== id)
      set({ favorites })
      writeJSON(KEYS.favorites, favorites)
    },

    /* ------------------------------- ui ------------------------------- */

    setHideUI: (hideUI) => set({ hideUI }),
    dismissLanding: () => {
      set({ landing: false })
      writeJSON(KEYS.onboarded, true)
    },
    toast: (message, tone = 'neutral') => {
      const id = ++toastId
      set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] })
      setTimeout(() => get().dismissToast(id), tone === 'error' ? 6000 : 3200)
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  }
})

/** Whether the current config differs from the active saved preset. */
export function selectDirty(s: EditorState): boolean {
  if (!s.activePresetId || !s.savedSnapshot) return false
  return snapshot(s.config) !== s.savedSnapshot
}

/* Persist the working config (debounced). */
let saveTimer: ReturnType<typeof setTimeout> | null = null
useEditor.subscribe((state, prev) => {
  if (state.config === prev.config) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => writeJSON(KEYS.config, useEditor.getState().config), 400)
})
