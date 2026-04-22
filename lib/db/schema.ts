import { getDb } from './client'
import type { Problem, ProblemWithProgress, ReferenceSolution, Draft, DraftSection, IngestStatus, Verdict, Example } from '@/lib/types'

type BindValue = string | number | bigint | boolean | null | Uint8Array
type Bindings = Record<string, BindValue>

// Problems

export async function createProblem(url: string): Promise<number> {
  const db = await getDb()
  await db.run(`INSERT OR IGNORE INTO problems (url) VALUES ($url)`, { $url: url })
  const row = await db.get<{ id: number }>(`SELECT id FROM problems WHERE url = $url`, { $url: url })
  return row!.id
}

export async function updateProblem(
  id: number,
  fields: Partial<{
    title: string
    statement: string
    constraints: string
    examples: Example[]
    tags: string[]
    difficulty: string
    ingest_status: IngestStatus
  }>
) {
  const db = await getDb()
  const sets: string[] = []
  const params: Bindings = { $id: id }

  if (fields.title !== undefined) { sets.push('title = $title'); params.$title = fields.title }
  if (fields.statement !== undefined) { sets.push('statement = $statement'); params.$statement = fields.statement }
  if (fields.constraints !== undefined) { sets.push('constraints = $constraints'); params.$constraints = fields.constraints }
  if (fields.examples !== undefined) { sets.push('examples_json = $examples_json'); params.$examples_json = JSON.stringify(fields.examples) }
  if (fields.tags !== undefined) { sets.push('tags_json = $tags_json'); params.$tags_json = JSON.stringify(fields.tags) }
  if (fields.difficulty !== undefined) { sets.push('difficulty = $difficulty'); params.$difficulty = fields.difficulty }
  if (fields.ingest_status !== undefined) { sets.push('ingest_status = $ingest_status'); params.$ingest_status = fields.ingest_status }

  if (sets.length === 0) return
  await db.run(`UPDATE problems SET ${sets.join(', ')} WHERE id = $id`, params)
}

export async function getProblem(id: number): Promise<Problem | null> {
  const db = await getDb()
  const row = await db.get<Record<string, unknown>>(`SELECT * FROM problems WHERE id = $id`, { $id: id })
  if (!row) return null
  return rowToProblem(row)
}

export async function listProblems(): Promise<Problem[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(`SELECT * FROM problems ORDER BY created_at DESC`)
  return rows.map(rowToProblem)
}

export async function listProblemsWithProgress(): Promise<ProblemWithProgress[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(`
    SELECT p.*,
      COALESCE(d.gate_passed, 0) AS gate_passed,
      COALESCE(d.code_completed, 0) AS code_completed
    FROM problems p
    LEFT JOIN drafts d ON d.problem_id = p.id
    ORDER BY p.created_at DESC
  `)
  return rows.map((row) => ({
    ...rowToProblem(row),
    draft_done: Boolean(row.gate_passed),
    code_done: Boolean(row.code_completed),
  }))
}

function rowToProblem(row: Record<string, unknown>): Problem {
  return {
    id: row.id as number,
    url: row.url as string,
    title: row.title as string,
    statement: row.statement as string,
    constraints: row.constraints as string,
    examples: JSON.parse(row.examples_json as string),
    tags: JSON.parse(row.tags_json as string),
    difficulty: row.difficulty as string,
    ingest_status: row.ingest_status as IngestStatus,
    created_at: row.created_at as number,
  }
}

// Reference Solutions

export async function insertReferenceSolution(
  problemId: number,
  s: {
    approach_name: string
    code: string
    time_cx: string
    space_cx: string
    key_insights: string[]
    critic_ok: boolean
    tests_ok: boolean
    verification_notes: string
  }
): Promise<number> {
  const db = await getDb()
  await db.run(`
    INSERT INTO reference_solutions
      (problem_id, approach_name, code, time_cx, space_cx, key_insights_json, critic_ok, tests_ok, verification_notes)
    VALUES ($problem_id, $approach_name, $code, $time_cx, $space_cx, $key_insights_json, $critic_ok, $tests_ok, $verification_notes)
  `, {
    $problem_id: problemId,
    $approach_name: s.approach_name,
    $code: s.code,
    $time_cx: s.time_cx,
    $space_cx: s.space_cx,
    $key_insights_json: JSON.stringify(s.key_insights),
    $critic_ok: s.critic_ok ? 1 : 0,
    $tests_ok: s.tests_ok ? 1 : 0,
    $verification_notes: s.verification_notes,
  })
  const row = await db.get<{ id: number }>(`SELECT last_insert_rowid() as id`)
  return row!.id
}

