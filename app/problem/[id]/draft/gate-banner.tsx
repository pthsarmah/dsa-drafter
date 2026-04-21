'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface Props {
  problemId: number
  gatePassed: boolean
}

export function GateBanner({ problemId, gatePassed }: Props) {
  const router = useRouter()

  useEffect(() => {
    router.refresh()
  }, [router])

  if (gatePassed) {
    return (
      <div className="border border-sage/40 bg-sage/[0.04] px-6 py-5 flex items-center justify-between rise">
        <div>
          <span className="text-[13px] uppercase tracking-[0.3em] text-sage">Sealed</span>
          <p className="font-display italic text-2xl text-cream mt-1 leading-tight">
            The draft is complete.
          </p>
        </div>
        <Link
          href={`/problem/${problemId}/code`}
          className="text-[14px] uppercase tracking-[0.25em] text-amber hover:text-cream transition-colors shrink-0"
        >
          Proceed to Code →
        </Link>
      </div>
    )
  }

  return (
    <div className="border border-rule-soft px-6 py-4 flex items-center gap-4 rise">
      <span className="text-[13px] uppercase tracking-[0.3em] text-faint shrink-0">Locked</span>
      <div className="rule-dashed flex-1" />
      <p className="text-xs text-muted leading-relaxed">
        Complete all required sections to unlock code.
      </p>
    </div>
  )
}
