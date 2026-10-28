import { useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Check, Copy, FileUp, AtSign, UserRound, Loader2, RotateCcw } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Advanced } from '@/components/ui/section'
import { CONTRIBUTIONS_SOURCE, isValidUsername } from '@/features/github/api'
import { GRAPHQL_SNIPPET } from '@/features/contributions/import'
import { cn } from '@/lib/cn'

export function UsernameForm({ autoFocus, onSubmitted, size = 'sm' }: { autoFocus?: boolean; onSubmitted?: () => void; size?: 'sm' | 'lg' }) {
  const username = useEditor((s) => s.username)
  const setUsername = useEditor((s) => s.setUsername)
  const loadUser = useEditor((s) => s.loadUser)
  const loading = useEditor((s) => s.status.kind === 'loading')
  const [touched, setTouched] = useState(false)
  const value = username.replace(/^@/, '')
  const invalid = touched && value.length > 0 && !isValidUsername(value)

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!value || !isValidUsername(value)) return
        loadUser(value)
        onSubmitted?.()
      }}
    >
      <label htmlFor="gh-username" className={cn('text-ink-300', size === 'lg' ? 'sr-only' : 'text-xs')}>
        GitHub username
      </label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <AtSign className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-400', size === 'lg' ? 'left-3.5 size-4' : 'left-2.5 size-3.5')} />
          <Input
            id="gh-username"
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="octocat"
            value={username}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'gh-username-error' : undefined}
            onChange={(e) => setUsername(e.target.value)}
            className={cn(size === 'lg' ? 'h-11 rounded-lg pl-10 text-sm' : 'pl-8', invalid && 'border-danger/60')}
          />
        </div>
        <Button type="submit" variant={size === 'lg' ? 'primary' : 'secondary'} size={size === 'lg' ? 'md' : 'sm'} className={size === 'lg' ? 'h-11 rounded-lg px-4' : 'h-8'} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : size === 'lg' ? null : <ArrowRight />}
          {size === 'lg' ? (loading ? 'Loading' : 'Create wallpaper') : <span className="sr-only">Load profile</span>}
        </Button>
      </div>
      {invalid && (
        <p id="gh-username-error" className="text-2xs text-danger">
          Usernames use letters, numbers and single hyphens (max 39).
        </p>
      )}
    </form>
  )
}

function StatusMessage() {
  const status = useEditor((s) => s.status)
  if (status.kind === 'error')
    return (
      <div role="alert" className="flex gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] p-2.5 text-xs leading-relaxed text-ink-100">
        <AlertCircle className="mt-px size-3.5 shrink-0 text-danger" />
        <span>{status.message}</span>
      </div>
    )
  if (status.kind === 'partial')
    return (
      <div role="status" className="flex gap-2 rounded-lg border border-warn/25 bg-warn/[0.07] p-2.5 text-xs leading-relaxed text-ink-100">
        <AlertCircle className="mt-px size-3.5 shrink-0 text-warn" />
        <span>{status.message}</span>
      </div>
    )
  return null
}

function ProfileCard() {
  const profile = useEditor((s) => s.profile)
  const data = useEditor((s) => s.data)
  const isSample = data.source === 'sample'
  return (
    <div className="grid gap-2.5 rounded-lg border border-line bg-white/[0.02] p-3">
      <div className="flex items-center gap-2.5">
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="size-8 rounded-full border border-line" />
        ) : (
          <div className="grid size-8 place-items-center rounded-full border border-line bg-white/[0.03]">
            <UserRound className="size-4 text-ink-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink-50">
            {profile ? (profile.name ?? profile.login) : isSample ? 'Sample year' : `@${data.username ?? 'imported'}`}
          </div>
          <div className="truncate text-2xs text-ink-400">
            {profile ? (
              <a href={profile.htmlUrl} target="_blank" rel="noreferrer" className="hover:text-ink-200">
                @{profile.login} · {profile.publicRepos} repos
              </a>
            ) : isSample ? (
              'Not from any GitHub account'
            ) : (
              data.sourceLabel
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular font-mono text-xs text-ink-50">{data.total.toLocaleString()}</div>
          <div className="text-2xs text-ink-400">{isSample ? 'sample' : 'last year'}</div>
        </div>
      </div>
      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-400">
        <span className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', isSample ? 'bg-warn' : data.source === 'imported' ? 'bg-sky-300' : 'bg-signal')} />
        <span>{data.sourceLabel}</span>
      </p>
    </div>
  )
}

export function ProfileSection() {
  const importData = useEditor((s) => s.importData)
  const useSampleData = useEditor((s) => s.useSampleData)
  const loadUser = useEditor((s) => s.loadUser)
  const data = useEditor((s) => s.data)
  const fileRef = useRef<HTMLInputElement>(null)
  const [paste, setPaste] = useState('')
  const [copied, setCopied] = useState(false)

  return (
    <>
      <UsernameForm />
      <StatusMessage />
      <ProfileCard />
      <div className="flex flex-wrap gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) importData(await f.text(), f.name)
            e.target.value = ''
          }}
        />
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <FileUp /> Import JSON / CSV
        </Button>
        {data.source !== 'sample' && (
          <Button size="sm" variant="ghost" onClick={useSampleData}>
            <RotateCcw /> Use sample data
          </Button>
        )}
        {data.source === 'github' && data.username && (
          <Button size="sm" variant="ghost" onClick={() => loadUser(data.username!)}>
            Refresh
          </Button>
        )}
      </div>

      <Advanced title="Where the data comes from">
        <div className="grid gap-2.5 text-2xs leading-relaxed text-ink-300">
          <p>
            Profiles come from GitHub's public REST API (60 requests per hour, no token). GitHub has no public, browser-accessible endpoint for the
            yearly contribution calendar, so GitHue reads it from{' '}
            <a className="text-ink-100 underline decoration-white/25 underline-offset-2 hover:decoration-white/60" href={CONTRIBUTIONS_SOURCE.url} target="_blank" rel="noreferrer">
              {CONTRIBUTIONS_SOURCE.name}
            </a>
            , an open-source service that mirrors the calendar shown on your profile. Nothing is sent anywhere else, and no tokens are stored.
          </p>
          <p>
            If that service is unavailable, import your data instead. With your own token you can run this query in GitHub's GraphQL Explorer and paste
            or import the JSON result:
          </p>
          <div className="relative">
            <pre className="scroll-thin overflow-x-auto rounded-md border border-line bg-black/30 p-2.5 font-mono text-[10px] leading-relaxed text-ink-200">{GRAPHQL_SNIPPET}</pre>
            <Button
              size="icon-sm"
              variant="ghost"
              className="absolute top-1 right-1"
              aria-label="Copy query"
              onClick={() => {
                navigator.clipboard?.writeText(GRAPHQL_SNIPPET)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <p>CSV files need a date column (YYYY-MM-DD) and a count column.</p>
          <label htmlFor="paste-data" className="text-xs text-ink-300">
            Paste JSON or CSV
          </label>
          <textarea
            id="paste-data"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            placeholder={'date,count\n2025-01-01,3'}
            className="scroll-thin w-full resize-y rounded-md border border-line bg-black/25 p-2 font-mono text-[11px] text-ink-100 outline-none placeholder:text-ink-500 focus-visible:border-white/40"
          />
          <Button size="sm" disabled={!paste.trim()} onClick={() => importData(paste, 'pasted data') && setPaste('')}>
            Import pasted data
          </Button>
        </div>
      </Advanced>
    </>
  )
}
