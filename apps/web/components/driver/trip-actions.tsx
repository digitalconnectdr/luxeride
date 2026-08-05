'use client'
// ── Botón de avance de viaje para el conductor + no-show + rechazo + incidente ──

import { useEffect, useState, useTransition } from 'react'
import {
  driverAdvanceTripAction,
  driverNoShowAction,
  driverRejectTripAction,
  reportDriverIncidentAction,
} from '@/app/actions/driver'

function formatMinutesSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const INCIDENT_CATEGORIES = ['accident', 'breakdown', 'safety', 'unable_to_reach_passenger', 'other'] as const

export interface DriverActionLabels {
  assigned: string
  en_route: string
  arrived: string
  in_progress: string
  saving: string
  noShow: string
  noShowGraceActive: string
  noShowQ: string
  back: string
  noShowConfirm: string
  reject: string
  rejectReasonPlaceholder: string
  rejectConfirm: string
  incident: string
  incidentTitle: string
  incidentCategoryLabel: string
  incidentCategories: Record<(typeof INCIDENT_CATEGORIES)[number], string>
  incidentReasonPlaceholder: string
  incidentSubmit: string
  incidentDone: string
}

export function DriverTripActions({
  bookingId,
  status,
  labels,
  arrivedAt,
  graceMinutes,
}: {
  bookingId: string
  status: string
  labels: DriverActionLabels
  /** ISO timestamp de cuándo el conductor marcó "llegué" — solo aplica en status='arrived'. */
  arrivedAt?: string | null
  /** Minutos de cortesía antes de poder marcar no-show (companies.settings.policy.no_show_grace_minutes). */
  graceMinutes?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [confirmNoShow, setConfirmNoShow] = useState(false)

  // Countdown de cortesía: cuánto le falta al conductor antes de que el
  // servidor le permita marcar no-show (markDriverNoShow ya lo valida
  // server-side — esto es solo para no dejar tocar un botón que el
  // servidor va a rechazar de todos modos).
  const graceDeadline =
    status === 'arrived' && arrivedAt && graceMinutes != null
      ? new Date(arrivedAt).getTime() + graceMinutes * 60_000
      : null
  const [graceRemaining, setGraceRemaining] = useState(() =>
    graceDeadline ? Math.max(0, Math.ceil((graceDeadline - Date.now()) / 1000)) : 0,
  )
  useEffect(() => {
    if (!graceDeadline) return
    const tick = () => setGraceRemaining(Math.max(0, Math.ceil((graceDeadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [graceDeadline])
  const graceActive = graceRemaining > 0
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [reportingIncident, setReportingIncident] = useState(false)
  const [incidentCategory, setIncidentCategory] = useState<(typeof INCIDENT_CATEGORIES)[number]>('other')
  const [incidentReason, setIncidentReason] = useState('')
  const [incidentDone, setIncidentDone] = useState(false)

  const label = labels[status as 'assigned' | 'en_route' | 'arrived' | 'in_progress']
  const isActive = ['en_route', 'arrived', 'in_progress'].includes(status)
  if (!label && !isActive) return null

  function handleAdvance() {
    setError('')
    startTransition(async () => {
      const result = await driverAdvanceTripAction(bookingId)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function handleNoShow() {
    setError('')
    startTransition(async () => {
      const result = await driverNoShowAction(bookingId)
      if (!result.success) {
        setError(result.error ?? 'Error')
        setConfirmNoShow(false)
      }
    })
  }

  function handleReject() {
    setError('')
    startTransition(async () => {
      const result = await driverRejectTripAction(bookingId, rejectReason)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function handleIncidentSubmit() {
    setError('')
    startTransition(async () => {
      const result = await reportDriverIncidentAction(bookingId, incidentCategory, incidentReason)
      if (!result.success) {
        setError(result.error ?? 'Error')
        return
      }
      setIncidentDone(true)
      setReportingIncident(false)
    })
  }

  return (
    <div className="space-y-2.5">
      {label && (
        <button
          onClick={handleAdvance}
          disabled={isPending}
          className="w-full py-3.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isPending ? labels.saving : label}
        </button>
      )}

      {/* No-show: solo cuando el conductor ya llegó al punto, y solo tras la
      cortesía de espera configurada por el operador */}
      {status === 'arrived' && graceActive && (
        <p className="w-full text-center py-2.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
          {labels.noShowGraceActive.replace('{minutes}', formatMinutesSeconds(graceRemaining))}
        </p>
      )}

      {status === 'arrived' && !graceActive && (
        confirmNoShow ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <p className="text-xs text-red-700">{labels.noShowQ}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmNoShow(false)}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:bg-white transition-colors"
              >
                {labels.back}
              </button>
              <button
                onClick={handleNoShow}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? labels.saving : labels.noShowConfirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmNoShow(true)}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {labels.noShow}
          </button>
        )
      )}

      {/* Rechazar viaje: solo antes de iniciar ruta (status='assigned') */}
      {status === 'assigned' && (
        rejecting ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={labels.rejectReasonPlaceholder}
              disabled={isPending}
              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-[#1d1b18] placeholder:text-[#a8a39a] focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejecting(false)}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:bg-white transition-colors"
              >
                {labels.back}
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? labels.saving : labels.rejectConfirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setRejecting(true)}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {labels.reject}
          </button>
        )
      )}

      {/* Reportar incidente: durante el viaje activo */}
      {isActive && !incidentDone && (
        reportingIncident ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800">{labels.incidentTitle}</p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-amber-700 mb-1">{labels.incidentCategoryLabel}</label>
              <select
                value={incidentCategory}
                onChange={(e) => setIncidentCategory(e.target.value as (typeof INCIDENT_CATEGORIES)[number])}
                disabled={isPending}
                className="w-full text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-2 text-[#1d1b18] focus:outline-none"
              >
                {INCIDENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{labels.incidentCategories[c]}</option>
                ))}
              </select>
            </div>
            <textarea
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={labels.incidentReasonPlaceholder}
              disabled={isPending}
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-[#1d1b18] placeholder:text-[#a8a39a] focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportingIncident(false)}
                disabled={isPending}
                className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:bg-white transition-colors"
              >
                {labels.back}
              </button>
              <button
                onClick={handleIncidentSubmit}
                disabled={isPending || !incidentReason.trim()}
                className="flex-1 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? labels.saving : labels.incidentSubmit}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setReportingIncident(true)}
            disabled={isPending}
            className="w-full py-2.5 text-xs font-medium text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors"
          >
            {labels.incident}
          </button>
        )
      )}
      {incidentDone && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          ✓ {labels.incidentDone}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
