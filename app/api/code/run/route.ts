import {
  getProblem,
  getOrCreateDraft,
  getVisibleTests,
  getCppTemplate,
  upsertCodeDraft,
} from '@/lib/db/schema'
import { judge } from '@/lib/coding/judge'

export async function POST(request: Request) {
  let problemId: number
  let code: string
  try {
    const body = (await request.json()) as { problemId?: number; code?: string }
    problemId = Number(body.problemId)
    code = String(body.code ?? '')
    if (!problemId || !code.trim()) throw new Error('Missing fields')
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 })
  }

  const problem = await getProblem(problemId)
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 404 })

  const draft = await getOrCreateDraft(problemId)
  if (!draft.gate_passed) {
    return Response.json({ error: 'Draft is not sealed yet' }, { status: 409 })
  }

  await upsertCodeDraft(problemId, code)

  const tests = await getVisibleTests(problemId)
  if (tests.length === 0) {
    return Response.json({ error: 'No visible test cases for this problem' }, { status: 409 })
  }

  const template = await getCppTemplate(problemId)
  if (!template) {
    return Response.json(
      { error: 'No C++ harness for this problem yet — re-ingest required' },
      { status: 409 }
    )
  }

  const result = await judge(code, template.harness, tests)
  return Response.json(result)
}
