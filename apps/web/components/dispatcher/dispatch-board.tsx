'use client'
// ── F1.13 — Dispatch Board (Real-time) ─────────────────────────────────────────
// Columnas por estado con updates en vivo vía Supabase Realtime.
// Las mutaciones usan las server actions existentes (máquina de estados +
// notificaciones incluidas). Realtime → router.refresh() para re-fetch server.

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, Milestone, Plane, Route, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateBookingStatusAction, assignDriverAction } from '@/app/actions/bookings'
import { DispatchLiveMap } from './dispatch-live-map'
import { ActiveDriversPanel, type DriverStatusRow } from './active-drivers-panel'
import { AutoAssignToggle } from './auto-assign-toggle'
import { BackupProtocolToggle } from './backup-protocol-toggle'
import { playAlertChime } from '@/lib/notifications/chime'
import type { BookingStatus } from '@/lib/supabase/database.types'
import type { Dictionary, Locale } from '@/lib/i18n/server'

type DispatchDict = Dictionary['dispatch']
type FlightStatusDict = Dictionary['common']['flightStatus']

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export interface DispatchBooking {
  id: string
  booking_number: string
  status: string
  passenger_name: string | null
  passenger_phone: string | null
  scheduled_at: string
  pickup_address: string
  dropoff_address: string
  total_amount: number | null
  currency: string
  driver_id: string | null
  flight_number?: string | null
  flight_status?: string | null
  flight_delay_minutes?: number | null
  stops_count?: number
  events_count?: number
  distance_miles?: number | null
  arrived_at?: string | null
}

// Margen de tolerancia para "llegó a tiempo" — mismo criterio que la métrica
// de puntualidad en /admin/drivers/[id].
const ON_TIME_GRACE_MINUTES = 10

interface Driver {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  companyId: string
  initialBookings: DispatchBooking[]
  drivers: Driver[]
  driverStatuses: DriverStatusRow[]
  autoAssignEnabled: boolean
  backupProtocolEnabled: boolean
  locale: Locale
  t: DispatchDict
  flightT: FlightStatusDict
}

// ─── Columnas del board ───────────────────────────────────────────────────────
// Los estados que agrupa cada columna no cambian por idioma — el título sí
// (viene de `t.columns.*`), armado dentro del componente.

const COLUMN_DEFS: { key: string; statuses: string[]; accent: string }[] = [
  { key: 'pending',  statuses: ['pending'],                            accent: 'border-t-yellow-400' },
  { key: 'assigned', statuses: ['assigned'],                           accent: 'border-t-blue-400' },
  { key: 'active',   statuses: ['en_route', 'arrived', 'in_progress'], accent: 'border-t-orange-400' },
  { key: 'done',     statuses: ['completed', 'cancelled', 'no_show'],  accent: 'border-t-green-400' },
]

