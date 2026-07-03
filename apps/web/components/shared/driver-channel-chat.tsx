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
  clearDriverMessagesAction,
  getDriverChannelMessagesAction,
  sendDriverChannelMessageAction,
  markDriverChannelMessagesReadAction,
  clearDriverChannelMessagesAction,
  type DriverChannelMessage,
} from '@/app/actions/driver-messages'

const POLL_FALLBACK_MS = 20_000
// Tope duro de mensajes visibles — evita que el panel crezca sin control
// aunque el usuario nunca vacíe la conversación (se muestran los más recientes).
const MAX_VISIBLE_MESSAGES = 100

interface Labels {
  title: string
  placeholder: string
  send: string
  empty: string
  you: string
  them: string
  clear?: string
  clearConfirm?: string
}

export function DriverChannelChat({
  variant,
  driverId,
  labels,
  brandColor = '#e9c176',
  collapsible = false,
}: {
  variant: 'dispatch' | 'driver'
  /** Requerido cuando variant === 'dispatch' */
  driverId?: string
  labels: Labels
  brandColor?: string
  /** Si es true: sin mensajes, muestra solo un botón en vez del panel completo
   *  (el conductor lo abre cuando lo necesita, sin ocupar espacio siempre). */
  collapsible?: boolean
}) {
  const [messages, setMessages] = useState<DriverChannelMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const mySender = variant === 'dispatch' ? 'dispatch' : 'driver'
  const showPanel = !collapsible || expanded
  const unreadCount = messages.filter((m) => m.sender !== mySender && !m.readAt).length

  const load = useCallback(async () => {
    const res =
      variant === 'dispatch' && driverId
        ? await getDispatchDriverMessagesAction(driverId)
        : await getDriverChannelMessagesAction()
    if (res.success && res.messages) {
      setMessages(res.messages)
    }
  }, [variant, driverId])

  // Marcar como leído SOLO cuando el panel está realmente visible — así el
  // conductor ve el aviso ámbar mientras conduce y decide cuándo mirarlo, en
  // vez de que se marque leído solo por haberse cargado en segundo plano.
  useEffect(() => {
    if (!showPanel || unreadCount === 0) return
    if (variant === 'dispatch' && driverId) markDispatchMessagesReadAction(driverId)
    else if (variant === 'driver') markDriverChannelMessagesReadAction()
    setMessages((prev) => prev.map((m) => (m.sender !== mySender && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanel, unreadCount])

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

  function clearChat() {
    if (labels.clearConfirm && !window.confirm(labels.clearConfirm)) return
    startTransition(async () => {
      const res =
        variant === 'dispatch' && driverId
          ? await clearDriverMessagesAction(driverId)
          : await clearDriverChannelMessagesAction()
      if (res.success) setMessages([])
      else setError(res.error ?? 'Error')
    })
  }

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

  if (!showPanel) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition-colors ${
          unreadCount > 0
            ? 'border-amber-300 bg-amber-50 text-[#1d1b18] hover:bg-amber-100'
            : 'border-[#e5e1d8] bg-white text-[#1d1b18] hover:bg-[#faf8f3]'
        }`}
      >
        💬 {labels.title}
        {unreadCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 leading-none">
              {unreadCount}
            </span>
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white border-[#e5e1d8]">
      <div className="px-4 py-2.5 border-b border-[#f0ede5] flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1d1b18]">{labels.title}</p>
        <div className="flex items-center gap-3 shrink-0">
          {messages.length > 0 && labels.clear && (
            <button
              type="button"
              onClick={clearChat}
              className="text-[11px] text-[#a8a39a] hover:text-red-500 transition-colors"
              title={labels.clear}
            >
              🗑
            </button>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm text-[#a8a39a] hover:text-[#1d1b18] transition-colors"
              aria-label="Ocultar"
            >
              💬
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="overflow-y-auto px-3 py-3 space-y-2.5" style={{ maxHeight: '15rem' }}>
        {messages.length === 0 ? (
          <p className="text-center text-xs py-6 text-[#75716a]">{labels.empty}</p>
        ) : (
          messages.slice(-MAX_VISIBLE_MESSAGES).map((m) => {
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
