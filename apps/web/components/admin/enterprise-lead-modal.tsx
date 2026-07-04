'use client'
// ── Modal de solicitud del plan Enterprise ──────────────────────────────────────
// El plan Enterprise es venta consultiva (precio a medida) — en vez de un link
// de checkout, este botón abre un formulario que genera un lead para que el
// super-admin lo gestione desde /super-admin/enterprise-leads.

import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { submitEnterpriseLeadAction } from '@/app/actions/enterprise-leads'

export interface EnterpriseLeadLabels {
  requestButton: string
  modalTitle: string
  modalDesc: string
  companyName: string
  contactName: string
  email: string
  phone: string
  fleetSize: string
  message: string
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

export function EnterpriseLeadModal({
  defaultCompanyName,
  defaultEmail,
  labels,
}: {
  defaultCompanyName?: string
  defaultEmail?: string
  labels: EnterpriseLeadLabels
}) {
  const [open, setOpen] = useState(false)
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
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const res = await submitEnterpriseLeadAction(fd)
      if (res.success) setSuccess(true)
      else setError(res.error ?? 'Error')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-bronze group-hover:text-bronze/80 shrink-0"
      >
        {labels.requestButton}
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

                <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.companyName} *</label>
                    <input name="company_name" required defaultValue={defaultCompanyName} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.contactName} *</label>
                    <input name="contact_name" required className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.email} *</label>
                      <input name="email" type="email" required defaultValue={defaultEmail} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.phone} *</label>
                      <input name="phone" type="tel" required className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.fleetSize}</label>
                    <input name="fleet_size" placeholder="ej. 25" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-sl-on-surface-muted mb-1">{labels.message}</label>
                    <textarea name="message" rows={3} className={inputCls} />
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
