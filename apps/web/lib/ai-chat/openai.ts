// ── Llamada minima a la API de OpenAI (sin SDK nueva) ──────────────────────────
// GPT-4o-mini elegido a proposito sobre modelos mas caros (Claude Haiku,
// GPT-5 mini): para FAQ de una empresa con contexto fijo, la calidad es mas
// que suficiente y el costo es 5-6x menor, lo cual es la base del margen del
// add-on (ver lib/billing/ai-chat-addon.ts). Fetch directo a la API REST en
// vez de instalar el SDK de OpenAI - una sola llamada, no vale la pena la
// dependencia nueva.

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'
const MAX_OUTPUT_TOKENS = 350
const TIMEOUT_MS = 15_000

export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

export async function getChatCompletion(systemPrompt: string, history: ChatTurn[]): Promise<{ success: true; reply: string } | { success: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { success: false, error: 'OpenAI no configurado' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[ai-chat/openai] request failed', res.status, errBody)
      return { success: false, error: 'No se pudo contactar al asistente' }
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) return { success: false, error: 'Respuesta vacía del asistente' }
    return { success: true, reply }
  } catch (err) {
    console.error('[ai-chat/openai] error', err)
    return { success: false, error: 'No se pudo contactar al asistente' }
  } finally {
    clearTimeout(timeout)
  }
}
