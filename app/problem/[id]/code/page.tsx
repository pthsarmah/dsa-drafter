import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getProblem, getDraft } from '@/lib/db/schema'

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

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-rule-soft">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center gap-4">
          <Link
            href={`/problem/${problemId}/draft`}
            className="text-[14px] uppercase tracking-[0.25em] text-muted hover:text-amber transition-colors"
          >
            ← Draft
          </Link>
          <div className="h-3 w-px bg-rule-soft" />
          <span className="text-[14px] uppercase tracking-[0.25em] text-faint truncate">
            {problem.title}
          </span>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="max-w-xl text-center space-y-8">
          <span className="block text-[13px] uppercase tracking-[0.4em] text-sage rise">
            Unlocked
          </span>
          <h1 className="font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.95] text-cream rise" style={{ animationDelay: '80ms' }}>
            The pen is yours<span className="text-amber">.</span>
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-md mx-auto rise" style={{ animationDelay: '160ms' }}>
            You have argued the problem before writing a single line.
            A code editor is the next chapter. Until then —
            implement your approach from the draft you sealed.
          </p>
          <div className="pt-4 rise" style={{ animationDelay: '240ms' }}>
            <Link
              href={`/problem/${problemId}/draft`}
              className="text-[14px] uppercase tracking-[0.25em] text-amber hover:text-cream transition-colors"
            >
              ← Review draft
            </Link>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto w-full px-8 py-10 border-t border-rule-soft">
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
