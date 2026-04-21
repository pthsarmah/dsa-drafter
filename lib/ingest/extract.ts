// Fetch a candidate URL and extract Python code blocks. Supports two common
// renderings: markdown triple-backtick fences and <pre><code> HTML blocks.

export interface CodeCandidate {
  source_url: string
  language: string
  code: string
}

const FETCH_TIMEOUT_MS = 12_000
const MAX_CODE_CHARS = 8_000
const MAX_BLOCKS_PER_URL = 4

export async function extractCodeBlocks(url: string): Promise<CodeCandidate[]> {
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  }

  const blocks = [
    ...extractMarkdownFences(html),
    ...extractHtmlPreCode(html),
  ]

  return blocks
    .filter((b) => looksLikePython(b.code))
    .slice(0, MAX_BLOCKS_PER_URL)
    .map((b) => ({
      source_url: url,
      language: b.language,
      code: b.code.length > MAX_CODE_CHARS ? b.code.slice(0, MAX_CODE_CHARS) : b.code,
    }))
}

function extractMarkdownFences(text: string): Array<{ language: string; code: string }> {
  const out: Array<{ language: string; code: string }> = []
  const fenceRe = /```(\w+)?\s*\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text))) {
    out.push({ language: (m[1] ?? '').toLowerCase(), code: m[2] })
  }
  return out
}

function extractHtmlPreCode(html: string): Array<{ language: string; code: string }> {
  const out: Array<{ language: string; code: string }> = []
  const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/gi
  const codeRe = /<code[^>]*(?:class|lang)="([^"]*)"[^>]*>([\s\S]*?)<\/code>/gi
  let m: RegExpExecArray | null

  while ((m = preRe.exec(html))) {
    const inner = m[1]
    const langMatch = /class="[^"]*\blang(?:uage)?-(\w+)/i.exec(inner)
    const codeMatch = /<code[^>]*>([\s\S]*?)<\/code>/i.exec(inner)
    const body = codeMatch ? codeMatch[1] : inner
    out.push({
      language: (langMatch?.[1] ?? '').toLowerCase(),
      code: decodeHtmlEntities(stripTags(body)),
    })
  }

  while ((m = codeRe.exec(html))) {
    const langMatch = /\blang(?:uage)?-(\w+)/i.exec(m[1])
    out.push({
      language: (langMatch?.[1] ?? '').toLowerCase(),
      code: decodeHtmlEntities(stripTags(m[2])),
    })
  }

  return out
}

function looksLikePython(code: string): boolean {
  if (code.length < 40) return false
  const pythonMarkers = /\bdef\s+\w+\s*\(|\bclass\s+\w+\s*:|\bimport\s+\w+|\bfrom\s+\w+\s+import\b|:\s*\n\s{2,}\S/
  return pythonMarkers.test(code)
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}
