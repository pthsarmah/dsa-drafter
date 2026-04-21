// Web search for DSA problem solutions. Tries Brave Search API when
// BRAVE_API_KEY is set; otherwise falls back to scraping DuckDuckGo's HTML
// search page (no key required, fragile but works for an MVP).

export interface SearchHit {
  url: string
  title: string
  snippet: string
}

const BRAVE_KEY = process.env.BRAVE_API_KEY
const MAX_RESULTS = Number(process.env.SEARCH_MAX_RESULTS ?? 5)

export async function searchSolutions(query: string): Promise<SearchHit[]> {
  if (BRAVE_KEY) return searchBrave(query)
  return searchDuckDuckGo(query)
}

async function searchBrave(query: string): Promise<SearchHit[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`
  const res = await fetch(url, {
    headers: {
      'X-Subscription-Token': BRAVE_KEY!,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Brave search failed: ${res.status}`)
  const data = await res.json() as {
    web?: { results?: Array<{ url: string; title: string; description: string }> }
  }
  const results = data.web?.results ?? []
  return results.slice(0, MAX_RESULTS).map((r) => ({
    url: r.url,
    title: r.title,
    snippet: r.description,
  }))
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`DuckDuckGo search failed: ${res.status}`)
  const html = await res.text()
  return parseDuckDuckGoHtml(html).slice(0, MAX_RESULTS)
}

function parseDuckDuckGoHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = []
  // DDG HTML results are anchors with class="result__a"; snippet in a sibling
  // with class="result__snippet". Href is wrapped in a redirector — unwrap uddg param.
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = resultRe.exec(html))) {
    const rawHref = decodeHtmlEntities(m[1])
    const url = unwrapDdgRedirect(rawHref)
    if (!url || !/^https?:\/\//.test(url)) continue
    hits.push({
      url,
      title: stripTags(m[2]).trim(),
      snippet: stripTags(m[3]).trim(),
    })
  }
  return hits
}

function unwrapDdgRedirect(href: string): string {
  try {
    // Redirector URLs look like //duckduckgo.com/l/?uddg=...&rut=...
    const normalized = href.startsWith('//') ? `https:${href}` : href
    const u = new URL(normalized)
    const target = u.searchParams.get('uddg')
    if (target) return decodeURIComponent(target)
    return normalized
  } catch {
    return ''
  }
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
}
