'use client'
// ── Sección G — Invitar a una empresa afiliada por su slug de LuxeRide ────────

import { useState, useTransition } from 'react'
import { findAffiliateBySlugAction, requestAffiliationAction } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']['relationships']

export function InviteAffiliateForm({ t }: { t: T }) {
  const [isPending, startTransition] = useTransition()
  const [slug, setSlug] = useState('')
  const [notes, setNotes] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; city: string | null } | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function find() {
    if (!slug.trim()) return
    setError('')
    setFound(null)
    startTransition(async () => {
      const result = await findAffiliateBySlugAction(slug.trim())
      if (!result) setError(t.notFound)
      else setFound(result)
    })
  }

  function invite() {
    if (!found) return
    setError('')
    startTransition(async () => {
      const result = await requestAffiliationAction(found.id, notes.trim() || undefined)
      if (!result.success) setError(result.error ?? 'Error')
      else {
        setSent(true)
        setSlug('')
        setNotes('')
        setFound(null)
      }
    })
  }

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.inviteTitle}</p>
      <p className="text-xs text-sl-on-surface-muted">{t.inviteHint}</p>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.inviteSlugLabel}</label>
          <input
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setFound(null) }}
            onKeyDown={(e) => e.key === 'Enter' && find()}
            placeholder={t.inviteSlugPlaceholder}
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm"
          />
        </div>
        <button onClick={find} disabled={isPending || !slug.trim()} className="self-end px-4 py-2 text-sm border border-sl-outline-variant rounded-xl hover:bg-sl-bg disabled:opacity-50 whitespace-nowrap">
          {t.inviteFind}
        </button>
      </div>

      {found && (
        <div className="rounded-xl border border-bronze/25 bg-bronze/5 p-3.5 space-y-3">
          <p className="text-sm font-medium text-sl-on-surface">{found.name}{found.city ? ` · ${found.city}` : ''}</p>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.inviteNotesLabel}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t.inviteNotesPlaceholder}
              className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm resize-none"
            />
          </div>
          <button onClick={invite} disabled={isPending} className="px-4 py-2 bg-gold text-gray-900 text-sm font-medium rounded-xl hover:bg-gold/90 disabled:opacity-50">
            {isPending ? '...' : t.inviteButton}
          </button>
        </div>
      )}

      {sent && <p className="text-sm text-green-600">{t.sent}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
