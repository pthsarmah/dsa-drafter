import type { Example } from '@/lib/types'

interface FetchedProblem {
  title: string
  statement: string
  constraints: string
  examples: Example[]
  tags: string[]
  difficulty: string
}

function extractLeetCodeSlug(url: string): string | null {
  const match = url.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

async function fetchLeetCode(slug: string): Promise<FetchedProblem> {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        content
        topicTags { name }
        exampleTestcaseList
        hints
      }
    }
  `

  const res = await fetch('https://leetcode.com/graphql/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `https://leetcode.com/problems/${slug}/`,
      'User-Agent': 'Mozilla/5.0 (compatible; DSA-Drafter/1.0)',
    },
    body: JSON.stringify({ query, variables: { titleSlug: slug }, operationName: 'questionData' }),
  })

  if (!res.ok) {
    throw new Error(`LeetCode GraphQL failed: ${res.status}`)
  }

  const json = await res.json() as {
    data: {
      question: {
        title: string
        difficulty: string
        content: string
        topicTags: { name: string }[]
        exampleTestcaseList: string[]
      }
    }
    errors?: { message: string }[]
  }

  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL error: ${json.errors[0].message}`)
  }

  const q = json.data.question
  const { statement, constraints, examples } = parseHtmlContent(q.content, q.exampleTestcaseList)

  return {
    title: q.title,
    difficulty: q.difficulty,
    statement,
    constraints,
    examples,
    tags: q.topicTags.map((t) => t.name),
  }
}

function parseHtmlContent(html: string, exampleTestcases: string[]): {
  statement: string
  constraints: string
  examples: Example[]
} {
  // Strip HTML tags for plain text
  const text = html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Extract constraints section
  const constraintsMatch = text.match(/constraints?:?\s*\n([\s\S]+?)(?:\n\n|$)/i)
  const constraints = constraintsMatch ? constraintsMatch[1].trim() : ''

  // Extract statement (everything before first "Example" or "Constraints")
  const statementMatch = text.match(/^([\s\S]+?)(?=example\s*1|constraints?:)/i)
  const statement = statementMatch ? statementMatch[1].trim() : text.slice(0, 1000)

  // Parse example blocks from text
  const examples: Example[] = []
  const exampleRegex = /example\s*\d+[:\s]*([\s\S]+?)(?=example\s*\d+|constraints?:|$)/gi
  let match
  let i = 0
  while ((match = exampleRegex.exec(text)) !== null && i < 3) {
    const block = match[1].trim()
    const inputMatch = block.match(/input:\s*(.+?)(?=output:|explanation:|$)/is)
    const outputMatch = block.match(/output:\s*(.+?)(?=explanation:|input:|$)/is)
    const explanationMatch = block.match(/explanation:\s*(.+?)(?=input:|output:|$)/is)

    if (inputMatch && outputMatch) {
      examples.push({
        input: inputMatch[1].trim(),
        output: outputMatch[1].trim(),
        explanation: explanationMatch ? explanationMatch[1].trim() : undefined,
      })
      i++
    }
  }

  // Fall back to exampleTestcaseList for inputs if parsing failed
  if (examples.length === 0 && exampleTestcases.length > 0) {
    exampleTestcases.slice(0, 3).forEach((tc) => {
      examples.push({ input: tc, output: '?' })
    })
  }

  return { statement, constraints, examples }
}

async function fetchGeneric(url: string): Promise<FetchedProblem> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DSA-Drafter/1.0)' },
  })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

  const html = await res.text()

  // Best-effort extraction: grab main content
  const mainMatch = html.match(/<main[^>]*>([\s\S]+?)<\/main>/i) ||
    html.match(/<article[^>]*>([\s\S]+?)<\/article>/i) ||
    html.match(/<body[^>]*>([\s\S]+?)<\/body>/i)

  const content = mainMatch ? mainMatch[1] : html

  const text = content
    .replace(/<script[\s\S]+?<\/script>/gi, '')
    .replace(/<style[\s\S]+?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Extract title from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/ ?[-|] .+$/, '').trim() : 'Untitled Problem'

  return {
    title,
    statement: text.slice(0, 2000),
    constraints: '',
    examples: [],
    tags: [],
    difficulty: 'Unknown',
  }
}

export async function fetchProblem(url: string): Promise<FetchedProblem> {
  const slug = extractLeetCodeSlug(url)
  if (slug) {
    return fetchLeetCode(slug)
  }
  return fetchGeneric(url)
}
