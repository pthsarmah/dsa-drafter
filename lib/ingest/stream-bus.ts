// In-memory per-problem pub/sub for ingestion progress. A late subscriber gets
// the full buffered history, then live chunks until the stream is closed.
//
// Entries:
//   { phase: 'generate', chunk }      — raw model token/text during generation
//   { phase: 'verify', text }         — status line during verification
//   { phase: 'done' | 'error', text } — terminal

export type IngestEvent =
  | { phase: 'generate'; text: string }
  | { phase: 'verify'; text: string }
  | { phase: 'done'; text: string }
  | { phase: 'error'; text: string }

interface Channel {
  buffer: IngestEvent[]
  subscribers: Set<(e: IngestEvent) => void>
  closed: boolean
}

const channels = new Map<number, Channel>()

function ensure(problemId: number): Channel {
  let c = channels.get(problemId)
  if (!c) {
    c = { buffer: [], subscribers: new Set(), closed: false }
    channels.set(problemId, c)
  }
  return c
}

export function publish(problemId: number, event: IngestEvent): void {
  const c = ensure(problemId)
  if (c.closed) return
  c.buffer.push(event)
  for (const s of c.subscribers) s(event)
  if (event.phase === 'done' || event.phase === 'error') {
    c.closed = true
    // Keep the buffer around briefly so late subscribers can replay; drop after 60s.
    setTimeout(() => channels.delete(problemId), 60_000)
  }
}

export function subscribe(
  problemId: number,
  handler: (e: IngestEvent) => void
): () => void {
  const c = ensure(problemId)
  for (const past of c.buffer) handler(past)
  if (c.closed) return () => {}
  c.subscribers.add(handler)
  return () => {
    c.subscribers.delete(handler)
  }
}
