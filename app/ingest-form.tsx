'use client'

import { useActionState } from 'react'
import { ingestProblemAction } from './actions'
import { ProviderToggle, useProvider } from './provider-toggle'

const initialState = { error: '' }

export function IngestForm() {
  const [state, formAction, pending] = useActionState(ingestProblemAction, initialState)
  const [provider] = useProvider()

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="block text-[13px] uppercase tracking-[0.3em] text-faint mb-3">
          Add a problem
        </span>
        <div className="flex items-baseline gap-4 border-b border-rule py-2 focus-within:border-amber transition-colors">
          <span className="font-display italic text-amber/70 text-xl leading-none shrink-0">❯</span>
          <input
            type="url"
            name="url"
            required
            placeholder="https://leetcode.com/problems/…"
            className="flex-1 bg-transparent text-sm text-cream placeholder-faint focus:outline-none"
          />
          <input type="hidden" name="provider" value={provider} />
          <button
            type="submit"
            disabled={pending}
            className="text-[14px] uppercase tracking-[0.25em] text-amber hover:text-cream disabled:text-faint disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {pending ? 'Starting…' : 'Ingest →'}
          </button>
        </div>
      </label>
      <div className="flex items-center justify-between">
        <ProviderToggle />
        {state?.error && (
          <p className="text-xs text-dust font-mono">{state.error}</p>
        )}
      </div>
    </form>
  )
}
