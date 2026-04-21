'use server'

import { redirect } from 'next/navigation'
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
  let status: string

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/problems/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, provider }),
    })

    const data = await res.json() as { problemId?: number; status?: string; error?: string }

    if (!res.ok) return { error: data.error ?? 'Ingestion failed' }

    problemId = data.problemId!
    status = data.status!
  } catch {
    return { error: 'Could not reach the server. Try again.' }
  }

  redirect(`/?ingesting=${problemId}`)
}
