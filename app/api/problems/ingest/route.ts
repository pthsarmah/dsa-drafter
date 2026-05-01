import { fetchProblem } from '@/lib/ingest/fetch'
import { generateCandidates } from '@/lib/ingest/generate'
import { verifyCandidates } from '@/lib/ingest/verify'
import { createProblem, updateProblem, insertReferenceSolution, getProblem } from '@/lib/db/schema'
import { resolveProvider } from '@/lib/model/chat'
import { publish } from '@/lib/ingest/stream-bus'
import { generateAndPersistTests } from '@/lib/coding/tests'
import { generateAndPersistCppTemplate } from '@/lib/coding/generate-harness'
import type { ModelProvider } from '@/lib/types'

export async function POST(request: Request) {
  let url: string
  let provider: ModelProvider
  try {
    const body = await request.json() as { url?: string; provider?: ModelProvider }
    url = body.url?.trim() ?? ''
    if (!url) throw new Error('Missing url')
    new URL(url) // validate
    provider = resolveProvider(body.provider)
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Create problem row immediately so we can track status
  const problemId = await createProblem(url)
  await updateProblem(problemId, { ingest_status: 'pending' })

  // Run pipeline asynchronously so this request can return quickly
  // The client polls for status
  runIngestion(problemId, url, provider).catch(console.error)

  return Response.json({ problemId, status: 'pending' })
}

async function runIngestion(problemId: number, url: string, provider: ModelProvider) {
  try {
    // Step 1: Fetch problem
    const fetched = await fetchProblem(url)
    await updateProblem(problemId, {
      title: fetched.title,
      statement: fetched.statement,
      constraints: fetched.constraints,
      examples: fetched.examples,
      tags: fetched.tags,
      difficulty: fetched.difficulty,
      ingest_status: 'pending',
    })

    // Step 2: Generate candidates (stream tokens for local provider)
    const onChunk = provider === 'local'
      ? (text: string) => publish(problemId, { phase: 'generate', text })
      : undefined
    const candidates = await generateCandidates(
      fetched.title,
      fetched.statement,
      fetched.constraints,
      fetched.examples,
      provider,
      onChunk
    )

    publish(problemId, { phase: 'verify', text: `Verifying ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}…` })

    // Step 3: Verify
    const verified = await verifyCandidates(
      fetched.title,
      fetched.statement,
      fetched.constraints,
      fetched.examples,
      candidates,
      provider
    )

    // Step 4: Persist and update status
    for (const v of verified) {
      await insertReferenceSolution(problemId, v)
    }

    const anyPassed = verified.some((v) => v.critic_ok)

    // Step 5: Generate test cases for the coding phase using the best verified reference as oracle.
    if (anyPassed) {
      const oracle =
        verified.find((v) => v.critic_ok && v.tests_ok) ??
        verified.find((v) => v.critic_ok)
      if (oracle) {
        publish(problemId, { phase: 'tests', text: 'Generating hidden test cases…' })
        try {
          const result = await generateAndPersistTests({
            problemId,
            title: fetched.title,
            statement: fetched.statement,
            constraints: fetched.constraints,
            examples: fetched.examples,
            referenceCode: oracle.code,
            provider,
          })
          publish(problemId, {
            phase: 'tests',
            text: `Tests ready — ${result.visibleCount} visible, ${result.hiddenCount} hidden${
              result.errors.length ? ` (${result.errors.length} skipped)` : ''
            }`,
          })
        } catch (err) {
          console.error('Test generation failed:', err)
          publish(problemId, {
            phase: 'tests',
            text: `Test generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }

        publish(problemId, { phase: 'tests', text: 'Generating C++ harness…' })
        try {
          const tmpl = await generateAndPersistCppTemplate({
            problemId,
            title: fetched.title,
            statement: fetched.statement,
            constraints: fetched.constraints,
            examples: fetched.examples,
            referenceCode: oracle.code,
            provider,
          })
          publish(problemId, {
            phase: 'tests',
            text: tmpl.ok ? 'C++ harness ready' : `Harness generation failed: ${tmpl.error}`,
          })
        } catch (err) {
          console.error('Harness generation failed:', err)
          publish(problemId, {
            phase: 'tests',
            text: `Harness generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      }
    }

    await updateProblem(problemId, {
      ingest_status: anyPassed ? 'ready' : 'needs_review',
    })
    publish(problemId, { phase: 'done', text: anyPassed ? 'ready' : 'needs_review' })
  } catch (err) {
    console.error('Ingestion failed:', err)
    await updateProblem(problemId, { ingest_status: 'failed' })
    publish(problemId, { phase: 'error', text: err instanceof Error ? err.message : 'Unknown error' })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const problem = await getProblem(id)
  if (!problem) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({ status: problem.ingest_status, title: problem.title, id: problem.id })
}
