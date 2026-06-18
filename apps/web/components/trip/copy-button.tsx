'use client'
// ── Botón "Copiar" (portapapeles) para direcciones del tracking ───────────────

import { useState } from 'react'

export function CopyButton({
  text,
  label,
  copiedLabel,
  light = false,
}: {
  text: string
  label: string
  copiedLabel: string
  light?: boolean
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
      className={`text-[11px] font-medium transition-colors ${
        light ? 'text-[#75716a] hover:text-[#1d1b18]' : 'text-white/50 hover:text-white/80'
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
