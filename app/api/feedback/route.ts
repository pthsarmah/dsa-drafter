import { chat, resolveProvider } from '@/lib/model/chat'
import { COACH_SYSTEM, feedbackUserPrompt } from '@/lib/model/prompts'
import { getProblem, getReferenceSolutions, getOrCreateDraft, upsertSection, updateSectionVerdict } from '@/lib/db/schema'
import { getSectionDef } from '@/lib/draft/sections'
import { evaluateAndUpdateGate } from '@/lib/draft/gate'
import type { FeedbackResult, ModelProvider } from '@/lib/types'

export async function POST(request: Request) {
  let problemId: number, sectionKey: string, answer: string, provider: ModelProvider
  try {
    const body = await request.json() as { problemId?: number; sectionKey?: string; answer?: string; provider?: ModelProvider }
    problemId = Number(body.problemId)
    sectionKey = String(body.sectionKey ?? '')
    answer = String(body.answer ?? '').trim()
    provider = resolveProvider(body.provider)
    if (!problemId || !sectionKey) throw new Error('Missing fields')
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!answer) {
    return Response.json({ error: 'Answer cannot be empty' }, { status: 400 })
  }

  const problem = await getProblem(problemId)
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 })

  if (problem.ingest_status !== 'ready') {
    return Response.json({ error: 'Problem not ready yet' }, { status: 409 })
  }

  const sectionDef = getSectionDef(sectionKey)
  if (!sectionDef) return Response.json({ error: 'Unknown section' }, { status: 400 })

  const solutions = await getReferenceSolutions(problemId)
  if (!solutions.length) {
    return Response.json({ error: 'No verified solutions available for this problem' }, { status: 409 })
  }

  const draft = await getOrCreateDraft(problemId)

  // Persist the answer before calling the model
  await upsertSection(draft.id, sectionKey, answer)

  let feedback: FeedbackResult
  try {
    const raw = await chat(
      [
        { role: 'system', content: COACH_SYSTEM },
        { role: 'user', content: feedbackUserPrompt(problem.title, problem.statement, sectionDef, answer, solutions) },
      ],
      { format: 'json', temperature: 0.5, provider }
    )

    let parsed: FeedbackResult
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]+\}/)
      if (!match) throw new Error('Model did not return valid JSON feedback')
      parsed = JSON.parse(match[0])
    }

    feedback = {
      verdict: parsed.verdict ?? 'unclear',
      hint: String(parsed.hint ?? ''),
      followup_question: String(parsed.followup_question ?? ''),
    }

    // Post-filter: strip any backtick code fences to prevent accidental code leakage
    feedback.hint = feedback.hint.replace(/```[\s\S]*?```/g, '[code removed]').trim()
    feedback.followup_question = feedback.followup_question.replace(/```[\s\S]*?```/g, '[code removed]').trim()
  } catch (err) {
    console.error('Feedback model error:', err)
    const msg = provider === 'local'
      ? 'Local model inference failed. Is llama-server running at LLAMA_SERVER_URL?'
      : 'Cloud model inference failed. Check GROQ_API_KEY and network.'
    return Response.json({ error: msg }, { status: 503 })
  }

  // Persist verdict
  await updateSectionVerdict(draft.id, sectionKey, feedback.verdict, feedback.hint, feedback.followup_question)

  // Re-evaluate gate
  const gatePassed = await evaluateAndUpdateGate(problemId)

  return Response.json({ ...feedback, gate_passed: gatePassed })
}
