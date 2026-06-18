'use client'
// ── Chat ligero cliente ↔ conductor ───────────────────────────────────────────
// Mismo componente para ambos lados; `side` define a qué server actions llama y
// cómo se etiquetan los mensajes. Hace polling cada 8s mientras está montado.

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import {
  getTripMessagesAction,
  sendClientMessageAction,
  getDriverTripMessagesAction,
  sendDriverMessageAction,
  type TripMessage,
} from '@/app/actions/trip'

interface ChatLabels {
  title: string
  subtitle: string
  placeholder: string
  send: string
  empty: string
  you: string
  them: string
}

export function TripChat({
  bookingId,
  side,
  labels,
  brandColor = '#e9c176',
  quickReplies,
  theme = 'dark',
}: {
  bookingId: string
  side: 'client' | 'driver'
  labels: ChatLabels
  brandColor?: string
  quickReplies?: string[]
  theme?: 'dark' | 'light'
}) {
  const isLight = theme === 'light'
  const s = isLight
    ? {
        container: 'bg-white border-[#e5e1d8]',
        divider: 'border-[#f0ede5]',
        title: 'text-[#1d1b18]',
        subtitle: 'text-[#75716a]',
        empty: 'text-[#75716a]',
        label: 'text-[#a8a39a]',
        theirBubble: 'bg-[#f0ede5] text-[#1d1b18]',
        time: 'text-[#b5b0a6]',
        quick: 'border-[#e5e1d8] text-[#75716a] hover:bg-[#faf8f3] hover:text-[#1d1b18]',
        input: 'bg-white border-[#e5e1d8] text-[#1d1b18] placeholder:text-[#a8a39a] focus:border-[#8a6520]',
      }
    : {
        container: 'bg-white/[0.03] border-white/10',
        divider: 'border-white/10',
        title: 'text-white',
        subtitle: 'text-white/40',
        empty: 'text-white/30',
        label: 'text-white/30',
        theirBubble: 'bg-white/10 text-white/90',
        time: 'text-white/25',
        quick: 'border-white/15 text-white/70 hover:bg-white/10 hover:text-white',
        input: 'bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30',
      }
  const [messages, setMessages] = useState<TripMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res =
      side === 'driver'
        ? await getDriverTripMessagesAction(bookingId)
        : await getTripMessagesAction(bookingId)
    if (res.success && res.messages) {
      setMessages((prev) =>
        prev.length !== res.messages!.length ? res.messages! : prev,
      )
    }
  }, [bookingId, side])

  // Carga inicial + polling
  useEffect(() => {
    load()
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [load])

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  function send(raw: string) {
    const body = raw.trim()
    if (!body) return
    setError('')
    setDraft('')
    startTransition(async () => {
      const res =
        side === 'driver'
          ? await sendDriverMessageAction(bookingId, body)
          : await sendClientMessageAction(bookingId, body)
      if (!res.success) {
        setError(res.error ?? 'Error')
        setDraft(body)
        return
      }
      await load()
    })
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    send(draft)
  }

  return (
    <div className={`border rounded-2xl overflow-hidden ${s.container}`}>
      <div className={`px-5 py-3 border-b ${s.divider}`}>
        <p className={`text-sm font-semibold ${s.title}`}>{labels.title}</p>
        <p className={`text-[11px] ${s.subtitle}`}>{labels.subtitle}</p>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className={`text-center text-xs py-6 ${s.empty}`}>{labels.empty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === side
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className={`text-[10px] mb-1 px-1 ${s.label}`}>
                  {mine ? labels.you : labels.them}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? 'text-gray-900 rounded-br-sm' : `${s.theirBubble} rounded-bl-sm`
                  }`}
                  style={mine ? { backgroundColor: brandColor } : undefined}
                >
                  {m.body}
                </div>
                <span className={`text-[9px] mt-1 px-1 ${s.time}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className={`border-t ${s.divider}`}>
        {/* Respuestas rápidas */}
        {quickReplies && quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-3">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={isPending}
                className={`text-[11px] rounded-full border px-2.5 py-1 disabled:opacity-40 transition-colors ${s.quick}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2 p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={labels.placeholder}
            maxLength={2000}
            className={`flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none ${s.input}`}
          />
          <button
            type="submit"
            disabled={isPending || !draft.trim()}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: brandColor }}
          >
            {labels.send}
          </button>
        </form>
      </div>

      {error && <p className={`px-4 pb-3 text-xs ${isLight ? 'text-red-600' : 'text-red-400'}`}>{error}</p>}
    </div>
  )
}
