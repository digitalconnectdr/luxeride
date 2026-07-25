// ── Feriados de la empresa para el recargo de tarifa ──────────────────────
// `pricing_rules.holiday_surcharge_pct` existía desde el inicio pero nunca se
// aplicaba: el motor no tenía forma de saber qué día es feriado. Esta función
// resuelve esa pregunta contra `company_holidays` (migración 77).

import type { createAdminClient } from '@/lib/supabase/server'
import { getLocalTimeParts } from '@/lib/pricing/engine'

/**
 * Devuelve las fechas de feriado que aplican a este viaje — en la práctica 0 o
 * 1 elementos, porque solo interesa el día del viaje. Se devuelve como arreglo
 * para que calculateFare reciba siempre la misma forma.
 *
 * La fecha se resuelve en la zona horaria de la EMPRESA, no en UTC: un viaje a
 * las 22:00 del 31 de diciembre en Santo Domingo ya es 1 de enero en UTC, y
 * cobrar el feriado equivocado sería peor que no cobrarlo.
 *
 * Nunca lanza: si la consulta falla, se devuelve vacío y la cotización sale
 * sin recargo de feriado — preferible a que no se pueda cotizar.
 */
export async function fetchHolidayDates(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  scheduledAt: Date,
  timezone: string | null | undefined,
): Promise<string[]> {
  try {
    const { isoDate } = getLocalTimeParts(scheduledAt, timezone)
    const { data } = await admin
      .from('company_holidays')
      .select('holiday_date')
      .eq('company_id', companyId)
      .eq('holiday_date', isoDate)
      .limit(1)
    return (data ?? []).map((h) => h.holiday_date)
  } catch (err) {
    console.error('[fetchHolidayDates]', err)
    return []
  }
}
