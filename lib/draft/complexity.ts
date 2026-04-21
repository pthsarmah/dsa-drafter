import type { ReferenceSolution } from '@/lib/types'

// Higher rank = worse complexity. Patterns checked from highest rank to lowest;
// first match wins, so more specific / more costly patterns beat generic ones.
const TIERS: Array<{ rank: number; patterns: RegExp[] }> = [
  { rank: 9, patterns: [/n\s*!|factorial/i] },
  { rank: 8, patterns: [/\d+\s*\^|exp\b/i] },
  { rank: 7, patterns: [/n\s*\^?\s*3|n³/i] },
  { rank: 6, patterns: [/n\s*\^?\s*2|n²|n\s*\*\s*n/i] },
  { rank: 5, patterns: [/\bn\s*\*?\s*log\b/i, /\b([a-z])\s*\*\s*(?!\1\b)[a-z]\b/i] },
  { rank: 4, patterns: [/\bn\b|\b[a-z]\s*\+\s*[a-z]\b/i] },
  { rank: 3, patterns: [/sqrt|√/i] },
  { rank: 2, patterns: [/\blog\b/i] },
  { rank: 1, patterns: [/log\s*\*|log\s*log/i] },
  { rank: 0, patterns: [/^\s*o\s*\(\s*1\s*\)/i] },
]

function rank(cx: string): number {
  for (const tier of TIERS) {
    if (tier.patterns.some((p) => p.test(cx))) return tier.rank
  }
  return 99
}

export function bestComplexity(solutions: ReferenceSolution[]): { time: string; space: string } | null {
  const pool = solutions.filter((s) => s.critic_ok && s.tests_ok).length > 0
    ? solutions.filter((s) => s.critic_ok && s.tests_ok)
    : solutions.filter((s) => s.critic_ok)
  if (pool.length === 0) return null
  const bestTime = pool.reduce((a, b) => (rank(a.time_cx) <= rank(b.time_cx) ? a : b))
  const bestSpace = pool.reduce((a, b) => (rank(a.space_cx) <= rank(b.space_cx) ? a : b))
  return { time: bestTime.time_cx, space: bestSpace.space_cx }
}
