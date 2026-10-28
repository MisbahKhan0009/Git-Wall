import type { ReactNode } from 'react'
import { Tooltip as T } from 'radix-ui'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={350} skipDelayDuration={200}>
      {children}
    </T.Provider>
  )
}

export function Tooltip({ content, children, side = 'bottom' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-64 rounded-sm border border-line-strong bg-ink-800/95 px-2.5 py-1.5 text-xs leading-snug text-ink-100 shadow-xl backdrop-blur-md animate-fade-in"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
