'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  problemId: number
}

const POLL_INTERVAL_MS = 5000
const STREAM_CHAR_LIMIT = 6000

interface StreamEvent {
  phase: 'generate' | 'verify' | 'done' | 'error'
  text: string
}

export function IngestPoller({ problemId }: Props) {
  const [status, setStatus] = useState<string>('pending')
  const [title, setTitle] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [streamText, setStreamText] = useState('')
  const [verifyText, setVerifyText] = useState('')
  const startedAt = useRef<number>(Date.now())
  const streamBoxRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    let stopped = false
    startedAt.current = Date.now()

    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`/api/problems/ingest?id=${problemId}`)
          const data = await res.json() as { status: string; title: string }
          if (stopped) return
          setStatus(data.status)
          setTitle(data.title)

          if (data.status === 'ready' || data.status === 'needs_review') {
            router.push(`/problem/${problemId}/draft`)
            return
          }
          if (data.status === 'failed') return
        } catch {
          // ignore transient errors, keep polling
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
    }

    const es = new EventSource(`/api/problems/ingest/stream?id=${problemId}`)
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as StreamEvent
        if (data.phase === 'generate') {
          setStreamText((s) => {
            const next = s + data.text
            return next.length > STREAM_CHAR_LIMIT ? next.slice(-STREAM_CHAR_LIMIT) : next
          })
        } else if (data.phase === 'verify') {
          setVerifyText(data.text)
        } else if (data.phase === 'done' || data.phase === 'error') {
          es.close()
        }
      } catch {
        // ignore malformed event
      }
    }
    es.onerror = () => { es.close() }

    poll()
    return () => {
      stopped = true
      clearInterval(tick)
      es.close()
    }
  }, [problemId, router])

  useEffect(() => {
    const el = streamBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [streamText])

  const messages: Record<string, string> = {
    pending: verifyText || 'Reading the problem. Drafting reference approaches.',
    failed: 'Ingestion failed. Try again or check the logs.',
  }

  return (
    <div className="rise border border-rule bg-paper px-6 py-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] uppercase tracking-[0.3em] text-faint">
          {status === 'failed' ? 'Error' : 'In progress'}
        </span>
        {status === 'pending' && (
          <span className="text-[14px] text-muted tabular-nums font-mono">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <p className="font-display text-2xl text-cream italic leading-snug">
        {title || 'Incoming problem…'}
      </p>
      <p className="text-xs text-muted mt-2">
        {messages[status] ?? `Status: ${status}`}
      </p>

      {streamText && status === 'pending' && (
        <div
          ref={streamBoxRef}
          className="mt-4 max-h-48 overflow-y-auto border border-rule-soft bg-ink/60 px-4 py-3 text-[11px] leading-relaxed font-mono text-muted whitespace-pre-wrap"
        >
          {streamText}
        </div>
      )}

      {status !== 'failed' && (
        <div className="mt-4 h-[1px] bg-rule-soft overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/3 bg-amber/60 animate-[drift_1.8s_ease-in-out_infinite_alternate]" />
        </div>
      )}
    </div>
  )
}
