'use client'
// ── Botón "Copiar" (portapapeles) para direcciones del tracking ───────────────

import { useState } from 'react'

export function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string
  label: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors"
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
