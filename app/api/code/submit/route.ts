import {
  getProblem,
  getOrCreateDraft,
  getProblemTests,
  getCppTemplate,
  upsertCodeDraft,
  insertSubmission,
  setCodeCompleted,
} from '@/lib/db/schema'
import { judge } from '@/lib/coding/judge'
import type { JudgeResult, TestVerdict } from '@/lib/types'

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

  const tests = await getProblemTests(problemId)
  if (tests.length === 0) {
    return Response.json({ error: 'No test cases for this problem' }, { status: 409 })
  }

  const template = await getCppTemplate(problemId)
  if (!template) {
    return Response.json(
      { error: 'No C++ harness for this problem yet — re-ingest required' },
      { status: 409 }
    )
  }

  const result = await judge(code, template.harness, tests)

  await insertSubmission({
    problem_id: problemId,
    code,
    verdict: result.overall,
    passed_count: result.passed_count,
    total_count: result.total_count,
    compile_error: result.compile_error,
    runtime_ms: result.total_runtime_ms,
  })

  if (result.overall === 'accepted') {
    await setCodeCompleted(draft.id, true)
  }

  // Redact hidden tests' input/expected/actual before returning to the client.
  const redacted: JudgeResult = {
    ...result,
    results: result.results.map<TestVerdict>((r) =>
      r.visible
        ? r
        : {
            ...r,
            expected: '',
            actual: '',
            stderr: '',
          }
    ),
  }

  return Response.json(redacted)
}
