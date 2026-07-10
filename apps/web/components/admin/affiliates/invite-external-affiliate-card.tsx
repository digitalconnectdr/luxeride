'use client'
// ── Sección G, Fase 2 — Generar link de invitación para un afiliado externo ───

import { useState, useTransition } from 'react'
import { createAffiliateInviteAction } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']['externalInvite']

export function InviteExternalAffiliateCard({ t }: { t: T }) {
  const [isPending, startTransition] = useTransition()
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  function generate() {
    setError('')
    setCopied(false)
    startTransition(async () => {
      const result = await createAffiliateInviteAction()
      if (!result.success || !result.token) {
        setError(result.error ?? 'Error')
        return
      }
      setLink(`${window.location.origin}/affiliate/join/${result.token}`)
    })
  }

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.title}</p>
      <p className="text-xs text-sl-on-surface-muted">{t.hint}</p>

      {link ? (
        <div className="space-y-2">
          <label className="block text-xs text-sl-on-surface-muted">{t.linkLabel}</label>
          <div className="flex gap-2">
            <input readOnly value={link} className="flex-1 rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-xs text-sl-on-surface-muted" />
            <button onClick={copy} className="px-4 py-2 text-sm border border-sl-outline-variant rounded-xl hover:bg-sl-bg whitespace-nowrap">
              {copied ? t.copied : t.copyButton}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={generate} disabled={isPending} className="px-4 py-2 bg-[#0071e3] text-white text-sm font-medium rounded-xl hover:bg-[#0077ed] disabled:opacity-50">
          {isPending ? '...' : t.generateButton}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
