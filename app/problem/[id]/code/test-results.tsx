'use client'

import type { JudgeResult, TestVerdict } from '@/lib/types'

const VERDICT_LABEL: Record<JudgeResult['overall'], string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  compile_error: 'Compile error',
  runtime_error: 'Runtime error',
  tle: 'Time limit exceeded',
}

const VERDICT_COLOR: Record<JudgeResult['overall'], string> = {
  accepted: 'text-sage',
  wrong_answer: 'text-dust',
  compile_error: 'text-honey',
  runtime_error: 'text-dust',
  tle: 'text-honey',
}

interface Props {
  result: JudgeResult | null
  pending: boolean
  mode: 'run' | 'submit' | null
}

export function TestResults({ result, pending, mode }: Props) {
  if (pending) {
    return (
      <div className="border border-rule-soft px-5 py-4 text-[13px] uppercase tracking-[0.3em] text-faint">
        {mode === 'submit' ? 'Submitting…' : 'Running…'}
      </div>
    )
  }

  if (!result) return null

  if (!result.compile_ok) {
    return (
      <div className="border border-honey/40 bg-honey/[0.04] px-5 py-4 space-y-2">
        <div className="text-[13px] uppercase tracking-[0.3em] text-honey">Compile error</div>
        <pre className="text-xs text-cream/90 font-mono whitespace-pre-wrap leading-relaxed">
          {result.compile_error || '(no compiler output)'}
        </pre>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <span className={`text-[13px] uppercase tracking-[0.3em] ${VERDICT_COLOR[result.overall]}`}>
          {VERDICT_LABEL[result.overall]}
        </span>
        <span className="text-[12px] uppercase tracking-[0.25em] text-faint tabular-nums">
          {result.passed_count}/{result.total_count} · {result.total_runtime_ms}ms
        </span>
      </div>

      <div className="space-y-3">
        {result.results.map((r, i) => (
          <TestCard key={r.test_id} verdict={r} index={i} />
        ))}
      </div>
    </div>
  )
}

function TestCard({ verdict, index }: { verdict: TestVerdict; index: number }) {
  const passed = verdict.passed
  const tone = passed ? 'border-sage/40' : verdict.timed_out ? 'border-honey/40' : 'border-dust/40'
  const label = passed
    ? 'Passed'
    : verdict.timed_out
      ? 'Timed out'
      : 'Failed'
  const labelColor = passed ? 'text-sage' : verdict.timed_out ? 'text-honey' : 'text-dust'

  return (
    <div className={`border ${tone} bg-paper/40 px-5 py-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <span className="text-[12px] uppercase tracking-[0.3em] text-faint">
          {verdict.visible ? `Test ${index + 1} · Visible` : `Hidden test ${index + 1}`}
        </span>
        <div className="flex-1 rule-dashed" />
        <span className={`text-[12px] uppercase tracking-[0.3em] ${labelColor}`}>{label}</span>
        <span className="text-[12px] tabular-nums text-faint">{verdict.runtime_ms}ms</span>
      </div>

      {verdict.visible && (
        <>
          <Field label="Expected" value={verdict.expected || '—'} />
          <Field label="Got" value={verdict.actual || '—'} tone={passed ? '' : 'text-dust'} />
          {verdict.stderr && <Field label="Stderr" value={verdict.stderr} tone="text-dust/80" />}
        </>
      )}
    </div>
  )
}

function Field({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.3em] text-faint">{label}</div>
      <pre className={`text-xs font-mono whitespace-pre-wrap break-words leading-relaxed ${tone || 'text-cream/90'}`}>
        {value}
      </pre>
    </div>
  )
}
