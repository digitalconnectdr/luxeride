'use client'
// ── Botón "Recomendar función / Reportar problema" — barra superior del admin ──
// Mismo patrón que EnterpriseLeadModal (createPortal a document.body, overlay
// + panel centrado). El trigger es un ícono junto a Ayuda en la topbar; el
// tipo (feature/bug) se elige con un pill-toggle, igual al selector de tier
// de la tienda de add-ons.

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb } from 'lucide-react'
import { submitFeatureRequestAction } from '@/app/actions/feature-requests'

export interface FeatureRequestLabels {
  triggerLabel: string
  modalTitle: string
  modalDesc: string
  typeFeature: string
  typeBug: string
  titleLabel: string
  titlePlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
  submit: string
  submitting: string
  success: string
  cancel: string
  close: string
}

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function FeatureRequestButton({
  labels,
  variant = 'light',
}: {
  labels: FeatureRequestLabels
  /** 'dark' para colocarlo sobre la barra oscura móvil del sidebar. */
  variant?: 'light' | 'dark'
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
    setError(null)
    startTransition(async () => {
      const res = await submitFeatureRequestAction(fd)
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
        className={
          variant === 'dark'
            ? 'p-2 rounded-lg text-white/50 hover:text-gold hover:bg-white/5 transition-colors'
            : 'p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors'
        }
      >
        <Lightbulb size={18} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative w-full max-w-md bg-sl-surface rounded-2xl shadow-2xl border border-sl-outline-variant p-6">
            {success ? (
              <div className="text-center py-4">
                <p className="text-sm text-sl-on-surface">{labels.success}</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
                >
                  {labels.close}
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-playfair text-lg font-semibold text-sl-on-surface">{labels.modalTitle}</h3>
                <p className="mt-1 text-xs text-sl-on-surface-muted">{labels.modalDesc}</p>

                <div className="mt-4 flex gap-2 bg-sl-bg border border-sl-outline-variant rounded-full p-1.5 w-fit">
                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      type === 'feature' ? 'bg-gold text-gray-900 shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
                    }`}
                  >
                    {labels.typeFeature}
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      type === 'bug' ? 'bg-gold text-gray-900 shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
                    }`}
                  >
                    {labels.typeBug}
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.titleLabel} *</label>
                    <input name="title" required placeholder={labels.titlePlaceholder} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.descriptionLabel} *</label>
                    <textarea name="description" required rows={4} placeholder={labels.descriptionPlaceholder} className={inputCls} />
                  </div>

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <div className="flex justify-end items-center gap-4 pt-2">
                    <button type="button" onClick={close} className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
                      {labels.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
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
