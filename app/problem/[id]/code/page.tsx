import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  getProblem,
  getDraft,
  getCodeDraft,
  getVisibleTests,
  getProblemTests,
  getLatestSubmission,
  getReferenceSolutions,
  getCppTemplate,
} from '@/lib/db/schema'
import { bestComplexity } from '@/lib/draft/complexity'
import { starterCpp } from '@/lib/coding/starter'
import { CodeWorkspace } from './code-workspace'

export default async function CodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const problemId = Number(id)
  if (!problemId) notFound()

  const problem = await getProblem(problemId)
  if (!problem) notFound()

  const draft = await getDraft(problemId)
  if (!draft?.gate_passed) {
    redirect(`/problem/${problemId}/draft`)
  }

  const [codeDraft, visibleTests, allTests, latestSubmission, refSolutions, template] = await Promise.all([
    getCodeDraft(problemId),
    getVisibleTests(problemId),
    getProblemTests(problemId),
    getLatestSubmission(problemId),
    getReferenceSolutions(problemId),
    getCppTemplate(problemId),
  ])

  const hiddenTestCount = allTests.length - visibleTests.length
  const target = bestComplexity(refSolutions)
  const accepted = latestSubmission?.verdict === 'accepted'
  const starter = template?.starter ?? starterCpp()
  const harnessReady = Boolean(template)

  return (
    <div className="min-h-screen">
      <nav className="border-b border-rule-soft">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <Link
            href={`/problem/${problemId}/draft`}
            className="text-[14px] uppercase tracking-[0.25em] text-muted hover:text-amber transition-colors"
          >
            ← Draft
          </Link>
          <div className="flex items-center gap-4">
            {accepted && (
              <span className="text-[12px] uppercase tracking-[0.3em] text-sage">Accepted</span>
            )}
            <span className="text-[13px] uppercase tracking-[0.25em] text-faint truncate max-w-[40ch]">
              {problem.title}
            </span>
          </div>
        </div>
      </nav>

      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-8 pt-12 pb-8 space-y-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <span className="text-[13px] uppercase tracking-[0.3em] text-faint">
              Problem №. {String(problemId).padStart(3, '0')} · Code phase
            </span>
            <div className="flex items-center gap-4 text-[13px] uppercase tracking-[0.3em] text-muted">
              {problem.difficulty && <span>{problem.difficulty}</span>}
              {problem.tags.slice(0, 3).map((tag) => (
                <span key={tag}>· {tag}</span>
              ))}
            </div>
          </div>
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.95] text-cream tracking-tight rise max-w-3xl">
            {problem.title}
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-12">
        <aside className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] uppercase tracking-[0.3em] text-faint">Problem</h2>
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] uppercase tracking-[0.2em] text-muted hover:text-amber transition-colors"
              >
                Original ↗
              </a>
            </div>
            <div className="border border-rule bg-paper/40 p-5 space-y-4 max-h-[40vh] overflow-y-auto">
              <p className="text-sm text-cream/85 whitespace-pre-wrap leading-relaxed">
                {problem.statement || '—'}
              </p>
              {problem.constraints && (
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-faint mb-1">Constraints</div>
                  <pre className="text-xs text-muted whitespace-pre-wrap font-mono leading-relaxed">
                    {problem.constraints}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {target && (
            <section>
              <h2 className="text-[13px] uppercase tracking-[0.3em] text-faint mb-4">Target</h2>
              <div className="border border-rule bg-paper px-5 py-4 grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-faint mb-1">Time</div>
                  <div className="font-display text-2xl text-amber tabular-nums leading-none">{target.time}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-faint mb-1">Space</div>
                  <div className="font-display text-2xl text-amber tabular-nums leading-none">{target.space}</div>
                </div>
              </div>
            </section>
          )}

          {visibleTests.length > 0 && (
            <section>
              <h2 className="text-[13px] uppercase tracking-[0.3em] text-faint mb-4">Examples</h2>
              <div className="space-y-3">
                {visibleTests.map((t, i) => (
                  <div key={t.id} className="border border-rule-soft bg-paper/30 px-4 py-3 space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-faint">Example {i + 1}</div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-faint mb-1">Input (JSON args)</div>
                      <pre className="text-xs font-mono text-cream/85 whitespace-pre-wrap break-all">
                        {t.input_json}
                      </pre>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-faint mb-1">Expected</div>
                      <pre className="text-xs font-mono text-amber/90 whitespace-pre-wrap break-all">
                        {t.expected_json}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[13px] uppercase tracking-[0.3em] text-faint mb-4">How it works</h2>
            <div className="border border-rule-soft bg-paper/20 px-4 py-3 space-y-2 text-xs text-muted leading-relaxed">
              <p>
                Write the body of <code className="text-amber">class Solution</code> only. The driver, I/O, and
                <code className="text-amber"> int main</code> are hidden — same as LeetCode.
              </p>
              <p>
                <code className="text-amber">TreeNode</code>, <code className="text-amber">ListNode</code>,
                <code className="text-amber"> &lt;bits/stdc++.h&gt;</code>, and
                <code className="text-amber"> nlohmann::json</code> are pre-included.
              </p>
              {template?.notes && (
                <p>
                  <span className="text-cream/85">Notes</span>: {template.notes}
                </p>
              )}
              {!harnessReady && (
                <p className="text-honey">
                  Harness not generated yet — click <span className="text-amber">Build harness</span> above to enable Run/Submit.
                </p>
              )}
            </div>
          </section>
        </aside>

        <section>
          <CodeWorkspace
            problemId={problemId}
            initialCode={codeDraft?.code ?? ''}
            starter={starter}
            visibleTests={visibleTests}
            hiddenTestCount={hiddenTestCount}
            latestVerdict={latestSubmission?.verdict ?? null}
            harnessReady={harnessReady}
          />
        </section>
      </main>

      <footer className="max-w-6xl mx-auto w-full px-8 py-10 border-t border-rule-soft">
        <div className="flex items-center justify-between text-[13px] uppercase tracking-[0.3em] text-faint">
          <span>Code phase</span>
          <span className="font-display italic text-xs text-muted normal-case tracking-normal">
            Write it well.
          </span>
        </div>
      </footer>
    </div>
  )
}
