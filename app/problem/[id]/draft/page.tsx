import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getProblem, getOrCreateDraft, getSections, getReferenceSolutions } from '@/lib/db/schema'
import { SECTIONS } from '@/lib/draft/sections'
import { bestComplexity } from '@/lib/draft/complexity'
import { SectionForm } from './section-form'
import { GateBanner } from './gate-banner'
import { ProviderToggle } from '@/app/provider-toggle'

export default async function DraftPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const problemId = Number(id)

	if (!problemId) notFound()

	const problem = await getProblem(problemId)
	if (!problem) notFound()

	if (problem.ingest_status === 'pending') {
		redirect(`/?ingesting=${problemId}`)
	}

	const draft = await getOrCreateDraft(problemId)
	const sections = await getSections(draft.id)
	const sectionMap = new Map(sections.map((s) => [s.section_key, s]))
	const refSolutions = await getReferenceSolutions(problemId)
	const target = bestComplexity(refSolutions)

	const requiredCount = SECTIONS.filter((s) => s.required_for_gate).length
	const passedCount = SECTIONS.filter((s) => {
		if (!s.required_for_gate) return false
		const sec = sectionMap.get(s.key)
		return sec?.latest_verdict === 'aligned' || sec?.latest_verdict === 'partial'
	}).length

	return (
		<div className="min-h-screen">
			{/* Top bar */}
			<nav className="border-b border-rule-soft">
				<div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between gap-4">
					<Link
						href="/"
						className="text-[14px] uppercase tracking-[0.25em] text-muted hover:text-amber transition-colors"
					>
						← Index
					</Link>
					<ProviderToggle />
				</div>
			</nav>

			{/* Masthead */}
			<header className="border-b border-rule">
				<div className="max-w-6xl mx-auto px-8 pt-12 pb-10">
					<div className="flex items-baseline justify-between mb-6 gap-6 flex-wrap">
						<span className="text-[13px] uppercase tracking-[0.3em] text-faint">
							Problem №. {String(problemId).padStart(3, '0')}
						</span>
						<div className="flex items-center gap-4 text-[13px] uppercase tracking-[0.3em] text-muted">
							{problem.difficulty && <span>{problem.difficulty}</span>}
							{problem.tags.slice(0, 3).map((tag) => (
								<span key={tag}>· {tag}</span>
							))}
						</div>
					</div>

					<div className="flex items-end justify-between gap-8 flex-wrap">
						<h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] text-cream tracking-tight rise max-w-3xl">
							{problem.title}
						</h1>
						<div className="text-right shrink-0 rise" style={{ animationDelay: '120ms' }}>
							<div className="font-display text-5xl text-amber leading-none tabular-nums">
								{passedCount}<span className="text-faint">/</span>{requiredCount}
							</div>
							<div className="text-[13px] uppercase tracking-[0.3em] text-faint mt-2">
								Sections sealed
							</div>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto px-32 py-12 space-y-12">
				{problem.ingest_status === 'needs_review' && (
					<div className="border border-honey/40 bg-honey/[0.04] px-5 py-3 flex items-center gap-3">
						<span className="text-[13px] uppercase tracking-[0.3em] text-honey shrink-0">Caveat</span>
						<p className="text-xs text-muted">
							No reference solutions passed both verification checks. Feedback may be less reliable.
						</p>
					</div>
				)}

				<GateBanner problemId={problemId} gatePassed={draft.gate_passed} />

				<section>
					<div className="flex items-center justify-between mb-5">
						<h2 className="text-[13px] uppercase tracking-[0.3em] text-faint">
							Source
						</h2>
						<a
							href={problem.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[14px] uppercase tracking-[0.2em] text-muted hover:text-amber transition-colors"
						>
							Open original ↗
						</a>
					</div>
					<div className="border border-rule bg-paper overflow-hidden">
						<iframe
							src={problem.url}
							title={problem.title || 'Problem statement'}
							className="w-full h-[72vh] bg-white"
							referrerPolicy="no-referrer"
						/>
					</div>
				</section>

				{target && (
					<section>
						<h2 className="text-[13px] uppercase tracking-[0.3em] text-faint mb-5">
							Target
						</h2>
						<div className="border border-rule bg-paper px-6 py-5 grid grid-cols-2 gap-8">
							<div>
								<div className="text-[11px] uppercase tracking-[0.3em] text-faint mb-2">
									Time
								</div>
								<div className="font-display text-3xl text-amber tabular-nums leading-none">
									{target.time}
								</div>
							</div>
							<div>
								<div className="text-[11px] uppercase tracking-[0.3em] text-faint mb-2">
									Space
								</div>
								<div className="font-display text-3xl text-amber tabular-nums leading-none">
									{target.space}
								</div>
							</div>
						</div>
						<p className="text-xs text-muted mt-3 leading-relaxed">
							Aim for these in your draft. The best verified approach for this problem hits these bounds.
						</p>
					</section>
				)}

				<section>
					<div className="flex items-baseline justify-between mb-6">
						<h2 className="text-[13px] uppercase tracking-[0.3em] text-faint">
							Draft
						</h2>
						<span className="text-[13px] uppercase tracking-[0.2em] text-faint tabular-nums">
							{SECTIONS.length} sections
						</span>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						{SECTIONS.map((def, i) => (
							<div
								key={def.key}
								className="rise"
								style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
							>
								<SectionForm
									problemId={problemId}
									def={def}
									existing={sectionMap.get(def.key) ?? null}
									index={i}
								/>
							</div>
						))}
					</div>
				</section>
			</main>

			<footer className="max-w-6xl mx-auto px-8 py-10 border-t border-rule-soft">
				<div className="flex items-center justify-between text-[13px] uppercase tracking-[0.3em] text-faint">
					<span>Drafting phase</span>
					<span className="font-display italic text-xs text-muted normal-case tracking-normal">
						No code until the draft is sealed.
					</span>
				</div>
			</footer>
		</div>
	)
}
