import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'node:child_process'

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

    const proc = spawn('python3', [tmpPath], { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    proc.stdin.write(stdinInput)
    proc.stdin.end()

    let timedOut = false
    const exitCode = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGKILL')
        resolve(null)
      }, TIMEOUT_MS)
      proc.on('exit', (code) => { clearTimeout(timer); resolve(code) })
      proc.on('error', () => { clearTimeout(timer); resolve(null) })
    })

    if (timedOut) {
      return { passed: false, output: '', error: 'Timeout exceeded' }
    }

    return {
      passed: exitCode === 0,
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
