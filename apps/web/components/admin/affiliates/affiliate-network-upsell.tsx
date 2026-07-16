'use client'
// ── Sección G — Tarjeta de autoservicio para activar el add-on (Starter/Professional) ─

import { useState, useTransition } from 'react'
import { submitAffiliateNetworkLeadAction } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']

export function AffiliateNetworkUpsell({ companyName, companyEmail, t, checkoutUrl }: { companyName: string; companyEmail?: string | null; t: T; checkoutUrl?: string }) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  function submit() {
    if (!contactName.trim() || !email.trim()) { setError(t.leadForm.required); return }
    setError('')
    startTransition(async () => {
      const result = await submitAffiliateNetworkLeadAction({
        companyName,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      })
      if (!result.success) setError(result.error ?? 'Error')
      else setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 text-center">
        <p className="text-sm text-green-600">{t.requestAccessSent}</p>
      </div>
    )
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-3">
      <p className="font-playfair text-lg font-semibold text-sl-on-surface">{t.notEnabledTitle}</p>
      <p className="text-sm text-sl-on-surface-muted">{t.notEnabledBody}</p>

      {!showForm ? (
        checkoutUrl ? (
          <div className="space-y-2">
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-4 py-2 bg-bronze text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              {t.subscribeButton}
            </a>
            <p className="text-xs text-sl-on-surface-muted">{t.subscribeNote}</p>
            {companyEmail ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t.subscribeEmailHint.replace('{email}', companyEmail)}
              </p>
            ) : (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {t.subscribeEmailMissing}
              </p>
            )}
            <button onClick={() => setShowForm(true)} className="block text-xs text-sl-on-surface-muted hover:underline pt-1">
              {t.orRequestAccess}
            </button>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-gold text-gray-900 text-sm font-medium rounded-xl hover:bg-gold/90">
            {t.requestAccessButton}
          </button>
        )
      ) : (
        <div className="space-y-3 pt-2 max-w-md">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t.leadForm.contactName} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t.leadForm.email} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.leadForm.phone} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder={t.leadForm.message} className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm resize-none" />
          <button onClick={submit} disabled={isPending} className="px-4 py-2 bg-gold text-gray-900 text-sm font-medium rounded-xl hover:bg-gold/90 disabled:opacity-50">
            {isPending ? '...' : t.leadForm.submit}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
