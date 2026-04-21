import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TIMEOUT_MS = 8000

interface RunResult {
  passed: boolean
  output: string
  error: string
}

export async function runPython(code: string, stdinInput: string): Promise<RunResult> {
  const tmpPath = join(tmpdir(), `dsa_${Date.now()}_${Math.random().toString(36).slice(2)}.py`)

  try {
    writeFileSync(tmpPath, code, 'utf8')

    const proc = Bun.spawn(['python3', tmpPath], {
      stdin: new TextEncoder().encode(stdinInput),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
    const result = await Promise.race([proc.exited, timeout])

    if (result === null) {
      proc.kill()
      return { passed: false, output: '', error: 'Timeout exceeded' }
    }

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    return {
      passed: proc.exitCode === 0,
      output: stdout.trim(),
      error: stderr.trim(),
    }
  } catch (err) {
    return { passed: false, output: '', error: String(err) }
  } finally {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}

export function normalizeOutput(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw))
  } catch {
    return raw.trim().toLowerCase()
  }
}

export function normalizeExpected(expected: string): string {
  return normalizeOutput(expected)
}
