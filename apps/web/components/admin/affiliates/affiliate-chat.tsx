'use client'
// ── Sección G — Chat entre empresas (canal comercial o canal por viaje) ───────

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAffiliateMessagesAction, sendAffiliateMessageAction, type AffiliateMessage } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

const POLL_FALLBACK_MS = 20_000

type T = Dictionary['affiliates']['chat']

export function AffiliateChat({
  companyAffiliateId,
  affiliateTripId,
  myCompanyId,
  t,
}: {
  companyAffiliateId: string
  affiliateTripId?: string
  myCompanyId: string
  t: T
}) {
  const [messages, setMessages] = useState<AffiliateMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await getAffiliateMessagesAction(companyAffiliateId, affiliateTripId)
    if (res.success && res.messages) setMessages(res.messages)
  }, [companyAffiliateId, affiliateTripId])

  useEffect(() => {
    load()
    const supabase = createClient()
    const channel = supabase
      .channel(`affiliate-messages-${companyAffiliateId}-${affiliateTripId ?? 'general'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'affiliate_messages', filter: `company_affiliate_id=eq.${companyAffiliateId}` }, () => load())
      .subscribe()
    const id = setInterval(load, POLL_FALLBACK_MS)
    return () => { clearInterval(id); supabase.removeChannel(channel) }
  }, [load, companyAffiliateId, affiliateTripId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  function send() {
    const body = draft.trim()
    if (!body) return
    setError('')
    setDraft('')
    startTransition(async () => {
      const result = await sendAffiliateMessageAction(companyAffiliateId, body, affiliateTripId)
      if (!result.success) { setError(result.error ?? 'Error'); setDraft(body); return }
      await load()
    })
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-white border-sl-outline-variant">
      <div className="px-3 py-2 border-b border-sl-outline-variant">
        <p className="text-xs font-semibold text-sl-on-surface">{t.title}</p>
      </div>
      <div ref={scrollRef} className="overflow-y-auto px-3 py-2.5 space-y-2" style={{ maxHeight: '12rem' }}>
        {messages.length === 0 ? (
          <p className="text-center text-xs py-4 text-sl-on-surface-muted">{t.empty}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderCompanyId === myCompanyId
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] mb-0.5 px-1 text-sl-on-surface-muted">{mine ? '' : m.senderName ?? ''}</span>
                <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${mine ? 'bg-bronze text-white rounded-br-sm' : 'bg-sl-bg text-sl-on-surface rounded-bl-sm'}`}>
                  {m.body}
                </div>
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 p-2 border-t border-sl-outline-variant">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          maxLength={2000}
          className="flex-1 border rounded-full px-3 py-1.5 text-xs border-sl-outline-variant focus:outline-none focus:border-bronze"
        />
        <button type="submit" disabled={isPending || !draft.trim()} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold bg-bronze text-white disabled:opacity-40">
          {t.send}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
