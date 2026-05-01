import { open } from 'sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'

let _db: Awaited<ReturnType<typeof open>> | null = null

async function loadDriver(): Promise<typeof import('sqlite3')> {
  return import('sqlite3')
}

export async function getDb() {
  if (_db) return _db

  const DATA_DIR = join(process.cwd(), '.data')
  mkdirSync(DATA_DIR, { recursive: true })

  const sqlite3 = await loadDriver()
  const db = await open({
    filename: join(DATA_DIR, 'app.db'),
    driver: sqlite3.Database,
  })

  await db.run('PRAGMA foreign_keys = ON')

  await db.run(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      statement TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '',
      examples_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT '',
      ingest_status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS reference_solutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      approach_name TEXT NOT NULL,
      code TEXT NOT NULL,
      time_cx TEXT NOT NULL DEFAULT '',
      space_cx TEXT NOT NULL DEFAULT '',
      key_insights_json TEXT NOT NULL DEFAULT '[]',
      critic_ok INTEGER NOT NULL DEFAULT 0,
      tests_ok INTEGER NOT NULL DEFAULT 0,
      verification_notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL UNIQUE REFERENCES problems(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      gate_passed INTEGER NOT NULL DEFAULT 0,
      code_completed INTEGER NOT NULL DEFAULT 0
    )
  `)

  const draftCols: Array<{ name: string }> = await db.all(`PRAGMA table_info(drafts)`)
  if (!draftCols.some((c: { name: string }) => c.name === 'code_completed')) {
    await db.run(`ALTER TABLE drafts ADD COLUMN code_completed INTEGER NOT NULL DEFAULT 0`)
  }

  await db.run(`
    CREATE TABLE IF NOT EXISTS draft_sections (
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      section_key TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      latest_verdict TEXT,
      latest_hint TEXT,
      latest_followup TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (draft_id, section_key)
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS verdict_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
      section_key TEXT NOT NULL,
      verdict TEXT NOT NULL,
      hint TEXT NOT NULL DEFAULT '',
      followup TEXT NOT NULL DEFAULT '',
      answer_snapshot TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS problem_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      visible INTEGER NOT NULL DEFAULT 0,
      input_json TEXT NOT NULL,
      expected_json TEXT NOT NULL,
      ord INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_problem_tests_problem ON problem_tests(problem_id)`)

  await db.run(`
    CREATE TABLE IF NOT EXISTS code_drafts (
      problem_id INTEGER PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT 'cpp',
      code TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS problem_cpp_templates (
      problem_id INTEGER PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
      method_name TEXT NOT NULL,
      starter TEXT NOT NULL,
      harness TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  await db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT 'cpp',
      code TEXT NOT NULL,
      verdict TEXT NOT NULL,
      passed_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      compile_error TEXT NOT NULL DEFAULT '',
      runtime_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  await db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id, created_at DESC)`)

  _db = db
  return db
}