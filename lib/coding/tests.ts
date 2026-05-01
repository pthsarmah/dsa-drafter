import { chat } from '@/lib/model/chat'
import { generateTestCasesPrompt } from '@/lib/model/prompts'
import { runPython } from '@/lib/ingest/sandbox'
import { parseExampleInput } from '@/lib/ingest/verify'
import { insertProblemTest } from '@/lib/db/schema'
import type { Example, ModelProvider } from '@/lib/types'

interface TestGenResult {
  tests: unknown[][]
}

interface PersistArgs {
  problemId: number
  title: string
  statement: string
  constraints: string
  examples: Example[]
  referenceCode: string
  provider: ModelProvider
}

export async function generateAndPersistTests(args: PersistArgs): Promise<{
  visibleCount: number
  hiddenCount: number
  errors: string[]
}> {
  const { problemId, title, statement, constraints, examples, referenceCode, provider } = args
  const errors: string[] = []
  let ord = 0

  // 1. Persist examples as visible tests, when their output is concrete (not '?').
  let visibleCount = 0
  for (const ex of examples) {
    if (ex.output === '?' || !ex.output.trim()) continue
    let inputArgs: unknown[]
    try {
      inputArgs = parseExampleInput(ex.input)
    } catch {
      errors.push(`Could not parse example input: ${ex.input.slice(0, 80)}`)
      continue
    }
    let expectedOut: string
    try {
      // Try to JSON-encode the example output. LeetCode outputs are usually JSON-shaped.
      expectedOut = JSON.stringify(JSON.parse(ex.output))
    } catch {
      // Fall back to running reference to canonicalize the expected.
      const oracle = await runPython(referenceCode, JSON.stringify(inputArgs))
      if (!oracle.passed) {
        errors.push(`Reference failed on visible example: ${oracle.error.slice(0, 120)}`)
        continue
      }
      expectedOut = oracle.output.trim()
    }
    await insertProblemTest(problemId, {
      visible: true,
      input_json: JSON.stringify(inputArgs),
      expected_json: expectedOut,
      ord: ord++,
    })
    visibleCount++
  }

  // 2. Generate hidden tests via the model.
  let parsed: TestGenResult | null = null
  try {
    const raw = await chat(
      [{ role: 'user', content: generateTestCasesPrompt(title, statement, constraints, examples, referenceCode) }],
      { format: 'json', temperature: 0.4, provider }
    )
    parsed = parseTestGenJson(raw)
  } catch (err) {
    errors.push(`Test generation model error: ${err instanceof Error ? err.message : String(err)}`)
  }

  let hiddenCount = 0
  if (parsed && Array.isArray(parsed.tests)) {
    let hiddenOrd = 0
    for (const inputArgs of parsed.tests) {
      if (!Array.isArray(inputArgs)) continue
      const stdin = JSON.stringify(inputArgs)
      const oracle = await runPython(referenceCode, stdin)
      if (!oracle.passed) {
        errors.push(`Reference failed on hidden case ${hiddenOrd}: ${oracle.error.slice(0, 120)}`)
        hiddenOrd++
        continue
      }
      const expected = oracle.output.trim()
      if (!expected) {
        errors.push(`Reference produced empty output on hidden case ${hiddenOrd}`)
        hiddenOrd++
        continue
      }
      await insertProblemTest(problemId, {
        visible: false,
        input_json: stdin,
        expected_json: expected,
        ord: hiddenOrd++,
      })
      hiddenCount++
    }
  }

  return { visibleCount, hiddenCount, errors }
}

function parseTestGenJson(raw: string): TestGenResult | null {
  const tryParse = (s: string): TestGenResult | null => {
    try {
      const obj = JSON.parse(s) as TestGenResult
      return Array.isArray(obj.tests) ? obj : null
    } catch {
      return null
    }
  }
  const direct = tryParse(raw)
  if (direct) return direct
  const match = raw.match(/\{[\s\S]+\}/)
  if (match) return tryParse(match[0])
  return null
}
