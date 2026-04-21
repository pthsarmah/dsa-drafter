export type IngestStatus = 'pending' | 'ready' | 'needs_review' | 'failed'
export type Verdict = 'aligned' | 'partial' | 'off-track' | 'unclear'
export type ModelProvider = 'local' | 'cloud'

export interface Example {
  input: string
  output: string
  explanation?: string
}

export interface Problem {
  id: number
  url: string
  title: string
  statement: string
  constraints: string
  examples: Example[]
  tags: string[]
  difficulty: string
  ingest_status: IngestStatus
  created_at: number
}

export interface ReferenceSolution {
  id: number
  problem_id: number
  approach_name: string
  code: string
  time_cx: string
  space_cx: string
  key_insights: string[]
  critic_ok: boolean
  tests_ok: boolean
  verification_notes: string
  created_at: number
}

export interface Draft {
  id: number
  problem_id: number
  created_at: number
  updated_at: number
  gate_passed: boolean
}

export interface DraftSection {
  draft_id: number
  section_key: string
  answer: string
  latest_verdict: Verdict | null
  latest_hint: string | null
  updated_at: number
}

export interface VerdictHistoryEntry {
  id: number
  draft_id: number
  section_key: string
  verdict: Verdict
  hint: string
  followup: string
  answer_snapshot: string
  created_at: number
}

export interface SectionDef {
  key: string
  label: string
  description: string
  placeholder: string
  required_for_gate: boolean
  eval_focus?: string
}

export interface CandidateSolution {
  approach_name: string
  rationale: string
  code: string
  time_cx: string
  space_cx: string
  key_insights: string[]
}

export interface FeedbackResult {
  verdict: Verdict
  hint: string
  followup_question: string
}
