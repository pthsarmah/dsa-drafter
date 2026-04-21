import { chat } from '@/lib/model/chat'
import { criticPrompt } from '@/lib/model/prompts'
import { runPython, normalizeOutput, normalizeExpected } from './sandbox'
import type { CandidateSolution, Example, ModelProvider } from '@/lib/types'

interface VerifiedCandidate extends CandidateSolution {
  critic_ok: boolean
  tests_ok: boolean
  verification_notes: string
}

interface CriticResult {
  looks_correct: boolean
  issues: string[]
  complexity_claims_match: boolean
}

async function runCritic(
  title: string,
  statement: string,
  constraints: string,
  candidate: CandidateSolution,
  provider?: ModelProvider
): Promise<CriticResult> {
  const prompt = criticPrompt(title, statement, constraints, candidate)

  const raw = await chat(
    [{ role: 'user', content: prompt }],
    { format: 'json', temperature: 0.1, provider }
  )

  try {
    const result = JSON.parse(raw) as CriticResult
    return {
      looks_correct: Boolean(result.looks_correct),
      issues: Array.isArray(result.issues) ? result.issues.map(String) : [],
      complexity_claims_match: Boolean(result.complexity_claims_match),
    }
  } catch {
    const match = raw.match(/\{[\s\S]+\}/)
    if (match) {
      const result = JSON.parse(match[0]) as CriticResult
      return {
        looks_correct: Boolean(result.looks_correct),
        issues: Array.isArray(result.issues) ? result.issues.map(String) : [],
        complexity_claims_match: Boolean(result.complexity_claims_match),
      }
    }
    // Can't parse critic response — be conservative, mark as failed
    return { looks_correct: false, issues: ['Critic response unparseable'], complexity_claims_match: false }
  }
}

async function runTestCases(code: string, examples: Example[]): Promise<{ passed: boolean; notes: string }> {
  if (!examples.length || examples[0].output === '?') {
    return { passed: true, notes: 'No testable examples available — skipped execution' }
  }

  const results: string[] = []
  let anyFailed = false

  for (let i = 0; i < Math.min(examples.length, 3); i++) {
    const ex = examples[i]

    // Build JSON stdin: wrap the input as an array of arguments
    // LeetCode inputs are like "nums = [2,7,11,15], target = 9"
    // We parse out the values and JSON-encode them
    const args = parseExampleInput(ex.input)
    const stdinJson = JSON.stringify(args)
    const expectedNorm = normalizeExpected(ex.output)

    const result = await runPython(code, stdinJson)

    if (!result.passed) {
      anyFailed = true
      results.push(`Example ${i + 1}: RUNTIME ERROR — ${result.error.slice(0, 200)}`)
      continue
    }

    const actualNorm = normalizeOutput(result.output)
    if (actualNorm === expectedNorm) {
      results.push(`Example ${i + 1}: PASSED`)
    } else {
      anyFailed = true
      results.push(`Example ${i + 1}: FAILED — expected ${expectedNorm}, got ${actualNorm}`)
    }
  }

  return {
    passed: !anyFailed,
    notes: results.join('; '),
  }
}

function parseExampleInput(input: string): unknown[] {
  // Try to parse "key = value, key = value" format
  // Extract just the values, in order
  const valueRegex = /=\s*(\[[\s\S]*?\]|"[^"]*"|-?\d+(?:\.\d+)?|true|false|null)/g
  const values: unknown[] = []
  let match

  while ((match = valueRegex.exec(input)) !== null) {
    try {
      values.push(JSON.parse(match[1]))
    } catch {
      values.push(match[1])
    }
  }

  // If we found nothing, try to parse the whole thing as JSON array
  if (values.length === 0) {
    try {
      const parsed = JSON.parse(input)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return [input]
    }
  }

  return values
}

export async function verifyCandidates(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[],
  candidates: CandidateSolution[],
  provider?: ModelProvider
): Promise<VerifiedCandidate[]> {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const [criticResult, testResult] = await Promise.all([
        runCritic(title, statement, constraints, candidate, provider),
        runTestCases(candidate.code, examples),
      ])

      const notes = [
        criticResult.issues.length ? `Critic issues: ${criticResult.issues.join(', ')}` : 'Critic: OK',
        testResult.notes,
      ].join(' | ')

      return {
        ...candidate,
        critic_ok: criticResult.looks_correct,
        tests_ok: testResult.passed,
        verification_notes: notes,
      }
    })
  )

  return results
}
