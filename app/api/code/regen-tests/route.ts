import {
  getProblem,
  getOrCreateDraft,
  getReferenceSolutions,
  deleteProblemTests,
} from '@/lib/db/schema'
import { generateAndPersistTests } from '@/lib/coding/tests'
import { resolveProvider } from '@/lib/model/chat'
import type { ModelProvider } from '@/lib/types'

export async function POST(request: Request) {
  let problemId: number
  let provider: ModelProvider
  try {
    const body = (await request.json()) as { problemId?: number; provider?: ModelProvider }
    problemId = Number(body.problemId)
    if (!problemId) throw new Error('Missing problemId')
    provider = resolveProvider(body.provider)
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }

  const problem = await getProblem(problemId)
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 })

  const draft = await getOrCreateDraft(problemId)
  if (!draft.gate_passed) {
    return Response.json({ error: 'Draft is not sealed yet' }, { status: 409 })
  }

  const refs = await getReferenceSolutions(problemId)
  const oracle = refs.find((r) => r.critic_ok && r.tests_ok) ?? refs.find((r) => r.critic_ok)
  if (!oracle) {
    return Response.json({ error: 'No verified reference solution available' }, { status: 409 })
  }

  await deleteProblemTests(problemId)

  const result = await generateAndPersistTests({
    problemId,
    title: problem.title,
    statement: problem.statement,
    constraints: problem.constraints,
    examples: problem.examples,
    referenceCode: oracle.code,
    provider,
  })

  return Response.json({
    ok: true,
    visibleCount: result.visibleCount,
    hiddenCount: result.hiddenCount,
    errors: result.errors,
  })
}
