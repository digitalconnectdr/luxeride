'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type SettingsDict = Dictionary['admin']['settings']

export function BookingWidgetCard({ t, embedUrl }: { t: SettingsDict; embedUrl: string }) {
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)

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

      {/* Acciones principales: copiar (sin ver código) + vista previa */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? t.copiedCode : t.copyCode}
        </button>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
        >
          {t.widgetPreview}
        </a>
      </div>

      <p className="text-[11px] text-sl-on-surface-muted mt-3">{t.widgetHint}</p>

      {/* Código colapsado: oculto por defecto para no abrumar a quien no sabe de código */}
      <button
        type="button"
        onClick={() => setShowCode((s) => !s)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-bronze hover:text-bronze/80 transition-colors"
      >
        <span className={`transition-transform ${showCode ? 'rotate-90' : ''}`}>›</span>
        {showCode ? t.hideCode : t.showCode}
      </button>
      {showCode && (
        <pre className="mt-2 font-mono text-[11px] text-sl-on-surface-muted bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-3 overflow-x-auto whitespace-pre-wrap break-all">
          {snippet}
        </pre>
      )}
    </section>
  )
}
