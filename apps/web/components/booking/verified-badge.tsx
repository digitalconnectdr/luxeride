// ── Sello "LuxeRide Verified" ──────────────────────────────────────────────────
// Visible al pasajero en el micrositio cuando isLuxeRideVerified() es true
// (ver lib/compliance/verified.ts). Mismo tratamiento "prestigio" que ya usa
// PLAN_BADGE_STYLE para el plan Enterprise (dorado sobre fondo oscuro) —
// components/booking vive del lado público, así que no importa ese archivo
// de /lib/billing (es interno de admin), solo reusa el mismo look.

import { InfoTip } from '@/components/ui/info-tip'

export function VerifiedBadge({
  label,
  tooltip,
  variant = 'dark',
}: {
  label: string
  tooltip: string
  // 'dark': pill dorado sobre fondo oscuro (héroes noir/ivory/bold).
  // 'light': para fondos claros (ej. la barra de confianza de la plantilla
  // Corporate) — mismo ícono, sin el fondo oscuro que desentonaría ahí.
  variant?: 'dark' | 'light'
}) {
  if (variant === 'light') {
    return (
      <span className="inline-flex items-center gap-2.5 text-sm text-[#42484f]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a24b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span className="font-medium text-[#161a1f]">{label}</span>
        <InfoTip text={tooltip} />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a24b]/40 bg-[#1a1613] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e9c176]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
      <InfoTip text={tooltip} />
    </span>
  )
}