export function DispatchBoard({ companyId, initialBookings, drivers, driverStatuses, autoAssignEnabled, backupProtocolEnabled, locale, t, flightT }: Props) {
  const localeTag = LOCALE_TAGS[locale] ?? 'en-US'
  const COLUMNS = COLUMN_DEFS.map((c) => ({ ...c, title: t.columns[c.key as keyof typeof t.columns] }))

  // Siguiente acción del flujo operativo por estado
  const NEXT_ACTION: Record<string, { to: BookingStatus; label: string } | undefined> = {
    assigned:    { to: 'en_route',    label: t.nextAction.assigned },
    en_route:    { to: 'arrived',     label: t.nextAction.en_route },
    arrived:     { to: 'in_progress', label: t.nextAction.arrived },
    in_progress: { to: 'completed',   label: t.nextAction.in_progress },
  }
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // ── Realtime: refrescar el board ante cualquier cambio en bookings ──────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`dispatch-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          setLastUpdate(new Date())
          router.refresh()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, router])

  // ── Respaldo de polling: si Realtime no está habilitado en el proyecto, el
  // board igual se mantiene al día (mismo enfoque que los portales de cliente
  // y conductor). Re-fetch cada 12s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 12000)
    return () => clearInterval(id)
  }, [router])

  // ── Alerta de reserva nueva: toast + sonido cuando aparece una reserva
  // pendiente que no estaba en el render anterior. `null` en el ref = primer
  // render, para no alertar retroactivamente por lo que ya existía al cargar.
  const seenPendingIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    const pendingNow = initialBookings.filter((b) => b.status === 'pending')
    const pendingIds = new Set(pendingNow.map((b) => b.id))

    if (seenPendingIds.current) {
      const fresh = pendingNow.filter((b) => !seenPendingIds.current!.has(b.id))
      fresh.forEach((b) => toast(t.newBookingToast.replace('{number}', b.booking_number)))
      if (fresh.length > 0) playAlertChime()
    }

    seenPendingIds.current = pendingIds
  }, [initialBookings, t.newBookingToast])

  // ── Acciones ────────────────────────────────────────────────────────────────

  function advance(bookingId: string, to: BookingStatus) {
    setError('')
    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, to)
      if (!result.success) setError(result.error ?? t.errors.update)
      router.refresh()
    })
  }

  function cancel(bookingId: string) {
    const reason = window.prompt(t.prompts.cancelReason)
    if (reason === null) return
    setError('')
    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, 'cancelled', { reason })
      if (!result.success) setError(result.error ?? t.errors.cancel)
      router.refresh()
    })
  }

  function assign(bookingId: string, driverId: string, currentDriverId: string | null) {
    if (!driverId) return
    let reason: string | undefined
    // Ya tenía OTRO conductor asignado → es una reasignación, no una asignación
    // inicial. Se pide motivo (opcional) para dejarlo en la bitácora del viaje.
    if (currentDriverId && currentDriverId !== driverId) {
      const r = window.prompt(t.prompts.reassignReason)
      if (r === null) return // canceló el prompt
      reason = r
    }
    setError('')
    startTransition(async () => {
      const result = await assignDriverAction(bookingId, driverId, undefined, reason)
      if (!result.success) setError(result.error ?? t.errors.assign)
      router.refresh()
    })
  }

  const driverName = (id: string | null) => {
    if (!id) return null
    const d = drivers.find((x) => x.id === id)
    return d ? `${d.first_name} ${d.last_name}` : null
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-2xl font-semibold text-sl-on-surface">
            {t.title}
          </h1>
          <p className="text-xs text-sl-on-surface-muted mt-0.5">
            {t.liveUpdate}
            {lastUpdate &&
              ` ${t.lastChange.replace('{time}', lastUpdate.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoAssignToggle initialEnabled={autoAssignEnabled} labels={t.autoAssign} />
          <BackupProtocolToggle initialEnabled={backupProtocolEnabled} labels={t.backupProtocol} />
          {isPending && (
            <span className="text-xs text-sl-on-surface-muted animate-pulse">{t.saving}</span>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      <DispatchLiveMap
        labels={{
          title: t.liveMap.title,
          empty: t.liveMap.empty,
          legendDriver: t.liveMap.legendDriver,
          legendPending: t.liveMap.legendPending,
          legendIdle: t.liveMap.legendIdle,
        }}
      />

      <ActiveDriversPanel drivers={driverStatuses} labels={t.activeDrivers} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = initialBookings.filter((b) => col.statuses.includes(b.status))
          const totalValue = items.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)
          const columnCurrency = items.find((b) => b.total_amount != null)?.currency ?? ''
          return (
            <div
              key={col.key}
              className={`bg-sl-surface-high border border-sl-outline-variant border-t-4 ${col.accent} rounded-2xl flex flex-col max-h-[calc(100vh-180px)]`}
            >
              <div className="px-4 py-2.5 border-b border-sl-outline-variant flex items-center justify-between shrink-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                    {col.title}
                  </p>
                  {totalValue > 0 && (
                    <p className="text-[11px] font-semibold text-sl-on-surface mt-0.5">
                      ${totalValue.toFixed(2)} {columnCurrency}
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold text-sl-on-surface bg-sl-bg rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                  {items.length}
                </span>
              </div>

              <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 text-sl-on-surface-muted/60 py-8">
                    <Inbox size={18} strokeWidth={1.75} />
                    <p className="text-[11px]">—</p>
                  </div>
                ) : (
                  items.map((b) => {
                    const flightTone =
                      b.flight_status === 'cancelled'
                        ? 'text-red-600 bg-red-50'
                        : (b.flight_delay_minutes ?? 0) >= 15
                          ? 'text-orange-600 bg-orange-50'
                          : 'text-sl-on-surface-muted bg-sl-outline-variant/25'
                    // El select de abajo ya muestra el conductor asignado (pendientes/
                    // asignados) — repetir su nombre en una línea aparte sería
                    // información duplicada, así que esa línea solo aparece cuando
                    // NO hay select (en curso / finalizados).
                    const showDriverLine = !['pending', 'assigned'].includes(b.status) && driverName(b.driver_id)
                    return (
                    <div
                      key={b.id}
                      className="bg-sl-bg border border-sl-outline-variant rounded-lg p-2.5 space-y-1.5 hover:border-sl-on-surface-muted/40 transition-colors"
                    >
                      {/* Encabezado: código + estado ... precio */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <a
                            href={`/admin/bookings/${b.id}`}
                            className="font-mono text-[11px] font-semibold text-bronze hover:underline shrink-0"
                          >
                            {b.booking_number}
                          </a>
                          <span className="text-[9px] font-semibold text-sl-on-surface-muted uppercase tracking-wide truncate">
                            {t.status[b.status as keyof typeof t.status] ?? b.status}
                          </span>
                          {!!b.events_count && (
                            <a
                              href={`/admin/bookings/${b.id}`}
                              title={t.recentEventsTitle}
                              className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100 rounded-full px-1 py-0.5 shrink-0"
                            >
                              <AlertTriangle size={9} strokeWidth={2.5} />
                              {b.events_count}
                            </a>
                          )}
                        </div>
                        {b.total_amount != null && (
                          <span className="text-xs font-bold text-sl-on-surface shrink-0">
                            ${Number(b.total_amount).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Hora + pasajero */}
                      <p className="text-xs leading-tight">
                        <span className="font-semibold text-sl-on-surface">
                          {new Date(b.scheduled_at).toLocaleString(localeTag, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        <span className="text-sl-on-surface-muted"> · {b.passenger_name ?? t.noName}</span>
                      </p>

                      {/* Ruta: origen → destino en una sola línea */}
                      <div
                        className="flex items-center gap-1.5 text-[11px] text-sl-on-surface-muted"
                        title={`${b.pickup_address || '—'} → ${b.dropoff_address || '—'}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{b.pickup_address || '—'}</span>
                        <ArrowRight size={9} strokeWidth={2.25} className="shrink-0 opacity-60" />
                        <span className="min-w-0 flex-1 truncate text-right">{b.dropoff_address || '—'}</span>
                      </div>

                      {/* Chips secundarios: paradas, distancia, vuelo */}
                      {((b.stops_count ?? 0) > 0 || b.distance_miles != null || b.flight_number) && (
                        <div className="flex flex-wrap items-center gap-1">
                          {(b.stops_count ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-sl-on-surface-muted bg-sl-outline-variant/25 rounded-full px-1.5 py-0.5">
                              <Milestone size={9} strokeWidth={2.25} />
                              {b.stops_count} {b.stops_count === 1 ? t.stop : t.stops}
                            </span>
                          )}
                          {b.distance_miles != null && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-sl-on-surface-muted bg-sl-outline-variant/25 rounded-full px-1.5 py-0.5">
                              <Route size={9} strokeWidth={2.25} />
                              {Number(b.distance_miles).toFixed(1)} mi
                            </span>
                          )}
                          {b.flight_number && (
                            <span
                              title={
                                b.flight_status === 'cancelled'
                                  ? flightT.cancelled
                                  : (b.flight_delay_minutes ?? 0) >= 15
                                    ? flightT.delay.replace('{minutes}', String(b.flight_delay_minutes))
                                    : b.flight_status === 'arrived'
                                      ? flightT.arrived
                                      : b.flight_status === 'enroute'
                                        ? flightT.enroute
                                        : undefined
                              }
                              className={`inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${flightTone}`}
                            >
                              <Plane size={9} strokeWidth={2.25} />
                              {b.flight_number}
                              {b.flight_status === 'cancelled'
                                ? ` · ${flightT.cancelled}`
                                : (b.flight_delay_minutes ?? 0) >= 15
                                  ? ` · +${b.flight_delay_minutes}m`
                                  : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Conductor (solo cuando no hay select debajo) + puntualidad */}
                      {(showDriverLine || b.arrived_at) && (
                        <div className="space-y-1">
                          {showDriverLine && (
                            <p className="flex items-center gap-1 text-[11px] font-medium text-sl-on-surface">
                              <UserRound size={11} strokeWidth={2.25} className="text-bronze shrink-0" />
                              {driverName(b.driver_id)}
                            </p>
                          )}
                          {b.arrived_at && (() => {
                            const grace = new Date(b.scheduled_at).getTime() + ON_TIME_GRACE_MINUTES * 60_000
                            const onTime = new Date(b.arrived_at).getTime() <= grace
                            const time = new Date(b.arrived_at).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
                            return (
                              <p className={`flex items-center gap-1 text-[11px] font-medium ${onTime ? 'text-green-600' : 'text-red-500'}`}>
                                {onTime
                                  ? <CheckCircle2 size={11} strokeWidth={2.25} className="shrink-0" />
                                  : <AlertTriangle size={11} strokeWidth={2.25} className="shrink-0" />}
                                {t.arrivedAtPickup.replace('{time}', time)}{!onTime && ` ${t.late}`}
                              </p>
                            )
                          })()}
                        </div>
                      )}

                      {/* Asignar / reasignar conductor (pendientes y asignados) */}
                      {['pending', 'assigned'].includes(b.status) && drivers.length > 0 && (
                        <select
                          defaultValue={b.driver_id ?? ''}
                          disabled={isPending}
                          onChange={(e) => assign(b.id, e.target.value, b.driver_id)}
                          className="w-full text-[11px] bg-white border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface focus:border-bronze focus:outline-none disabled:opacity-50"
                        >
                          <option value="">{b.driver_id ? t.reassignDriver : t.assignDriver}</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.first_name} {d.last_name}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Acciones de avance */}
                      <div className="flex items-center gap-1.5">
                        {NEXT_ACTION[b.status] && (
                          <button
                            disabled={isPending}
                            onClick={() => advance(b.id, NEXT_ACTION[b.status]!.to)}
                            className="flex-1 text-[11px] font-semibold px-2 py-1 bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
                          >
                            {NEXT_ACTION[b.status]!.label}
                          </button>
                        )}
                        {['pending', 'assigned', 'en_route'].includes(b.status) && (
                          <button
                            disabled={isPending}
                            onClick={() => cancel(b.id)}
                            title={t.errors.cancel}
                            className="shrink-0 p-1 text-sl-on-surface-muted hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <X size={13} strokeWidth={2.25} />
                          </button>
                        )}
                      </div>
                    </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
