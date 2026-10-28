import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { ExportSettings } from '@/components/controls/export-section'
import { Button } from '@/components/ui/button'

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content className="scroll-thin fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line-strong bg-ink-900 p-5 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] animate-rise focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[15px] font-semibold tracking-tight text-ink-50">Export wallpaper</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-ink-400">Rendered from scratch at full resolution — every enabled effect included.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <ExportSettings />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
