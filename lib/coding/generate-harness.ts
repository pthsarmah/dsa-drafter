import { chat } from '@/lib/model/chat'
import { generateCppTemplatePrompt } from '@/lib/model/prompts'
import { upsertCppTemplate } from '@/lib/db/schema'
import type { Example, ModelProvider } from '@/lib/types'

interface RawTemplate {
  method_name?: unknown
  starter?: unknown
  harness?: unknown
  notes?: unknown
}

interface GenArgs {
  problemId: number
  title: string
  statement: string
  constraints: string
  examples: Example[]
  referenceCode: string
  provider: ModelProvider
}

export async function generateAndPersistCppTemplate(args: GenArgs): Promise<{
  ok: boolean
  error: string
}> {
  const { problemId, title, statement, constraints, examples, referenceCode, provider } = args

  let raw: string
  try {
    raw = await chat(
      [
        {
          role: 'user',
          content: generateCppTemplatePrompt(title, statement, constraints, examples, referenceCode),
        },
      ],
      { format: 'json', temperature: 0.2, provider }
    )
  } catch (err) {
    return { ok: false, error: `Model error: ${err instanceof Error ? err.message : String(err)}` }
  }

  const parsed = parseTemplateJson(raw)
  if (!parsed) {
    return { ok: false, error: 'Could not parse template JSON from model response' }
  }

  const methodName = String(parsed.method_name ?? '').trim()
  const starter = String(parsed.starter ?? '').trim()
  const harness = String(parsed.harness ?? '').trim()
  const notes = String(parsed.notes ?? '').trim()

  if (!methodName || !starter || !harness) {
    return { ok: false, error: 'Template missing required fields' }
  }
  if (!starter.includes('class Solution')) {
    return { ok: false, error: 'Starter does not contain a Solution class' }
  }
  if (!harness.includes('int main')) {
    return { ok: false, error: 'Harness does not contain int main' }
  }

  await upsertCppTemplate({
    problem_id: problemId,
    method_name: methodName,
    starter,
    harness,
    notes,
  })

  return { ok: true, error: '' }
}

function parseTemplateJson(raw: string): RawTemplate | null {
  const tryParse = (s: string): RawTemplate | null => {
    try {
      const obj = JSON.parse(s) as RawTemplate
      return obj && typeof obj === 'object' ? obj : null
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
