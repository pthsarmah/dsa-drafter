'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CmEditor } from './cm-editor'
import { TestResults } from './test-results'
import type { JudgeResult, ProblemTest, SubmissionVerdict } from '@/lib/types'

interface Props {
  problemId: number
  initialCode: string
  starter: string
  visibleTests: ProblemTest[]
  hiddenTestCount: number
  latestVerdict: SubmissionVerdict | null
  harnessReady: boolean
}

export function CodeWorkspace({
  problemId,
  initialCode,
  starter,
  visibleTests,
  hiddenTestCount,
  latestVerdict,
  harnessReady,
}: Props) {
  const [code, setCode] = useState(initialCode || starter)
  const [result, setResult] = useState<JudgeResult | null>(null)
  const [mode, setMode] = useState<'run' | 'submit' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [regenPending, setRegenPending] = useState(false)
  const [regenInfo, setRegenInfo] = useState('')
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function call(endpoint: 'run' | 'submit') {
    if (pending || !code.trim()) return
    setPending(true)
    setMode(endpoint)
    setError('')
    try {
      const res = await fetch(`/api/code/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, code }),
      })
      const data = (await res.json()) as JudgeResult & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Request failed')
        setResult(null)
      } else {
        setResult(data)
        if (endpoint === 'submit') {
          startTransition(() => router.refresh())
        }
      }
    } catch {
      setError('Network error — check the dev server')
    } finally {
      setPending(false)
    }
  }

  async function regen(scope: 'tests' | 'harness' | 'all') {
    if (regenPending || pending) return
    const prompts: Record<typeof scope, string> = {
      tests: 'Wipe existing tests and regenerate hidden cases via the model? Takes ~30s.',
      harness: 'Generate the C++ harness for this problem? Takes ~15s.',
      all: 'Wipe tests and rebuild both tests and harness? Takes ~45s.',
    }
    if (!confirm(prompts[scope])) return
    setRegenPending(true)
    setRegenInfo('')
    setError('')
    try {
      const res = await fetch('/api/code/regen-artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId, scope }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        scope?: typeof scope
        visibleCount?: number
        hiddenCount?: number
        errors?: string[]
        harnessOk?: boolean
        harnessError?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Regen failed')
      } else if (data.harnessOk === false) {
        setError(`Harness generation failed: ${data.harnessError ?? 'unknown error'}`)
      } else {
        const parts: string[] = []
        if (scope === 'tests' || scope === 'all') {
          const skipped = data.errors?.length ?? 0
          parts.push(
            `tests: ${data.visibleCount ?? 0} visible, ${data.hiddenCount ?? 0} hidden${
              skipped ? ` (${skipped} skipped)` : ''
            }`
          )
        }
        if (scope === 'harness' || scope === 'all') parts.push('harness: ready')
        setRegenInfo(`Rebuilt — ${parts.join(' · ')}`)
        startTransition(() => router.refresh())
      }
    } catch {
      setError('Network error — check the dev server')
    } finally {
      setRegenPending(false)
    }
  }

  function resetToStarter() {
    if (!confirm('Replace your code with the starter template? Unsaved work will be lost.')) return
    setCode(starter)
    setResult(null)
    setError('')
  }

  const totalTests = visibleTests.length + hiddenTestCount

  return (
    <div className="space-y-8">
      <header className="flex items-baseline justify-between gap-6 flex-wrap">
        <div className="space-y-1">
          <span className="text-[13px] uppercase tracking-[0.3em] text-faint">Editor</span>
          <p className="font-display italic text-2xl text-cream leading-tight">C++ — your turn.</p>
        </div>
        <div className="flex items-center gap-5 text-[12px] uppercase tracking-[0.25em] text-muted">
          <span>{visibleTests.length} visible · {hiddenTestCount} hidden</span>
          {latestVerdict && (
            <span
              className={
                latestVerdict === 'accepted'
                  ? 'text-sage'
                  : latestVerdict === 'compile_error' || latestVerdict === 'tle'
                    ? 'text-honey'
                    : 'text-dust'
              }
            >
              Last: {latestVerdict.replace('_', ' ')}
            </span>
          )}
          {!harnessReady && (
            <button
              type="button"
              onClick={() => regen('harness')}
              disabled={regenPending || pending}
              className="text-honey hover:text-amber disabled:cursor-not-allowed transition-colors"
            >
              {regenPending ? 'Building…' : 'Build harness'}
            </button>
          )}
          <button
            type="button"
            onClick={() => regen('tests')}
            disabled={regenPending || pending}
            className="text-faint hover:text-amber disabled:cursor-not-allowed transition-colors"
          >
            {regenPending ? 'Regenerating…' : 'Regen tests'}
          </button>
          <button
            type="button"
            onClick={resetToStarter}
            className="text-faint hover:text-amber transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="border border-rule bg-ink/60 h-[60vh] min-h-[420px]">
        <CmEditor value={code} onChange={setCode} />
      </div>

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => call('run')}
          disabled={pending || !code.trim() || !harnessReady}
          className="text-[14px] uppercase tracking-[0.25em] text-amber hover:text-cream disabled:text-faint disabled:cursor-not-allowed transition-colors"
        >
          {pending && mode === 'run' ? 'Running…' : `Run · ${visibleTests.length} visible`}
        </button>
        <span className="text-faint">·</span>
        <button
          type="button"
          onClick={() => call('submit')}
          disabled={pending || !code.trim() || totalTests === 0 || !harnessReady}
          className="text-[14px] uppercase tracking-[0.25em] text-cream hover:text-amber disabled:text-faint disabled:cursor-not-allowed transition-colors"
        >
          {pending && mode === 'submit' ? 'Submitting…' : `Submit · ${totalTests} total`}
        </button>
      </div>

      {error && (
        <div className="border border-dust/40 bg-dust/[0.04] px-5 py-3 text-xs font-mono text-dust">
          {error}
        </div>
      )}

      {regenInfo && (
        <div className="border border-sage/40 bg-sage/[0.04] px-5 py-3 text-xs font-mono text-sage">
          {regenInfo}
        </div>
      )}

      <TestResults result={result} pending={pending} mode={mode} />
    </div>
  )
}
