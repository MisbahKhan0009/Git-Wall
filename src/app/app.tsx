import { useEffect, useState } from 'react'
import { useEditor } from '@/store/editor'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TopBar } from '@/components/navigation/top-bar'
import { CanvasStage } from '@/components/canvas/canvas-stage'
import { EditorPanel, MobileEditor } from '@/components/editor/editor-panel'
import { ExportDialog } from '@/components/export/export-dialog'
import { Toasts } from '@/components/editor/toasts'
import { Landing } from '@/components/landing/landing'

export function App() {
  const hideUI = useEditor((s) => s.hideUI)
  const landing = useEditor((s) => s.landing)
  const [exportOpen, setExportOpen] = useState(false)

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState()
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        s.redo()
        return
      }
      if (typing || mod || e.altKey || s.landing) return
      if (e.key === 'r' || e.key === 'R') s.randomize('all')
      if (e.key === 'h' || e.key === 'H') s.setHideUI(!s.hideUI)
      if (e.key === 'e' || e.key === 'E') setExportOpen(true)
      if (e.key === 'Escape' && s.hideUI) s.setHideUI(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Restore the last profile silently (data itself is cached locally).
  useEffect(() => {
    const s = useEditor.getState()
    if (s.username && s.data.source === 'github' && !s.profile) {
      s.loadUser(s.username)
    }
  }, [])

  return (
    <TooltipProvider>
      {landing ? (
        <Landing />
      ) : (
        <div className="flex h-dvh flex-col animate-fade-in">
          {!hideUI && <TopBar onExport={() => setExportOpen(true)} />}
          <main className="flex min-h-0 flex-1 flex-col md:flex-row">
            <CanvasStage />
            {!hideUI && <EditorPanel />}
            {!hideUI && <MobileEditor />}
          </main>
        </div>
      )}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <Toasts />
    </TooltipProvider>
  )
}
