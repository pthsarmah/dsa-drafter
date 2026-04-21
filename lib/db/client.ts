import { open } from 'sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'

let _db: any = null

export async function getDb() {
  if (_db) return _db

  const DATA_DIR = join(process.cwd(), '.data')
  mkdirSync(DATA_DIR, { recursive: true })

  const db = await open({
    filename: join(DATA_DIR, 'app.db'),
    driver: require('sqlite3').Database,
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
      gate_passed INTEGER NOT NULL DEFAULT 0
    )
  `)

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

  _db = db
  return db
}