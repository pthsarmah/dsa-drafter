'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SectionDef, DraftSection, Verdict } from '@/lib/types'
import { useProvider } from '@/app/provider-toggle'

interface SectionState {
	verdict: Verdict | null
	hint: string
	followup: string
	error: string
}

const VERDICT_STYLES: Record<Verdict, { border: string; text: string; label: string }> = {
	aligned: { border: 'border-sage/60', text: 'text-sage', label: 'Aligned' },
	partial: { border: 'border-honey/60', text: 'text-honey', label: 'Partial' },
	'off-track': { border: 'border-dust/60', text: 'text-dust', label: 'Off course' },
	unclear: { border: 'border-faint', text: 'text-muted', label: 'Unclear' },
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV']

interface Props {
	problemId: number
	def: SectionDef
	existing: DraftSection | null
	index: number
}

export function SectionForm({ problemId, def, existing, index }: Props) {
	const [answer, setAnswer] = useState(existing?.answer ?? '')
	const [result, setResult] = useState<SectionState>({
		verdict: (existing?.latest_verdict as Verdict | null) ?? null,
		hint: existing?.latest_hint ?? '',
		followup: '',
		error: '',
	})
	const [pending, setPending] = useState(false)
	const [provider] = useProvider()
	const router = useRouter()

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!answer.trim() || pending) return

		setPending(true)
		setResult((r) => ({ ...r, error: '' }))

		try {
			const res = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ problemId, sectionKey: def.key, answer, provider }),
			})

			const data = await res.json() as SectionState & { gate_passed?: boolean; error?: string; followup_question?: string }

			if (!res.ok) {
				setResult((r) => ({ ...r, error: data.error ?? 'Something went wrong' }))
				return
			}

			setResult({
				verdict: data.verdict,
				hint: data.hint,
				followup: data.followup_question ?? data.followup ?? '',
				error: '',
			})
			router.refresh()
		} catch {
			setResult((r) => ({ ...r, error: 'Network error — check that the server is running' }))
		} finally {
			setPending(false)
		}
	}

	const verdictStyle = result.verdict ? VERDICT_STYLES[result.verdict] : null

	return (
		<article className="border border-rule bg-paper hover:border-rule/80 transition-colors h-full">
			<header className="flex items-start gap-5 px-6 py-5 border-b border-rule-soft">
				<span className="font-display italic text-4xl text-amber/90 leading-none pt-0.5 shrink-0 w-10">
					{ROMAN[index] ?? String(index + 1)}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-baseline gap-2 flex-wrap">
						<h3 className="font-display text-xl text-cream leading-tight">{def.label}</h3>
						{!def.required_for_gate && (
							<span className="text-[12px] uppercase tracking-[0.25em] text-faint">Optional</span>
						)}
					</div>
					<p className="text-xs text-muted mt-1.5 leading-relaxed">{def.description}</p>
				</div>
			</header>

			<form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
				<textarea
					value={answer}
					onChange={(e) => setAnswer(e.target.value)}
					placeholder={def.placeholder}
					rows={10}
					className="w-full bg-ink/60 border border-rule-soft px-4 py-3 text-sm text-cream placeholder-faint focus:outline-none focus:border-amber/60 resize-none font-mono leading-relaxed"
				/>
				<div className="flex items-center gap-4">
					<button
						type="submit"
						disabled={pending || !answer.trim()}
						className="text-[14px] uppercase tracking-[0.25em] text-amber hover:text-cream disabled:text-faint disabled:cursor-not-allowed transition-colors"
					>
						{pending ? 'Reading…' : 'Check →'}
					</button>
				</div>
			</form>

			{result.error && (
				<div className="px-6 py-4 border-t border-rule-soft">
					<p className="text-xs text-dust font-mono">{result.error}</p>
				</div>
			)}

			{result.verdict && !result.error && verdictStyle && (
				<div className={`px-6 py-5 border-t ${verdictStyle.border} bg-raised/40 drift space-y-3`}>
					<div className="flex items-center gap-3">
						<span className={`text-[13px] uppercase tracking-[0.3em] ${verdictStyle.text}`}>
							{verdictStyle.label}
						</span>
						<div className="flex-1 rule-dashed" />
					</div>
					{result.hint && (
						<p className="text-sm text-cream/90 leading-relaxed">{result.hint}</p>
					)}
					{result.followup && result.verdict !== 'aligned' && (
						<p className="font-display italic text-base text-muted leading-snug">
							— {result.followup}
						</p>
					)}
				</div>
			)}
		</article>
	)
}
