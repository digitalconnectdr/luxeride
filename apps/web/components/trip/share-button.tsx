'use client'
// ── Compartir viaje: usa navigator.share si existe, si no copia el enlace ──────

import { useState } from 'react'

export function ShareButton({
  label,
  copiedLabel,
  brandColor,
}: {
  label: string
  copiedLabel: string
  brandColor: string
}) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) {
      try {
        await navigator.share({ url })
        return
      } catch {
        // cancelado o no permitido → cae a copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* sin permisos de portapapeles */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
    >
      <span style={{ color: brandColor }}>↗</span>
      {copied ? copiedLabel : label}
    </button>
  )
}
