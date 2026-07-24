'use client'
// ── Controles del panel de solicitudes de dominio (super-admin) ────────────
// "Marcar como comprado" pide el dominio real ya comprado (fuera del sistema,
// dinero real — ver app/actions/domains.ts) antes de resolver la solicitud.

import { useState, useTransition } from 'react'
import { resolveDomainRequestAction } from '@/app/actions/domains'

export function DomainRequestControls({ requestId }: { requestId: string }) {
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [purchasedDomain, setPurchasedDomain] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function reject() {
    if (!confirm('¿Rechazar esta solicitud?')) return
    setError('')
    startTransition(async () => {
      const result = await resolveDomainRequestAction(requestId, 'rejected')
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  function confirmPurchase() {
    const domain = purchasedDomain.trim()
    if (!domain) return
    setError('')
    startTransition(async () => {
      const result = await resolveDomainRequestAction(requestId, 'purchased', domain)
      if (!result.success) setError(result.error ?? 'Error')
      else setShowPurchaseForm(false)
    })
  }

  if (showPurchaseForm) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={purchasedDomain}
          onChange={(e) => setPurchasedDomain(e.target.value)}
          placeholder="dominio comprado"
          autoFocus
          className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 w-40 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
        />
        <button
          type="button"
          onClick={confirmPurchase}
          disabled={isPending || !purchasedDomain.trim()}
          className="text-[11px] font-medium px-2 py-1 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setShowPurchaseForm(false)}
          className="text-[11px] text-sl-on-surface-muted hover:text-sl-on-surface"
        >
          Cancelar
        </button>
        {error && <p className="text-[10px] text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowPurchaseForm(true)}
        disabled={isPending}
        className="text-[11px] font-medium px-2.5 py-1 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        Marcar como comprado
      </button>
      <button
        type="button"
        onClick={reject}
        disabled={isPending}
        className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        Rechazar
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
