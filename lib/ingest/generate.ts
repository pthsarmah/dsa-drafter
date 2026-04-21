import { chat, chatStream } from '@/lib/model/chat'
import { selectSolutionsPrompt } from '@/lib/model/prompts'
import { searchSolutions } from './search'
import { extractCodeBlocks, type CodeCandidate } from './extract'
import type { CandidateSolution, Example, ModelProvider } from '@/lib/types'

interface SelectResult {
  solutions: Array<CandidateSolution & { source_url?: string }>
}

const MAX_SNIPPETS_TO_MODEL = Number(process.env.MAX_SNIPPETS ?? 6)

export async function generateCandidates(
  title: string,
  statement: string,
  constraints: string,
  examples: Example[],
  provider?: ModelProvider,
  onChunk?: (text: string) => void
): Promise<CandidateSolution[]> {
  const query = `${title} python solution optimal leetcode`
  onChunk?.(`[search] ${query}\n`)

  const hits = await searchSolutions(query)
  onChunk?.(`[search] ${hits.length} result${hits.length === 1 ? '' : 's'}\n`)
  if (hits.length === 0) throw new Error('No web search results returned')

  const snippets: CodeCandidate[] = []
  for (const hit of hits) {
    if (snippets.length >= MAX_SNIPPETS_TO_MODEL) break
    onChunk?.(`[fetch] ${hit.url}\n`)
    const blocks = await extractCodeBlocks(hit.url)
    for (const b of blocks) {
      if (snippets.length >= MAX_SNIPPETS_TO_MODEL) break
      snippets.push(b)
    }
    onChunk?.(`[fetch]   → ${blocks.length} python block${blocks.length === 1 ? '' : 's'}\n`)
  }

  if (snippets.length === 0) {
    throw new Error('No Python code snippets could be extracted from search results')
  }

  onChunk?.(`[select] passing ${snippets.length} snippets to model\n`)

  const prompt = selectSolutionsPrompt(title, statement, constraints, examples, snippets)

  let raw = ''
  if (onChunk) {
    for await (const piece of chatStream(
      [{ role: 'user', content: prompt }],
      { format: 'json', temperature: 0.2, provider }
    )) {
      if (piece.content) raw += piece.content
      onChunk(piece.reasoning ?? piece.content ?? '')
    }
  } else {
    raw = await chat(
      [{ role: 'user', content: prompt }],
      { format: 'json', temperature: 0.2, provider }
    )
  }

  let parsed: SelectResult
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]+\}/)
    if (!match) throw new Error('Model did not return valid JSON for solutions')
    parsed = JSON.parse(match[0])
  }

  if (!Array.isArray(parsed.solutions)) {
    throw new Error('Model returned unexpected structure: missing "solutions" array')
  }

  return parsed.solutions.map((s) => ({
    approach_name: String(s.approach_name ?? 'Approach'),
    rationale: String(s.rationale ?? ''),
    code: String(s.code ?? ''),
    time_cx: String(s.time_cx ?? 'Unknown'),
    space_cx: String(s.space_cx ?? 'Unknown'),
    key_insights: Array.isArray(s.key_insights) ? s.key_insights.map(String) : [],
  }))
}
