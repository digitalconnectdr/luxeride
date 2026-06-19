// ── Booking Status Badge ───────────────────────────────────────────────────────
// Componente compartido entre admin y portal público.
// Sin hooks — se puede usar en Server Components y Client Components.

import type { BookingStatus } from '@/lib/supabase/database.types'

interface Config {
  label: string
  cls: string
}

const STATUS_CONFIG: Record<BookingStatus, Config> = {
  quote:       { label: 'Cotización',  cls: 'bg-gray-100 text-gray-600' },
  pending:     { label: 'Pendiente',   cls: 'bg-yellow-100 text-yellow-700' },
  assigned:    { label: 'Asignado',    cls: 'bg-blue-100 text-[#0071e3]' },
  en_route:    { label: 'En ruta',     cls: 'bg-indigo-100 text-indigo-700' },
  arrived:     { label: 'Llegó',       cls: 'bg-purple-100 text-purple-700' },
  in_progress: { label: 'En viaje',    cls: 'bg-orange-100 text-orange-700' },
  completed:   { label: 'Completado',  cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelado',   cls: 'bg-red-100 text-red-600' },
  no_show:     { label: 'No apareció', cls: 'bg-red-100 text-red-600' },
  failed:      { label: 'Fallido',     cls: 'bg-red-200 text-red-800' },
}

interface Props {
  status: BookingStatus
  size?: 'sm' | 'md'
  /** Etiquetas traducidas por estado (admin.bookingStatuses). Si se omite, usa el español por defecto. */
  labels?: Partial<Record<BookingStatus, string>>
}

export function BookingStatusBadge({ status, size = 'sm', labels }: Props) {
  const base0 = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  const cfg = { ...base0, label: labels?.[status] ?? base0.label }
  const base = size === 'md'
    ? 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold'
    : 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold'

  return (
    <span className={`${base} ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
