'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clearProblemArtifacts, deleteProblem, getProblem } from '@/lib/db/schema'
import type { ModelProvider } from '@/lib/types'

export async function ingestProblemAction(_prevState: unknown, formData: FormData) {
  const url = (formData.get('url') as string | null)?.trim()
  const providerRaw = (formData.get('provider') as string | null) ?? 'cloud'
  const provider: ModelProvider = providerRaw === 'local' ? 'local' : 'cloud'

  if (!url) {
    return { error: 'Please enter a URL' }
  }

  try {
    new URL(url)
  } catch {
    return { error: 'Invalid URL format' }
  }

  let problemId: number

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/problems/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, provider }),
    })

    const data = await res.json() as { problemId?: number; status?: string; error?: string }

    if (!res.ok) return { error: data.error ?? 'Ingestion failed' }

    problemId = data.problemId!
  } catch {
    return { error: 'Could not reach the server. Try again.' }
  }

  redirect(`/?ingesting=${problemId}`)
}

export async function deleteProblemAction(formData: FormData) {
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return
  await deleteProblem(id)
  revalidatePath('/')
}

export async function reingestProblemAction(formData: FormData) {
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return

  const providerRaw = (formData.get('provider') as string | null) ?? 'cloud'
  const provider: ModelProvider = providerRaw === 'local' ? 'local' : 'cloud'

  const problem = await getProblem(id)
  if (!problem) return

  await clearProblemArtifacts(id)

  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/problems/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: problem.url, provider }),
    })
  } catch {
    // pipeline will surface failure status; the poller will pick it up
  }

  redirect(`/?ingesting=${id}`)
}
