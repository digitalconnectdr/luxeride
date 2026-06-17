'use client'
// ── Mapa estático elegante (pickup + destino) ─────────────────────────────────
// Si la "Maps Static API" no está habilitada o falla, el componente se oculta
// (no muestra una imagen rota).

import { useState } from 'react'

export function StaticMap({
  src,
  href,
  alt,
  openLabel,
}: {
  src: string
  href: string
  alt: string
  openLabel: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative rounded-2xl overflow-hidden border border-white/[0.08] group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full h-44 object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        onError={() => setFailed(true)}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      <span className="absolute bottom-2.5 right-2.5 text-[10px] font-medium bg-black/55 backdrop-blur px-2.5 py-1 rounded-full text-white/90">
        {openLabel} ↗
      </span>
    </a>
  )
}
