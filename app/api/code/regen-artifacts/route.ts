import {
  getProblem,
  getOrCreateDraft,
  getReferenceSolutions,
  deleteProblemTests,
  getCppTemplate,
} from '@/lib/db/schema'
import { generateAndPersistTests } from '@/lib/coding/tests'
import { generateAndPersistCppTemplate } from '@/lib/coding/generate-harness'
import { resolveProvider } from '@/lib/model/chat'
import type { ModelProvider } from '@/lib/types'

type Scope = 'all' | 'tests' | 'harness'

interface Body {
  problemId?: number
  provider?: ModelProvider
  scope?: Scope
}

export async function POST(request: Request) {
  let problemId: number
  let provider: ModelProvider
  let scope: Scope
  try {
    const body = (await request.json()) as Body
    problemId = Number(body.problemId)
    if (!problemId) throw new Error('Missing problemId')
    provider = resolveProvider(body.provider)
    scope = body.scope === 'tests' || body.scope === 'harness' ? body.scope : 'all'
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

  let visibleCount: number | undefined
  let hiddenCount: number | undefined
  let testErrors: string[] | undefined
  let harnessOk: boolean | undefined
  let harnessError: string | undefined

  if (scope === 'tests' || scope === 'all') {
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
    visibleCount = result.visibleCount
    hiddenCount = result.hiddenCount
    testErrors = result.errors
  }

  if (scope === 'harness' || scope === 'all') {
    const existing = scope === 'all' ? null : await getCppTemplate(problemId)
    if (scope === 'all' || !existing) {
      const tmpl = await generateAndPersistCppTemplate({
        problemId,
        title: problem.title,
        statement: problem.statement,
        constraints: problem.constraints,
        examples: problem.examples,
        referenceCode: oracle.code,
        provider,
      })
      harnessOk = tmpl.ok
      harnessError = tmpl.error || undefined
    } else {
      harnessOk = true
    }
  }

  return Response.json({
    ok: true,
    scope,
    visibleCount,
    hiddenCount,
    errors: testErrors,
    harnessOk,
    harnessError,
  })
}
