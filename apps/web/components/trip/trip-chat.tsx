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
  open: openProp,
}: {
  bookingId: string
  side: 'client' | 'driver'
  labels: ChatLabels
  brandColor?: string
  open?: boolean
}) {
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

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
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

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10">
        <p className="text-sm font-semibold text-white">{labels.title}</p>
        <p className="text-[11px] text-white/40">{labels.subtitle}</p>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-white/30 py-6">{labels.empty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === side
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-white/30 mb-1 px-1">
                  {mine ? labels.you : labels.them}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? 'text-gray-900 rounded-br-sm' : 'bg-white/10 text-white/90 rounded-bl-sm'
                  }`}
                  style={mine ? { backgroundColor: brandColor } : undefined}
                >
                  {m.body}
                </div>
                <span className="text-[9px] text-white/25 mt-1 px-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-white/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={labels.placeholder}
          maxLength={2000}
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
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

      {error && <p className="px-4 pb-3 text-xs text-red-400">{error}</p>}
    </div>
  )
}
