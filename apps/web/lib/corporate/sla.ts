// ── SLA visible de la cuenta corporativa ───────────────────────────────────────
// El mismo criterio de puntualidad/cancelación que ya se calcula por CONDUCTOR
// en app/admin/drivers/[id]/page.tsx (gracia de 10 min sobre scheduled_at),
// pero agregado por CUENTA CORPORATIVA — para que el cliente vea el nivel de
// servicio real que está recibiendo, no solo el operador. Se extrae a función
// pura porque hay dos call-sites (el portal del cliente y la vista del
// operador en /admin/corporate/[id]).

const GRACE_MINUTES = 10

export interface AccountBooking {
  status: string
  scheduled_at: string
  arrived_at: string | null
}

export interface AccountSla {
  punctualityPct: number | null
  cancellationPct: number | null
  completedCount: number
}

export function computeAccountSla(bookings: AccountBooking[]): AccountSla {
  const relevant = bookings.filter((b) => ['completed', 'cancelled', 'no_show'].includes(b.status))
  if (!relevant.length) {
    return { punctualityPct: null, cancellationPct: null, completedCount: 0 }
  }

  const completed = relevant.filter((b) => b.status === 'completed' && b.arrived_at)
  const punctualityPct = completed.length
    ? Math.round(
        (completed.filter((b) => {
          const grace = new Date(b.scheduled_at).getTime() + GRACE_MINUTES * 60_000
          return new Date(b.arrived_at as string).getTime() <= grace
        }).length /
          completed.length) *
          100,
      )
    : null

  const problems = relevant.filter((b) => b.status === 'cancelled' || b.status === 'no_show')
  const cancellationPct = Math.round((problems.length / relevant.length) * 100)

  return { punctualityPct, cancellationPct, completedCount: completed.length }
}
