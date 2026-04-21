import type { ModelProvider } from '@/lib/types'

// ---------- Config ----------

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CLOUD_TIMEOUT_MS = Number(process.env.CLOUD_TIMEOUT_MS ?? 120000)

const LLAMA_BASE = (process.env.LLAMA_SERVER_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
const LLAMA_URL = `${LLAMA_BASE}/v1/chat/completions`
const LLAMA_MODEL = process.env.LLAMA_MODEL ?? 'gemma-4'
const LLAMA_API_KEY = process.env.LLAMA_API_KEY
const LOCAL_TIMEOUT_MS = Number(process.env.LOCAL_TIMEOUT_MS ?? 600000)

// "low" | "medium" | "high" | "minimal" — passed through to llama-server.
// "off" / "false" → omit the field and let the model decide.
const LLAMA_REASONING_EFFORT = (process.env.LLAMA_REASONING_EFFORT ?? 'low').toLowerCase()

const DEFAULT_PROVIDER: ModelProvider =
	(process.env.DEFAULT_MODEL_PROVIDER as ModelProvider) === 'local' ? 'local' : 'cloud'

// ---------- Types ----------

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface ChatOptions {
	format?: 'json' | object
	temperature?: number
	provider?: ModelProvider
}

export function resolveProvider(p?: ModelProvider | null): ModelProvider {
	if (p === 'local' || p === 'cloud') return p
	return DEFAULT_PROVIDER
}

interface ProviderConfig {
	url: string
	model: string
	apiKey?: string
	timeoutMs: number
	reasoningEffort?: string
}

function providerConfig(p: ModelProvider): ProviderConfig {
	if (p === 'local') {
		const effort = LLAMA_REASONING_EFFORT
		return {
			url: LLAMA_URL,
			model: LLAMA_MODEL,
			apiKey: LLAMA_API_KEY,
			timeoutMs: LOCAL_TIMEOUT_MS,
			reasoningEffort: effort === 'off' || effort === 'false' ? undefined : effort,
		}
	}
	if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
	return {
		url: GROQ_URL,
		model: GROQ_MODEL,
		apiKey: GROQ_API_KEY,
		timeoutMs: CLOUD_TIMEOUT_MS,
	}
}

function buildBody(cfg: ProviderConfig, messages: ChatMessage[], opts: ChatOptions, stream: boolean): string {
	return JSON.stringify({
		model: cfg.model,
		messages,
		stream,
		...(opts.format ? { response_format: { type: 'json_object' } } : {}),
		...(cfg.reasoningEffort ? { reasoning_effort: cfg.reasoningEffort } : {}),
		temperature: opts.temperature ?? 0.3,
	})
}

function headers(cfg: ProviderConfig): Record<string, string> {
	const h: Record<string, string> = { 'Content-Type': 'application/json' }
	if (cfg.apiKey) h['Authorization'] = `Bearer ${cfg.apiKey}`
	return h
}

// ---------- Public API ----------

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
	const provider = resolveProvider(opts.provider)
	const cfg = providerConfig(provider)

	const res = await fetch(cfg.url, {
		method: 'POST',
		headers: headers(cfg),
		signal: AbortSignal.timeout(cfg.timeoutMs),
		body: buildBody(cfg, messages, opts, false),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`${provider} error ${res.status}: ${text}`)
	}

	const data = await res.json() as { choices?: [{ message?: { content?: string } }] }
	return data.choices?.[0]?.message?.content ?? ''
}

export type ChatStreamChunk = { content?: string; reasoning?: string }

export async function* chatStream(
	messages: ChatMessage[],
	opts: ChatOptions = {}
): AsyncGenerator<ChatStreamChunk> {
	const provider = resolveProvider(opts.provider)
	const cfg = providerConfig(provider)

	const res = await fetch(cfg.url, {
		method: 'POST',
		headers: headers(cfg),
		signal: AbortSignal.timeout(cfg.timeoutMs),
		body: buildBody(cfg, messages, opts, true),
	})

	if (!res.ok || !res.body) {
		const text = await res.text()
		throw new Error(`${provider} error ${res.status}: ${text}`)
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() ?? ''

		for (const line of lines) {
			const trimmed = line.trim()
			if (!trimmed || !trimmed.startsWith('data:')) continue
			const payload = trimmed.slice(5).trim()
			if (payload === '[DONE]') return
			try {
				const parsed = JSON.parse(payload) as {
					choices?: [{ delta?: { content?: string; reasoning_content?: string; reasoning?: string } }]
				}
				const delta = parsed.choices?.[0]?.delta
				if (!delta) continue
				const reasoning = delta.reasoning_content ?? delta.reasoning
				if (reasoning) yield { reasoning }
				if (delta.content) yield { content: delta.content }
			} catch {
				// incomplete JSON — skip
			}
		}
	}
}
