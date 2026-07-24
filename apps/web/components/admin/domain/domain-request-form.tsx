'use client'
// ── "No tengo dominio, consíganme uno" — deja domain_requests para que el
// super-admin lo compre manualmente (ver app/actions/domains.ts).

import { useState, useTransition } from 'react'
import { submitDomainRequestAction } from '@/app/actions/domains'
import type { Dictionary } from '@/lib/i18n/server'
import type { DomainRequestStatus } from '@/lib/supabase/database.types'

type T = Dictionary['admin']['domain']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function DomainRequestForm({
  latestRequest,
  t,
}: {
  latestRequest: { requested_name: string; status: DomainRequestStatus } | null
  t: T
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)

  function submit() {
    setError('')
    const value = name.trim()
    if (!value) return
    startTransition(async () => {
      const result = await submitDomainRequestAction(value, notes)
      if (!result.success) {
        setError(result.error ?? t.errorGeneric)
        return
      }
      setSent(value)
      setName('')
      setNotes('')
    })
  }

  if (sent) {
    return (
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-1">
        <p className="font-playfair text-base font-semibold text-sl-on-surface">{t.requestSentTitle}</p>
        <p className="text-sm text-sl-on-surface-muted">{t.requestSentBody.replace('{name}', sent)}</p>
      </div>
    )
  }

  if (latestRequest?.status === 'pending') {
    return (
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-1">
        <p className="font-playfair text-base font-semibold text-sl-on-surface">{t.requestSentTitle}</p>
        <p className="text-sm text-sl-on-surface-muted">{t.requestSentBody.replace('{name}', latestRequest.requested_name)}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
      {latestRequest?.status === 'rejected' && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t.requestRejectedBody.replace('{name}', latestRequest.requested_name)}
        </p>
      )}
      <p className="font-playfair text-base font-semibold text-sl-on-surface">{t.requestSectionTitle}</p>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">{t.requestInputLabel}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.requestInputPlaceholder}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs text-sl-on-surface-muted mb-1">{t.requestNotesLabel}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="text-sm font-medium px-4 py-2 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {t.requestSubmit}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
