import { subscribe } from '@/lib/ingest/stream-bus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      const unsubscribe = subscribe(id, (event) => {
        try {
          send(JSON.stringify(event))
          if (event.phase === 'done' || event.phase === 'error') {
            controller.close()
          }
        } catch {
          // Controller already closed — ignore.
        }
      })

      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
