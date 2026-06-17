'use client'
// ── Acciones del pasajero en el link de seguimiento: cancelar + reportar ───────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelTripByClientAction, reportDriverAction } from '@/app/actions/trip'

interface Labels {
  cancel: {
    action: string; title: string; desc: string
    reasonPh: string; confirm: string; back: string; done: string
  }
  report: {
    action: string; title: string; desc: string
    reasonPh: string; send: string; done: string
    cats: { false_arrival: string; no_contact: string; unsafe: string; other: string }
  }
}

type Panel = 'none' | 'cancel' | 'report'

export function TrackActions({
  bookingId,
  brandColor,
  canCancel,
  canReport,
  labels,
}: {
  bookingId: string
  brandColor: string
  canCancel: boolean
  canReport: boolean
  labels: Labels
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('none')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<keyof Labels['report']['cats']>('false_arrival')
  const [error, setError] = useState('')
  const [reportDone, setReportDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!canCancel && !canReport) return null

  function doCancel() {
    setError('')
    startTransition(async () => {
      const res = await cancelTripByClientAction(bookingId, reason)
      if (!res.success) { setError(res.error ?? 'Error'); return }
      router.refresh()
    })
  }

  function doReport() {
    setError('')
    startTransition(async () => {
      const res = await reportDriverAction(bookingId, category, reason)
      if (!res.success) { setError(res.error ?? 'Error'); return }
      setReportDone(true)
      setPanel('none')
      setReason('')
    })
  }

  return (
    <div className="space-y-3">
      {reportDone && (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 text-center">
          {labels.report.done}
        </p>
      )}

      {/* Panel cancelar */}
      {panel === 'cancel' ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 space-y-3">
          <p className="text-sm font-semibold text-white">{labels.cancel.title}</p>
          <p className="text-xs text-white/50">{labels.cancel.desc}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.cancel.reasonPh}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setPanel('none'); setError('') }}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-medium border border-white/15 rounded-xl text-white/80 hover:bg-white/5 transition-colors"
            >
              {labels.cancel.back}
            </button>
            <button
              onClick={doCancel}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {labels.cancel.confirm}
            </button>
          </div>
        </div>
      ) : panel === 'report' ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <p className="text-sm font-semibold text-white">{labels.report.title}</p>
          <p className="text-xs text-white/50">{labels.report.desc}</p>
          <div className="space-y-1.5">
            {(Object.keys(labels.report.cats) as Array<keyof Labels['report']['cats']>).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input
                  type="radio"
                  name="cat"
                  checked={category === k}
                  onChange={() => setCategory(k)}
                  className="accent-[var(--brand)]"
                />
                {labels.report.cats[k]}
              </label>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.report.reasonPh}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setPanel('none'); setError('') }}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-medium border border-white/15 rounded-xl text-white/80 hover:bg-white/5 transition-colors"
            >
              ←
            </button>
            <button
              onClick={doReport}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-gray-900 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: brandColor }}
            >
              {labels.report.send}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {canReport && !reportDone && (
            <button
              onClick={() => { setPanel('report'); setError('') }}
              className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors"
            >
              {labels.report.action}
            </button>
          )}
          {canCancel && canReport && <span className="text-white/20 text-xs">·</span>}
          {canCancel && (
            <button
              onClick={() => { setPanel('cancel'); setError('') }}
              className="text-xs text-red-400/70 hover:text-red-400 underline underline-offset-2 transition-colors"
            >
              {labels.cancel.action}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
