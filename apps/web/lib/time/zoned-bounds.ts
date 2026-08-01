// ── Límites de fecha en la zona horaria de la empresa (puro, testeable) ────────
// El panel (dashboard) y sus reportes necesitan saber cuándo empieza "hoy",
// "esta semana" y "este mes" — pero eso depende de LA ZONA HORARIA DE LA
// EMPRESA (companies.timezone), no de dónde corre el servidor. Vercel corre
// las funciones en UTC por defecto, así que construir estos límites con
// `new Date(); setHours(0,0,0,0)` (como hacía antes el dashboard) calculaba
// "hoy"/"esta semana" en UTC — para una empresa en Santo Domingo (UTC-4) eso
// desplaza el corte de medianoche 4 horas, contando reservas de las 8pm-12am
// como si fueran del día siguiente. Mismo problema de fondo que ya se
// resolvió para recargos de precio en lib/pricing/engine.ts (getLocalTimeParts)
// — este módulo es la misma idea aplicada a límites de rango en vez de a un
// solo instante.

/** Desplaza una fecha YYYY-MM-DD por N días de calendario (aritmética pura, sin zona horaria). */
export function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Primer día del mes de una fecha YYYY-MM-DD (aritmética pura). */
export function isoDateStartOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`
}

function getTimezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = fmt.formatToParts(instant)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second)
  return Math.round((asUtc - instant.getTime()) / 60_000)
}

/** Fecha local (YYYY-MM-DD) de un instante, en la zona horaria dada. Cae a UTC si falta/es inválida. */
export function getZonedIsoDate(instant: Date, timeZone: string | null | undefined): string {
  if (timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      })
      const parts = fmt.formatToParts(instant)
      const map: Record<string, string> = {}
      for (const p of parts) map[p.type] = p.value
      if (map.year && map.month && map.day) return `${map.year}-${map.month}-${map.day}`
    } catch {
      // timezone inválido — cae a UTC abajo
    }
  }
  return instant.toISOString().slice(0, 10)
}

/** Día de la semana LOCAL de un instante (0=domingo … 6=sábado). Cae a UTC si falta/es inválida. */
export function getZonedWeekday(instant: Date, timeZone: string | null | undefined): number {
  if (timeZone) {
    try {
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant)
      const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      if (weekday in DAY_INDEX) return DAY_INDEX[weekday]
    } catch {
      // timezone inválido — cae a UTC abajo
    }
  }
  return instant.getUTCDay()
}

/** Instante UTC que corresponde a la medianoche LOCAL de una fecha YYYY-MM-DD, en la zona horaria dada. */
export function zonedMidnightUtc(isoDate: string, timeZone: string | null | undefined): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  const naiveUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0)
  if (!timeZone) return new Date(naiveUtcMs)
  try {
    const offsetMin = getTimezoneOffsetMinutes(new Date(naiveUtcMs), timeZone)
    return new Date(naiveUtcMs - offsetMin * 60_000)
  } catch {
    return new Date(naiveUtcMs)
  }
}
