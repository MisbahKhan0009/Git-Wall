import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { normalizeColor } from '@/lib/color'
import { cn } from '@/lib/cn'

/**
 * Colour input: native picker behind a swatch plus a HEX field that accepts
 * pasted values (#abc, rgb(), hsl(), oklch(), names) and rejects invalid input.
 */
export function ColorField({
  label,
  value,
  onChange,
  onCommit,
  hideLabel,
  className,
  trailing,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  /** Called once when a picker interaction or text edit finishes. */
  onCommit?: (hex: string) => void
  hideLabel?: boolean
  className?: string
  trailing?: ReactNode
}) {
  const id = useId()
  const [text, setText] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setText(value)
  }, [value])

  const commitText = () => {
    editing.current = false
    const hex = normalizeColor(text)
    if (hex) {
      setInvalid(false)
      setText(hex)
      if (hex !== value) {
        onChange(hex)
        onCommit?.(hex)
      }
    } else {
      setInvalid(true)
      setText(value)
      setTimeout(() => setInvalid(false), 1200)
    }
  }

  return (
    <div className={cn('grid gap-1.5', className)}>
      {!hideLabel && (
        <label htmlFor={id} className="text-xs text-ink-300">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
          style={{ background: value }}
        >
          <span className="sr-only">Pick {label}</span>
          <input
            type="color"
            value={value}
            aria-label={`${label} colour picker`}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onCommit?.(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <input
          id={id}
          value={text}
          spellCheck={false}
          aria-label={`${label} hex value`}
          aria-invalid={invalid}
          onFocus={() => (editing.current = true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              editing.current = false
              setText(value)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            const hex = normalizeColor(pasted)
            if (hex) {
              e.preventDefault()
              setText(hex)
              onChange(hex)
              onCommit?.(hex)
            }
          }}
          className={cn(
            'h-8 w-full min-w-0 rounded-md border bg-black/25 px-2 font-mono text-xs text-ink-100 uppercase transition-colors outline-none focus-visible:border-white/40',
            invalid ? 'border-danger/70' : 'border-line hover:border-line-strong',
          )}
        />
        {trailing}
      </div>
    </div>
  )
}
