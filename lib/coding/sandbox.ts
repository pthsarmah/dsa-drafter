import { mkdtempSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'node:child_process'
import { CPP_PRELUDE_HEADER } from './prelude'

const COMPILE_TIMEOUT_MS = 15_000
const DEFAULT_RUN_TIMEOUT_MS = 5_000
const MEMORY_BYTES = 512 * 1024 * 1024
const CPU_SECONDS = 10
const HEADER_PATH = join(process.cwd(), 'lib', 'coding', 'cpp', 'json.hpp')

export interface CompileResult {
  ok: boolean
  error: string
}

export interface RunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  runtimeMs: number
}

export interface CompiledArtifact {
  tmpDir: string
  binPath: string
  compile: CompileResult
}

const PRELUDE_INCLUDE_LINE = `#include "prelude.h"\n`

export async function compileCpp(userCode: string, harness: string): Promise<CompiledArtifact> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'dsa_cpp_'))
  const srcPath = join(tmpDir, 'main.cpp')
  const preludePath = join(tmpDir, 'prelude.h')
  const headerDest = join(tmpDir, 'json.hpp')
  const binPath = join(tmpDir, 'main')

  // Single #include line keeps user line numbers in compile errors close to what they wrote.
  const fullSource = `${PRELUDE_INCLUDE_LINE}\n${userCode.trimEnd()}\n\n${harness.trimEnd()}\n`

  writeFileSync(preludePath, CPP_PRELUDE_HEADER, 'utf8')
  writeFileSync(srcPath, fullSource, 'utf8')
  if (existsSync(HEADER_PATH)) {
    copyFileSync(HEADER_PATH, headerDest)
  }

  const { exitCode, stderr, timedOut } = await runProcess(
    'g++',
    ['-O2', '-std=c++20', '-pipe', '-w', '-o', binPath, srcPath],
    { timeoutMs: COMPILE_TIMEOUT_MS }
  )

  if (timedOut) {
    return { tmpDir, binPath, compile: { ok: false, error: 'Compilation timed out' } }
  }

  if (exitCode !== 0) {
    return {
      tmpDir,
      binPath,
      compile: { ok: false, error: stripTmpPaths(stderr.trim()) || 'g++ exited non-zero' },
    }
  }

  return { tmpDir, binPath, compile: { ok: true, error: '' } }
}

export async function runBinary(
  binPath: string,
  stdinInput: string,
  timeoutMs = DEFAULT_RUN_TIMEOUT_MS
): Promise<RunResult> {
  return runProcess(
    'prlimit',
    [`--as=${MEMORY_BYTES}`, `--cpu=${CPU_SECONDS}`, binPath],
    { timeoutMs, stdinInput }
  )
}

interface RunOpts {
  timeoutMs: number
  stdinInput?: string
}

async function runProcess(
  cmd: string,
  args: string[],
  { timeoutMs, stdinInput }: RunOpts
): Promise<RunResult> {
  const start = Date.now()
  const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })

  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })
  proc.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })

  if (stdinInput !== undefined) {
    proc.stdin.write(stdinInput)
  }
  proc.stdin.end()

  let timedOut = false
  const exit = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
      resolve(null)
    }, timeoutMs)
    proc.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
    proc.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })

  return {
    exitCode: timedOut ? null : exit,
    stdout,
    stderr,
    timedOut,
    runtimeMs: Date.now() - start,
  }
}

export function cleanupTmp(tmpDir: string): void {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

// Replace `/tmp/dsa_cpp_xxx/` with relative paths in g++ output for readability.
function stripTmpPaths(stderr: string): string {
  return stderr.replace(/\/tmp\/dsa_cpp_[A-Za-z0-9]+\//g, '')
}
