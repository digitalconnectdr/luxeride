// ── Nómina de conductores — lógica pura (sin DB) ───────────────────────────────
// Alcance: solo cálculo y reporte, NUNCA mueve dinero real — el operador paga
// por fuera (efectivo, transferencia) y marca el periodo como pagado. Dos
// modelos, ambos calculables directo desde bookings.completed sin infra de
// reloj/turnos nueva: comisión (% del total del viaje) o tarifa fija por viaje.

export type PayrollType = 'commission' | 'flat_per_trip'

export interface CompletedTripForPayroll {
  totalAmount: number
}

/** Monto a pagar al conductor por los viajes dados, según su modelo de pago. */
export function computeDriverEarnings(
  trips: CompletedTripForPayroll[],
  payrollType: PayrollType,
  rate: number,
): number {
  if (rate <= 0 || trips.length === 0) return 0

  const raw =
    payrollType === 'flat_per_trip'
      ? trips.length * rate
      : trips.reduce((sum, t) => sum + t.totalAmount * (rate / 100), 0)

  return Math.round(raw * 100) / 100
}
