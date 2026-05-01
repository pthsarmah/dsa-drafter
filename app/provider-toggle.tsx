'use client'

import { useEffect, useState } from 'react'
import type { ModelProvider } from '@/lib/types'

const STORAGE_KEY = 'dsa:provider'

export function getStoredProvider(): ModelProvider {
  if (typeof window === 'undefined') return 'cloud'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'local' ? 'local' : 'cloud'
}

export function useProvider(): [ModelProvider, (p: ModelProvider) => void] {
  const [provider, setProviderState] = useState<ModelProvider>(getStoredProvider)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, provider)
  }, [provider])

  return [provider, setProviderState]
}

interface Props {
  className?: string
}

export function ProviderToggle({ className = '' }: Props) {
  const [provider, setProvider] = useProvider()

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span className="text-[13px] uppercase tracking-[0.25em] text-faint">Model</span>
      <div
        role="radiogroup"
        aria-label="Model provider"
        className="inline-flex items-center text-[14px] uppercase tracking-wider"
      >
        <button
          type="button"
          role="radio"
          aria-checked={provider === 'cloud'}
          onClick={() => setProvider('cloud')}
          className={`px-2 py-1 transition-colors ${
            provider === 'cloud'
              ? 'text-amber border-b border-amber'
              : 'text-muted border-b border-transparent hover:text-cream'
          }`}
        >
          Cloud
        </button>
        <span className="text-faint mx-1">/</span>
        <button
          type="button"
          role="radio"
          aria-checked={provider === 'local'}
          onClick={() => setProvider('local')}
          className={`px-2 py-1 transition-colors ${
            provider === 'local'
              ? 'text-amber border-b border-amber'
              : 'text-muted border-b border-transparent hover:text-cream'
          }`}
        >
          Local
        </button>
      </div>
    </div>
  )
}
