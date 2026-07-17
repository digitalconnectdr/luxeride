'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']

export function BookingLinkCard({ t, url }: { t: SettingsDict; url: string }) {
  const [copied, setCopied] = useState(false)
  // Mostrar sin el protocolo, más limpio
  const display = url.replace(/^https?:\/\//, '')

  function copy() {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.bookingLinkTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-4">{t.bookingLinkDesc}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[220px] font-mono text-sm text-bronze bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 truncate hover:border-bronze transition-colors"
        >
          {display}
        </a>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
        >
          {copied ? t.copiedLink : t.copyLink}
        </button>
      </div>
    </section>
  )
}
