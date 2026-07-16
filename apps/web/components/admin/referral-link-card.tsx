'use client'

import { useState } from 'react'

export function ReferralLinkCard({
  url,
  title,
  desc,
  copyLabel,
  copiedLabel,
}: {
  url: string
  title: string
  desc: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
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
    <section className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-1">{title}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-4">{desc}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 min-w-[220px] font-mono text-sm text-bronze bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 truncate">
          {display}
        </span>
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </section>
  )
}
