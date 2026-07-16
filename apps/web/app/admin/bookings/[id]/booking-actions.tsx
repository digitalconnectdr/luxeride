'use client'
// ── Booking Actions — Cambio de estado + Asignación de conductor ───────────────

import { useState, useTransition } from 'react'
import { updateBookingStatusAction, assignDriverAction } from '@/app/actions/bookings'
import type { BookingStatus } from '@/lib/supabase/database.types'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Dictionary['admin']['bookingActions']
type TransitionKey = keyof Labels['transitions']

// Transiciones válidas (replicadas en cliente solo para UI — la validación real es server-side)
const NEXT_STATES: Record<BookingStatus, { status: BookingStatus; labelKey: TransitionKey; color: string }[]> = {
  quote:       [{ status: 'pending',     labelKey: 'confirm',  color: 'bg-amber-100 text-amber-700' }],
  pending:     [{ status: 'cancelled',   labelKey: 'cancel',   color: 'bg-red-100 text-red-700' }],
  assigned:    [
    { status: 'en_route',    labelKey: 'en_route',  color: 'bg-indigo-100 text-indigo-700' },
    { status: 'no_show',     labelKey: 'no_show',   color: 'bg-orange-100 text-orange-700' },
    { status: 'cancelled',   labelKey: 'cancel',    color: 'bg-red-100 text-red-700' },
  ],
  en_route:    [{ status: 'arrived',     labelKey: 'arrived',  color: 'bg-purple-100 text-purple-700' }],
  arrived:     [
    { status: 'in_progress', labelKey: 'start',     color: 'bg-orange-100 text-orange-700' },
    { status: 'no_show',     labelKey: 'no_show',    color: 'bg-orange-100 text-orange-700' },
  ],
  in_progress: [{ status: 'completed',   labelKey: 'complete', color: 'bg-green-100 text-green-700' }],
  completed:   [],
  cancelled:   [],
  no_show:     [],
  failed:      [],
}

interface Driver {
  id: string
  first_name: string
  last_name: string
}

interface Props {
  bookingId: string
  currentStatus: BookingStatus
  driverId: string | null
  drivers: Driver[]
  labels: Labels
}

export function BookingActions({ bookingId, currentStatus, driverId, drivers, labels: t }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState(driverId ?? '')

  const nextStates = NEXT_STATES[currentStatus] ?? []
  const terminal: BookingStatus[] = ['completed', 'cancelled', 'no_show', 'failed']
  const isTerminal = terminal.includes(currentStatus)
  const canAssignDriver = ['pending', 'assigned'].includes(currentStatus)

  if (isTerminal && !canAssignDriver) return null

  async function handleStatusChange(newStatus: BookingStatus, reason?: string) {
    setError('')
    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, newStatus, reason ? { reason } : undefined)
      if (!result.success) setError(result.error ?? t.errStatus)
    })
  }

  async function handleAssignDriver() {
    if (!selectedDriver) { setError(t.selectDriverErr); return }
    setError('')
    startTransition(async () => {
      const result = await assignDriverAction(bookingId, selectedDriver)
      if (!result.success) setError(result.error ?? t.errAssign)
    })
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
        {t.title}
      </p>

      {/* Asignar conductor */}
      {canAssignDriver && drivers.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.assignDriver}</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-sl-outline-variant bg-white px-3 py-2 text-sm text-sl-on-surface focus:border-bronze focus:outline-none"
            >
              <option value="">{t.selectPlaceholder}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssignDriver}
            disabled={isPending || !selectedDriver}
            className="px-4 py-2 bg-gold text-gray-900 text-sm font-medium rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isPending ? '...' : t.assign}
          </button>
        </div>
      )}

      {/* Botones de cambio de estado */}
      {nextStates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nextStates.map((ns) => (
            ns.status === 'cancelled' ? (
              <button
                key={ns.status}
                onClick={() => setShowCancelForm(!showCancelForm)}
                disabled={isPending}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${ns.color}`}
              >
                {t.transitions[ns.labelKey]}
              </button>
            ) : (
              <button
                key={ns.status}
                onClick={() => handleStatusChange(ns.status)}
                disabled={isPending}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${ns.color}`}
              >
                {isPending ? '...' : t.transitions[ns.labelKey]}
              </button>
            )
          ))}
        </div>
      )}

      {/* Formulario de cancelación */}
      {showCancelForm && (
        <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50">
          <p className="text-sm font-medium text-red-700">{t.cancelReasonTitle}</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            placeholder={t.cancelReasonPlaceholder}
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-sl-on-surface focus:outline-none focus:border-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCancelForm(false); setCancelReason('') }}
              className="px-4 py-2 text-sm border border-sl-outline-variant rounded-xl hover:bg-sl-bg text-sl-on-surface"
            >
              {t.transitions.cancel}
            </button>
            <button
              onClick={() => handleStatusChange('cancelled', cancelReason)}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? '...' : t.confirmCancel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
