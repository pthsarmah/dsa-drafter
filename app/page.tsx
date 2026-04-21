import Link from 'next/link'
import { listProblems } from '@/lib/db/schema'
import { IngestForm } from './ingest-form'
import { IngestPoller } from './ingest-poller'
import type { IngestStatus } from '@/lib/types'

const STATUS_STYLES: Record<IngestStatus, string> = {
  pending: 'text-muted',
  ready: 'text-sage',
  needs_review: 'text-honey',
  failed: 'text-dust',
}

const STATUS_LABELS: Record<IngestStatus, string> = {
  pending: 'Drafting',
  ready: 'Ready',
  needs_review: 'Partial',
  failed: 'Failed',
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ingesting?: string }>
}) {
  const { ingesting } = await searchParams
  const ingestingId = ingesting ? Number(ingesting) : null

  const problems = await listProblems()

  return (
    <div className="min-h-screen">
      {/* Masthead */}
      <header className="border-b border-rule">
        <div className="max-w-5xl mx-auto px-8 pt-20 pb-16">
          <div className="flex items-baseline justify-between mb-12">
            <span className="text-[13px] uppercase tracking-[0.4em] text-faint">
              DSA · Drafter
            </span>
            <span className="text-[13px] uppercase tracking-[0.3em] text-faint">
              №. {String(problems.length).padStart(3, '0')}
            </span>
          </div>

          <h1 className="font-display text-[clamp(3.5rem,9vw,7rem)] leading-[0.9] text-cream tracking-tight rise">
            Think<span className="text-amber">,</span>
            <span className="italic text-muted block">then write.</span>
          </h1>

          <p className="text-sm text-muted max-w-lg mt-10 leading-relaxed rise" style={{ animationDelay: '120ms' }}>
            A drafting journal for algorithmic problems. Work through structure,
            invariants, and edges by hand. The model reads with you — hinting,
            never answering.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-16 space-y-20">
        <section className="rise" style={{ animationDelay: '200ms' }}>
          <IngestForm />
          {ingestingId && (
            <div className="mt-8">
              <IngestPoller problemId={ingestingId} />
            </div>
          )}
        </section>

        {problems.length > 0 && (
          <section className="rise" style={{ animationDelay: '280ms' }}>
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-[13px] uppercase tracking-[0.3em] text-faint">
                Index
              </h2>
              <span className="text-[13px] uppercase tracking-[0.2em] text-faint tabular-nums">
                {problems.length} {problems.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <div className="border-t border-rule">
              {problems.map((p, i) => {
                const canOpen = p.ingest_status === 'ready' || p.ingest_status === 'needs_review'
                const content = (
                  <div className="grid grid-cols-[44px_1fr_auto] items-baseline gap-6 py-6 border-b border-rule-soft group hover:bg-paper/50 transition-colors px-1 -mx-1">
                    <span className="font-mono text-[14px] text-faint tabular-nums pt-1">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl leading-snug text-cream truncate group-hover:text-amber transition-colors">
                        {p.title || p.url}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-[13px] uppercase tracking-[0.2em] text-muted">
                        {p.difficulty && <span>{p.difficulty}</span>}
                        {p.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>· {tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <span className={`text-[13px] uppercase tracking-[0.25em] ${STATUS_STYLES[p.ingest_status]}`}>
                        {STATUS_LABELS[p.ingest_status]}
                      </span>
                      {canOpen && (
                        <span className="text-[14px] uppercase tracking-[0.2em] text-amber group-hover:translate-x-1 transition-transform">
                          Open →
                        </span>
                      )}
                    </div>
                  </div>
                )

                return canOpen ? (
                  <Link key={p.id} href={`/problem/${p.id}/draft`} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={p.id}>{content}</div>
                )
              })}
            </div>
          </section>
        )}

        {problems.length === 0 && !ingestingId && (
          <div className="text-center py-20 rise" style={{ animationDelay: '360ms' }}>
            <p className="font-display italic text-3xl text-muted">A blank page.</p>
            <p className="text-xs text-faint mt-3 uppercase tracking-[0.3em]">
              Paste a problem URL to begin
            </p>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-8 py-12 border-t border-rule-soft">
        <div className="flex items-center justify-between text-[13px] uppercase tracking-[0.3em] text-faint">
          <span>Local-first · BYO-model</span>
          <span className="font-display italic text-xs text-muted normal-case tracking-normal">
            Ink, not silicon.
          </span>
        </div>
      </footer>
    </div>
  )
}
