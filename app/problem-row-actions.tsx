'use client'

import { useState, useTransition } from 'react'
import { deleteProblemAction, reingestProblemAction } from './actions'
import { useProvider } from './provider-toggle'

interface Props {
  id: number
  title: string
}

export function ProblemRowActions({ id, title }: Props) {
  const [provider] = useProvider()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function onReingest() {
    const fd = new FormData()
    fd.set('id', String(id))
    fd.set('provider', provider)
    startTransition(() => {
      reingestProblemAction(fd)
    })
  }

  function onDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    const fd = new FormData()
    fd.set('id', String(id))
    startTransition(() => {
      deleteProblemAction(fd)
    })
  }

  return (
    <div className="flex items-center gap-3 shrink-0" onMouseLeave={() => setConfirming(false)}>
      <button
        type="button"
        onClick={onReingest}
        disabled={pending}
        title={`Reingest ${title}`}
        className="text-[12px] uppercase tracking-[0.25em] text-muted hover:text-amber disabled:text-faint disabled:cursor-not-allowed transition-colors"
      >
        {pending ? '…' : 'Reingest'}
      </button>
      <span className="text-faint text-[12px]">·</span>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title={confirming ? 'Click again to confirm' : `Delete ${title}`}
        className={`text-[12px] uppercase tracking-[0.25em] disabled:text-faint disabled:cursor-not-allowed transition-colors ${
          confirming ? 'text-dust' : 'text-muted hover:text-dust'
        }`}
      >
        {confirming ? 'Confirm?' : 'Delete'}
      </button>
    </div>
  )
}