export async function getReferenceSolutions(problemId: number): Promise<ReferenceSolution[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM reference_solutions WHERE problem_id = $problem_id AND critic_ok = 1`,
    { $problem_id: problemId }
  )

  return rows.map((row) => ({
    id: row.id as number,
    problem_id: row.problem_id as number,
    approach_name: row.approach_name as string,
    code: row.code as string,
    time_cx: row.time_cx as string,
    space_cx: row.space_cx as string,
    key_insights: JSON.parse(row.key_insights_json as string),
    critic_ok: Boolean(row.critic_ok),
    tests_ok: Boolean(row.tests_ok),
    verification_notes: row.verification_notes as string,
    created_at: row.created_at as number,
  }))
}

// Drafts

export async function getOrCreateDraft(problemId: number): Promise<Draft> {
  const db = await getDb()
  await db.run(`INSERT OR IGNORE INTO drafts (problem_id) VALUES ($problem_id)`, { $problem_id: problemId })
  const row = await db.get<Record<string, unknown>>(`SELECT * FROM drafts WHERE problem_id = $problem_id`, { $problem_id: problemId })
  return rowToDraft(row)
}

export async function getDraft(problemId: number): Promise<Draft | null> {
  const db = await getDb()
  const row = await db.get<Record<string, unknown>>(`SELECT * FROM drafts WHERE problem_id = $problem_id`, { $problem_id: problemId })
  if (!row) return null
  return rowToDraft(row)
}

function rowToDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as number,
    problem_id: row.problem_id as number,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    gate_passed: Boolean(row.gate_passed),
    code_completed: Boolean(row.code_completed),
  }
}

export async function setGatePassed(draftId: number, passed: boolean) {
  const db = await getDb()
  await db.run(`UPDATE drafts SET gate_passed = $v, updated_at = unixepoch() WHERE id = $id`, {
    $id: draftId,
    $v: passed ? 1 : 0,
  })
}

// Draft Sections

export async function upsertSection(draftId: number, sectionKey: string, answer: string) {
  const db = await getDb()
  await db.run(`
    INSERT INTO draft_sections (draft_id, section_key, answer, updated_at)
    VALUES ($draft_id, $section_key, $answer, unixepoch())
    ON CONFLICT(draft_id, section_key) DO UPDATE SET answer = $answer, updated_at = unixepoch()
  `, { $draft_id: draftId, $section_key: sectionKey, $answer: answer })
}

export async function updateSectionVerdict(
  draftId: number,
  sectionKey: string,
  verdict: Verdict,
  hint: string,
  followup: string
) {
  const db = await getDb()
  await db.run(`
    UPDATE draft_sections
    SET latest_verdict = $verdict, latest_hint = $hint, latest_followup = $followup, updated_at = unixepoch()
    WHERE draft_id = $draft_id AND section_key = $section_key
  `, { $draft_id: draftId, $section_key: sectionKey, $verdict: verdict, $hint: hint, $followup: followup })

  await db.run(`
    INSERT INTO verdict_history (draft_id, section_key, verdict, hint, followup, answer_snapshot)
    SELECT $draft_id, $section_key, $verdict, $hint, $followup, answer
    FROM draft_sections WHERE draft_id = $draft_id AND section_key = $section_key
  `, { $draft_id: draftId, $section_key: sectionKey, $verdict: verdict, $hint: hint, $followup: followup })

  await db.run(`UPDATE drafts SET updated_at = unixepoch() WHERE id = $id`, { $id: draftId })
}

export async function getSections(draftId: number): Promise<DraftSection[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(`SELECT * FROM draft_sections WHERE draft_id = $draft_id`, { $draft_id: draftId })
  return rows.map((row) => ({
    draft_id: row.draft_id as number,
    section_key: row.section_key as string,
    answer: row.answer as string,
    latest_verdict: row.latest_verdict as Verdict | null,
    latest_hint: row.latest_hint as string | null,
    updated_at: row.updated_at as number,
  }))
}