'use client'
// ── Chat Dispatch ↔ Conductor — un solo componente para ambos lados ────────────
// `variant='dispatch'` lo usa el tablero de Dispatch (requiere driverId).
// `variant='driver'` lo usa el conductor en su propia vista (siempre su sesión).

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getDispatchDriverMessagesAction,
  sendDispatchMessageAction,
  markDispatchMessagesReadAction,
  getDriverChannelMessagesAction,
  sendDriverChannelMessageAction,
  markDriverChannelMessagesReadAction,
  type DriverChannelMessage,
} from '@/app/actions/driver-messages'

const POLL_FALLBACK_MS = 20_000

interface Labels {
  title: string
  placeholder: string
  send: string
  empty: string
  you: string
  them: string
}

export function DriverChannelChat({
  variant,
  driverId,
  labels,
  brandColor = '#e9c176',
}: {
  variant: 'dispatch' | 'driver'
  /** Requerido cuando variant === 'dispatch' */
  driverId?: string
  labels: Labels
  brandColor?: string
}) {
  const [messages, setMessages] = useState<DriverChannelMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const mySender = variant === 'dispatch' ? 'dispatch' : 'driver'

  const load = useCallback(async () => {
    const res =
      variant === 'dispatch' && driverId
        ? await getDispatchDriverMessagesAction(driverId)
        : await getDriverChannelMessagesAction()
    if (res.success && res.messages) {
      setMessages(res.messages)
      const hasUnread = res.messages.some((m) => m.sender !== mySender && !m.readAt)
      if (hasUnread) {
        if (variant === 'dispatch' && driverId) markDispatchMessagesReadAction(driverId)
        else if (variant === 'driver') markDriverChannelMessagesReadAction()
      }
    }
  }, [variant, driverId, mySender])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`driver-messages-${driverId ?? 'self'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_messages',
          ...(driverId ? { filter: `driver_id=eq.${driverId}` } : {}),
        },
        () => load(),
      )
      .subscribe()
    const id = setInterval(load, POLL_FALLBACK_MS)
    return () => {
      clearInterval(id)
      supabase.removeChannel(channel)
    }
  }, [load, driverId])

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
        variant === 'dispatch' && driverId
          ? await sendDispatchMessageAction(driverId, body)
          : await sendDriverChannelMessageAction(body)
      if (!res.success) {
        setError(res.error ?? 'Error')
        setDraft(body)
        return
      }
      await load()
    })
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white border-[#e5e1d8]">
      <div className="px-4 py-2.5 border-b border-[#f0ede5]">
        <p className="text-sm font-semibold text-[#1d1b18]">{labels.title}</p>
      </div>
      <div ref={scrollRef} className="max-h-60 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.length === 0 ? (
          <p className="text-center text-xs py-6 text-[#75716a]">{labels.empty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === mySender
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] mb-0.5 px-1 text-[#a8a39a]">
                  {mine ? labels.you : m.senderName || labels.them}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? 'text-gray-900 rounded-br-sm' : 'bg-[#f0ede5] text-[#1d1b18] rounded-bl-sm'
                  }`}
                  style={mine ? { backgroundColor: brandColor } : undefined}
                >
                  {m.body}
                </div>
                <span className="text-[9px] mt-0.5 px-1 text-[#b5b0a6]">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        className="flex items-center gap-2 p-2.5 border-t border-[#f0ede5]"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={labels.placeholder}
          maxLength={2000}
          className="flex-1 border rounded-full px-3.5 py-1.5 text-sm border-[#e5e1d8] focus:outline-none focus:border-[#8a6520]"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-gray-900 disabled:opacity-40"
          style={{ backgroundColor: brandColor }}
        >
          {labels.send}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
