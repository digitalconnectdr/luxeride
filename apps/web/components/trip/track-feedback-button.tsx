'use client'
// ── Botón "Recomendar función / Reportar problema" — página pública de
// tracking del pasajero. Mismo patrón que components/admin/feature-request-modal.tsx
// pero reskineado para el tema oscuro de /track/[id] (esa página no usa los
// tokens sl-* del admin, ver bg-[#08080a]/border-white/[0.08] en el resto del
// archivo). Envía booking_id para que la server action re-derive la empresa.

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb } from 'lucide-react'
import { submitPublicFeatureRequestAction } from '@/app/actions/feature-requests'
import type { FeatureRequestLabels } from '@/components/admin/feature-request-modal'

const inputCls =
  'w-full text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 ' +
  'text-white placeholder:text-white/30 ' +
  'focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20'

export function TrackFeedbackButton({
  bookingId,
  brandColor,
  labels,
}: {
  bookingId: string
  /** Se pasa explícito (no var(--brand)) porque el modal se monta vía portal
   * en document.body, fuera del div que declara la custom property. */
  brandColor: string
  labels: FeatureRequestLabels
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'feature' | 'bug'>('feature')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    setOpen(false)
    setError(null)
    setSuccess(false)
    setType('feature')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    fd.set('booking_id', bookingId)
    setError(null)
    startTransition(async () => {
      const res = await submitPublicFeatureRequestAction(fd)
      if (res.success) setSuccess(true)
      else setError(res.error ?? 'Error')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={labels.triggerLabel}
        aria-label={labels.triggerLabel}
        className="p-2 rounded-lg text-white/50 hover:bg-white/5 transition-colors"
        onMouseEnter={(e) => { e.currentTarget.style.color = brandColor }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '' }}
      >
        <Lightbulb size={18} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="relative w-full max-w-md bg-[#0c0c0e] rounded-2xl shadow-2xl border border-white/10 p-6">
            {success ? (
              <div className="text-center py-4">
                <p className="text-sm text-white/80">{labels.success}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 px-4 py-2 text-sm font-medium rounded-lg text-[#08080a] transition-opacity hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  {labels.close}
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-playfair text-lg font-semibold text-white">{labels.modalTitle}</h3>
                <p className="mt-1 text-xs text-white/40">{labels.modalDesc}</p>

                <div className="mt-4 flex gap-2 bg-white/[0.04] border border-white/10 rounded-full p-1.5 w-fit">
                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={type === 'feature' ? { backgroundColor: brandColor, color: '#08080a' } : undefined}
                  >
                    <span className={type === 'feature' ? '' : 'text-white/40 hover:text-white/70'}>{labels.typeFeature}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={type === 'bug' ? { backgroundColor: brandColor, color: '#08080a' } : undefined}
                  >
                    <span className={type === 'bug' ? '' : 'text-white/40 hover:text-white/70'}>{labels.typeBug}</span>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">{labels.titleLabel} *</label>
                    <input name="title" required placeholder={labels.titlePlaceholder} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">{labels.descriptionLabel} *</label>
                    <textarea name="description" required rows={4} placeholder={labels.descriptionPlaceholder} className={inputCls} />
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  <div className="flex justify-end items-center gap-4 pt-2">
                    <button type="button" onClick={close} className="text-xs text-white/40 hover:text-white/70">
                      {labels.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 text-sm font-medium rounded-lg text-[#08080a] disabled:opacity-60 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brandColor }}
                    >
                      {isPending ? labels.submitting : labels.submit}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
