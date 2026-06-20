'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']

export function BookingWidgetCard({ t, embedUrl }: { t: SettingsDict; embedUrl: string }) {
  const [copied, setCopied] = useState(false)

  // Snippet que el operador pega en su sitio. height fijo razonable + responsivo.
  const snippet = `<iframe src="${embedUrl}" title="Reserva" width="100%" height="720" style="border:0;max-width:480px;margin:0 auto;display:block" loading="lazy"></iframe>`

  function copy() {
    navigator.clipboard
      ?.writeText(snippet)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{t.widgetTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-4">{t.widgetDesc}</p>

      <pre className="font-mono text-xs text-bronze bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-3 overflow-x-auto whitespace-pre-wrap break-all">
        {snippet}
      </pre>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
        >
          {copied ? t.copiedCode : t.copyCode}
        </button>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-bronze hover:text-bronze/80 transition-colors"
        >
          {t.widgetPreview}
        </a>
      </div>
    </section>
  )
}
