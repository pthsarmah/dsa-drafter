import { getDb } from './client'
import type {
  Problem,
  ProblemWithProgress,
  ReferenceSolution,
  Draft,
  DraftSection,
  IngestStatus,
  Verdict,
  Example,
  ProblemTest,
  CodeDraft,
  CppTemplate,
  Submission,
  SubmissionVerdict,
} from '@/lib/types'

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

export async function deleteProblem(id: number): Promise<void> {
  const db = await getDb()
  await db.run(`DELETE FROM problems WHERE id = $id`, { $id: id })
}

export async function clearProblemArtifacts(id: number): Promise<void> {
  const db = await getDb()
  await db.run(`DELETE FROM reference_solutions WHERE problem_id = $id`, { $id: id })
  await db.run(`DELETE FROM drafts WHERE problem_id = $id`, { $id: id })
  await db.run(`DELETE FROM problem_tests WHERE problem_id = $id`, { $id: id })
  await db.run(`DELETE FROM code_drafts WHERE problem_id = $id`, { $id: id })
  await db.run(`DELETE FROM submissions WHERE problem_id = $id`, { $id: id })
  await db.run(`DELETE FROM problem_cpp_templates WHERE problem_id = $id`, { $id: id })
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

export async function setCodeCompleted(draftId: number, completed: boolean) {
  const db = await getDb()
  await db.run(`UPDATE drafts SET code_completed = $v, updated_at = unixepoch() WHERE id = $id`, {
    $id: draftId,
    $v: completed ? 1 : 0,
  })
}

// Problem tests

export async function insertProblemTest(
  problemId: number,
  t: { visible: boolean; input_json: string; expected_json: string; ord: number }
): Promise<number> {
  const db = await getDb()
  await db.run(
    `INSERT INTO problem_tests (problem_id, visible, input_json, expected_json, ord)
     VALUES ($problem_id, $visible, $input_json, $expected_json, $ord)`,
    {
      $problem_id: problemId,
      $visible: t.visible ? 1 : 0,
      $input_json: t.input_json,
      $expected_json: t.expected_json,
      $ord: t.ord,
    }
  )
  const row = await db.get<{ id: number }>(`SELECT last_insert_rowid() as id`)
  return row!.id
}

export async function getProblemTests(problemId: number): Promise<ProblemTest[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM problem_tests WHERE problem_id = $problem_id ORDER BY visible DESC, ord ASC, id ASC`,
    { $problem_id: problemId }
  )
  return rows.map(rowToProblemTest)
}

export async function deleteProblemTests(problemId: number): Promise<void> {
  const db = await getDb()
  await db.run(`DELETE FROM problem_tests WHERE problem_id = $problem_id`, { $problem_id: problemId })
}

export async function getVisibleTests(problemId: number): Promise<ProblemTest[]> {
  const db = await getDb()
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM problem_tests WHERE problem_id = $problem_id AND visible = 1 ORDER BY ord ASC, id ASC`,
    { $problem_id: problemId }
  )
  return rows.map(rowToProblemTest)
}

function rowToProblemTest(row: Record<string, unknown>): ProblemTest {
  return {
    id: row.id as number,
    problem_id: row.problem_id as number,
    visible: Boolean(row.visible),
    input_json: row.input_json as string,
    expected_json: row.expected_json as string,
    ord: row.ord as number,
  }
}

// Code drafts

export async function upsertCodeDraft(problemId: number, code: string) {
  const db = await getDb()
  await db.run(
    `INSERT INTO code_drafts (problem_id, language, code, updated_at)
     VALUES ($problem_id, 'cpp', $code, unixepoch())
     ON CONFLICT(problem_id) DO UPDATE SET code = $code, updated_at = unixepoch()`,
    { $problem_id: problemId, $code: code }
  )
}

export async function getCodeDraft(problemId: number): Promise<CodeDraft | null> {
  const db = await getDb()
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM code_drafts WHERE problem_id = $problem_id`,
    { $problem_id: problemId }
  )
  if (!row) return null
  return {
    problem_id: row.problem_id as number,
    language: 'cpp',
    code: row.code as string,
    updated_at: row.updated_at as number,
  }
}

// C++ template (per-problem starter + harness)

export async function upsertCppTemplate(t: {
  problem_id: number
  method_name: string
  starter: string
  harness: string
  notes: string
}) {
  const db = await getDb()
  await db.run(
    `INSERT INTO problem_cpp_templates (problem_id, method_name, starter, harness, notes)
     VALUES ($problem_id, $method_name, $starter, $harness, $notes)
     ON CONFLICT(problem_id) DO UPDATE SET
       method_name = $method_name,
       starter = $starter,
       harness = $harness,
       notes = $notes`,
    {
      $problem_id: t.problem_id,
      $method_name: t.method_name,
      $starter: t.starter,
      $harness: t.harness,
      $notes: t.notes,
    }
  )
}

export async function getCppTemplate(problemId: number): Promise<CppTemplate | null> {
  const db = await getDb()
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM problem_cpp_templates WHERE problem_id = $problem_id`,
    { $problem_id: problemId }
  )
  if (!row) return null
  return {
    problem_id: row.problem_id as number,
    method_name: row.method_name as string,
    starter: row.starter as string,
    harness: row.harness as string,
    notes: row.notes as string,
  }
}

// Submissions

export async function insertSubmission(s: {
  problem_id: number
  code: string
  verdict: SubmissionVerdict
  passed_count: number
  total_count: number
  compile_error: string
  runtime_ms: number
}): Promise<number> {
  const db = await getDb()
  await db.run(
    `INSERT INTO submissions (problem_id, language, code, verdict, passed_count, total_count, compile_error, runtime_ms)
     VALUES ($problem_id, 'cpp', $code, $verdict, $passed_count, $total_count, $compile_error, $runtime_ms)`,
    {
      $problem_id: s.problem_id,
      $code: s.code,
      $verdict: s.verdict,
      $passed_count: s.passed_count,
      $total_count: s.total_count,
      $compile_error: s.compile_error,
      $runtime_ms: s.runtime_ms,
    }
  )
  const row = await db.get<{ id: number }>(`SELECT last_insert_rowid() as id`)
  return row!.id
}

export async function getLatestSubmission(problemId: number): Promise<Submission | null> {
  const db = await getDb()
  const row = await db.get<Record<string, unknown>>(
    `SELECT * FROM submissions WHERE problem_id = $problem_id ORDER BY created_at DESC, id DESC LIMIT 1`,
    { $problem_id: problemId }
  )
  if (!row) return null
  return {
    id: row.id as number,
    problem_id: row.problem_id as number,
    language: 'cpp',
    code: row.code as string,
    verdict: row.verdict as SubmissionVerdict,
    passed_count: row.passed_count as number,
    total_count: row.total_count as number,
    compile_error: row.compile_error as string,
    runtime_ms: row.runtime_ms as number,
    created_at: row.created_at as number,
  }
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