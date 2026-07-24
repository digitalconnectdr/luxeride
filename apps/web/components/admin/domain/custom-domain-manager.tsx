'use client'
// ── Gestión del dominio personalizado del operador — BYOD + verificación ────
// Un solo componente porque los 3 estados (sin dominio / pendiente / verificado)
// comparten el mismo formulario de conexión y solo cambia qué se muestra
// arriba de él (mismo patrón que otros forms de admin: useTransition + acción
// del servidor, ver DriverPayrollSettingsForm).

import { useState, useTransition } from 'react'
import {
  addCustomDomainAction,
  checkCustomDomainStatusAction,
  removeCustomDomainAction,
  type DomainConnectionResult,
} from '@/app/actions/domains'
import type { Dictionary } from '@/lib/i18n/server'
import type { CustomDomainStatus } from '@/lib/supabase/database.types'

type T = Dictionary['admin']['domain']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

function StatusPill({ status, t }: { status: CustomDomainStatus; t: T }) {
  const map: Record<CustomDomainStatus, { label: string; cls: string }> = {
    verified: { label: t.statusVerified, cls: 'bg-green-50 text-green-700 border-green-200' },
    pending_verification: { label: t.statusPending, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    failed: { label: t.statusFailed, cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

function DnsInstructions({ result, t }: { result: DomainConnectionResult; t: T }) {
  if (result.verified || result.verification.length === 0) return null
  return (
    <div className="bg-sl-bg border border-sl-outline-variant rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-sl-on-surface">{t.dnsInstructionsTitle}</p>
      <p className="text-xs text-sl-on-surface-muted">{t.dnsInstructionsBody}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="text-left text-sl-on-surface-muted uppercase tracking-wide">
              <th className="pr-4 py-1 font-semibold">{t.dnsType}</th>
              <th className="pr-4 py-1 font-semibold">{t.dnsName}</th>
              <th className="py-1 font-semibold">{t.dnsValue}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {result.verification.map((rec, i) => (
              <tr key={i} className="border-t border-sl-outline-variant/50">
                <td className="pr-4 py-1.5">{rec.type}</td>
                <td className="pr-4 py-1.5">{rec.domain}</td>
                <td className="py-1.5 break-all">{rec.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CustomDomainManager({
  currentDomain,
  currentStatus,
  t,
}: {
  currentDomain: string | null
  currentStatus: CustomDomainStatus | null
  t: T
}) {
  const [domain, setDomain] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<DomainConnectionResult | null>(null)
  // Reflejamos el estado localmente para no depender de un router.refresh() tras cada acción.
  const [liveDomain, setLiveDomain] = useState(currentDomain)
  const [liveStatus, setLiveStatus] = useState(currentStatus)

  function connect() {
    setError('')
    const value = domain.trim()
    if (!value) return
    startTransition(async () => {
      const result = await addCustomDomainAction(value)
      if (!result.success || !result.data) {
        setError(result.error ?? t.errorGeneric)
        return
      }
      setLiveDomain(value.toLowerCase())
      setLiveStatus(result.data.verified ? 'verified' : 'pending_verification')
      setLastResult(result.data)
      setDomain('')
    })
  }

  function recheck() {
    setError('')
    startTransition(async () => {
      const result = await checkCustomDomainStatusAction()
      if (!result.success || !result.data) {
        setError(result.error ?? t.errorGeneric)
        return
      }
      setLiveStatus(result.data.verified ? 'verified' : 'pending_verification')
      setLastResult(result.data)
    })
  }

  function remove() {
    if (!confirm(t.removeConfirm)) return
    setError('')
    startTransition(async () => {
      const result = await removeCustomDomainAction()
      if (!result.success) {
        setError(result.error ?? t.errorGeneric)
        return
      }
      setLiveDomain(null)
      setLiveStatus(null)
      setLastResult(null)
    })
  }

  return (
    <div className="space-y-4">
      {liveDomain && liveStatus ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-sl-on-surface-muted mb-1">{t.currentDomainLabel}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-semibold text-sl-on-surface font-mono">{liveDomain}</p>
              <StatusPill status={liveStatus} t={t} />
            </div>
          </div>
          {lastResult && <DnsInstructions result={lastResult} t={t} />}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={recheck}
              disabled={isPending}
              className="text-xs font-medium px-3 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {t.recheckButton}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="text-xs font-medium px-3 py-1.5 text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              {t.removeButton}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-sm text-sl-on-surface-muted">{t.noDomainYet}</p>
          <p className="font-playfair text-base font-semibold text-sl-on-surface">{t.byodSectionTitle}</p>
          <p className="text-xs text-sl-on-surface-muted">{t.byodHelp}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t.byodInputPlaceholder}
              className={inputCls}
            />
            <button
              type="button"
              onClick={connect}
              disabled={isPending || !domain.trim()}
              className="shrink-0 text-sm font-medium px-4 py-2 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {t.byodSubmit}
            </button>
          </div>
          {lastResult && <DnsInstructions result={lastResult} t={t} />}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
