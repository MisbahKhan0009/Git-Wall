import { create } from 'zustand'
import { useEditor } from '@/store/editor'
import { downloadBlob, ExportError, renderExport } from '@/features/export/export'

type ExportState =
  | { kind: 'idle' }
  | { kind: 'exporting'; label: string }
  | { kind: 'success'; filename: string; size: number; width: number; height: number }
  | { kind: 'error'; message: string }

interface ExportStore {
  state: ExportState
  run: () => Promise<void>
  reset: () => void
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

export const useExport = create<ExportStore>()((set, get) => ({
  state: { kind: 'idle' },
  reset: () => set({ state: { kind: 'idle' } }),
  run: async () => {
    if (get().state.kind === 'exporting') return
    const { config, data, toast } = useEditor.getState()
    set({ state: { kind: 'exporting', label: `Rendering ${config.canvas.width} × ${config.canvas.height}…` } })
    // let the UI paint the exporting state before the synchronous render
    await nextFrame()
    try {
      await document.fonts?.ready
      const result = await renderExport(config, data)
      downloadBlob(result.blob, result.filename)
      set({ state: { kind: 'success', filename: result.filename, size: result.blob.size, width: result.width, height: result.height } })
      toast(`Exported ${result.filename}`, 'success')
    } catch (err) {
      const message = err instanceof ExportError ? err.message : `Export failed: ${(err as Error).message}. Try a lower resolution.`
      set({ state: { kind: 'error', message } })
      toast(message, 'error')
    }
  },
}))

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
