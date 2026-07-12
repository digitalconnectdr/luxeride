'use client'
// ── Widget de chat flotante del asistente de IA (micrositio público) ──────────
// Un solo componente compartido por las 4 plantillas — se inserta UNA vez en
// book/[slug]/page.tsx en vez de duplicarlo en cada plantilla (mismo dato,
// mismo comportamiento, solo cambia el color de marca). Solo se renderiza
// cuando el add-on está activo para esa empresa (chequeado server-side antes
// de pasar la prop `enabled`).

import { useEffect, useRef, useState } from 'react'
import { sendChatWidgetMessageAction } from '@/app/actions/ai-chat'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type MicrositeDict = Dictionary['microsite']

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SESSION_KEY_PREFIX = 'luxeride_ai_chat_session_'

function fillCompany(text: string, company: string): string {
  return text.replace('{company}', company)
}

export function AiChatWidget({
  companySlug,
  companyName,
  brandColor,
  t,
}: {
  companySlug: string
  companyName: string
  brandColor: string
  t: MicrositeDict
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionTokenRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sessionTokenRef.current = window.localStorage.getItem(SESSION_KEY_PREFIX + companySlug)
  }, [companySlug])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)

    const result = await sendChatWidgetMessageAction(companySlug, sessionTokenRef.current, text)

    setSending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    sessionTokenRef.current = result.sessionToken
    window.localStorage.setItem(SESSION_KEY_PREFIX + companySlug, result.sessionToken)
    setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }])
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[min(92vw,360px)] h-[min(70vh,520px)] bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ backgroundColor: brandColor }}>
            <p className="text-sm font-semibold text-white truncate">{t.chatTitle}</p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="text-white/90 hover:text-white text-lg leading-none px-1"
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-neutral-50">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-black/5 px-3 py-2 text-[13px] text-neutral-700 shadow-sm">
              {fillCompany(t.chatWelcome, companyName)}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 text-[13px] leading-snug shadow-sm ${
                  m.role === 'user'
                    ? 'ml-auto rounded-2xl rounded-br-sm text-white'
                    : 'rounded-2xl rounded-bl-sm bg-white border border-black/5 text-neutral-700'
                }`}
                style={m.role === 'user' ? { backgroundColor: brandColor } : undefined}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="max-w-[70%] rounded-2xl rounded-bl-sm bg-white border border-black/5 px-3 py-2 text-[13px] text-neutral-400 shadow-sm">
                …
              </div>
            )}
            {error && <p className="text-xs text-red-600 px-1">{error}</p>}
          </div>

          <div className="border-t border-black/5 p-2.5 shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend()
                }}
                placeholder={t.chatPlaceholder}
                disabled={sending}
                className="flex-1 min-w-0 rounded-full border border-black/10 px-3.5 py-2 text-[13px] outline-none focus:border-black/30"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: brandColor }}
              >
                {t.chatSend}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1.5 px-1 truncate">{fillCompany(t.chatDisclaimer, companyName)}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.chatButtonLabel}
        className="h-14 px-5 rounded-full shadow-lg flex items-center gap-2 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        style={{ backgroundColor: brandColor }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {!open && <span className="hidden sm:inline">{t.chatButtonLabel}</span>}
      </button>
    </div>
  )
}
