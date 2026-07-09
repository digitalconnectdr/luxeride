'use client'
// ── Banner de error de acción — detecta mensajes de "límite de plan" y los
// muestra como un banner de upsell en vez de texto rojo plano. Cualquier otro
// error de validación cae al estilo original sin cambios.

import Link from 'next/link'

const LIMIT_PATTERN = /Llegaste al límite de ([\d,]+) ([^.]+?)(?: de tu plan| este mes en tu plan)\./i

export function ActionErrorBanner({ error }: { error: string }) {
  const match = error.match(LIMIT_PATTERN)

  if (!match) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  const [, amount, resource] = match
  return (
    <div className="rounded-2xl border border-bronze/25 bg-gradient-to-b from-bronze/[0.06] to-transparent p-5 flex items-start gap-4 flex-wrap">
      <span className="w-10 h-10 rounded-full bg-bronze/10 text-bronze flex items-center justify-center text-lg shrink-0">
        ⬆
      </span>
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-semibold text-sl-on-surface">
          Llegaste al límite de {amount} {resource} de tu plan
        </p>
        <p className="text-xs text-sl-on-surface-muted mt-1">
          Sube de plan para desbloquear más capacidad al instante.
        </p>
      </div>
      <Link
        href="/admin/settings#subscription"
        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-bronze text-white text-xs font-semibold rounded-full hover:opacity-90 transition-opacity"
      >
        Ver planes →
      </Link>
    </div>
  )
}
