import { compileCpp, runBinary, cleanupTmp } from './sandbox'
import { normalizeOutput, normalizeExpected } from '@/lib/ingest/sandbox'
import type { ProblemTest, JudgeResult, TestVerdict, SubmissionVerdict } from '@/lib/types'

const PER_TEST_TIMEOUT_MS = 5_000

export async function judge(
  userCode: string,
  harness: string,
  tests: ProblemTest[]
): Promise<JudgeResult> {
  if (tests.length === 0) {
    return {
      compile_ok: false,
      compile_error: 'No tests available for this problem',
      results: [],
      overall: 'compile_error',
      passed_count: 0,
      total_count: 0,
      total_runtime_ms: 0,
    }
  }

  if (!harness.trim()) {
    return {
      compile_ok: false,
      compile_error: 'No harness available for this problem — re-ingest required',
      results: [],
      overall: 'compile_error',
      passed_count: 0,
      total_count: tests.length,
      total_runtime_ms: 0,
    }
  }

  const { tmpDir, binPath, compile } = await compileCpp(userCode, harness)

  if (!compile.ok) {
    cleanupTmp(tmpDir)
    return {
      compile_ok: false,
      compile_error: compile.error,
      results: [],
      overall: 'compile_error',
      passed_count: 0,
      total_count: tests.length,
      total_runtime_ms: 0,
    }
  }

  const results: TestVerdict[] = []
  let totalRuntime = 0
  let overall: SubmissionVerdict = 'accepted'
  let stop = false

  for (const t of tests) {
    if (stop) break
    const run = await runBinary(binPath, t.input_json, PER_TEST_TIMEOUT_MS)
    totalRuntime += run.runtimeMs

    const expectedNorm = normalizeExpected(t.expected_json)
    const actualNorm = normalizeOutput(run.stdout)

    let passed = false
    let verdictForOverall: SubmissionVerdict | null = null

    if (run.timedOut) {
      verdictForOverall = 'tle'
      stop = true
    } else if (run.exitCode !== 0) {
      verdictForOverall = 'runtime_error'
      stop = true
    } else if (actualNorm === expectedNorm) {
      passed = true
    } else {
      verdictForOverall = 'wrong_answer'
      stop = true
    }

    results.push({
      test_id: t.id,
      ord: t.ord,
      visible: t.visible,
      passed,
      expected: t.expected_json,
      actual: run.stdout.trim(),
      stderr: run.stderr.trim().slice(0, 500),
      timed_out: run.timedOut,
      runtime_ms: run.runtimeMs,
    })

    if (verdictForOverall && overall === 'accepted') {
      overall = verdictForOverall
    }
  }

  cleanupTmp(tmpDir)

  const passedCount = results.filter((r) => r.passed).length

  return {
    compile_ok: true,
    compile_error: '',
    results,
    overall,
    passed_count: passedCount,
    total_count: tests.length,
    total_runtime_ms: totalRuntime,
  }
}
