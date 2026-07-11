'use client'
// ── Interruptor genérico de add-on por empresa (super-admin) ──────────────────
// Mismo patrón que AffiliateNetworkToggle, parametrizado por addon_key para
// reusarlo en los 3 add-ons nuevos (nómina, firma electrónica, códigos
// promocionales) sin repetir el componente.

import { useTransition } from 'react'
import { toggleCompanyAddonAction } from '@/app/actions/addons'
import type { AddonKey } from '@/lib/billing/addons'

export function CompanyAddonToggle({
  companyId,
  addonKey,
  label,
  enabled,
  enabledAt,
  includedByPlan,
}: {
  companyId: string
  addonKey: AddonKey
  label: string
  enabled: boolean
  enabledAt: string | null
  /** Si el plan actual (Elite/Enterprise) ya lo incluye, el toggle manual es informativo. */
  includedByPlan: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const active = includedByPlan || enabled

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-sl-on-surface">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          disabled={isPending || includedByPlan}
          onClick={() => startTransition(async () => { await toggleCompanyAddonAction(companyId, addonKey, !enabled) })}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${active ? 'bg-green-500' : 'bg-sl-outline-variant'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${active ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-xs text-sl-on-surface-muted min-w-[9rem]">
          {includedByPlan
            ? 'Included by plan'
            : enabled
              ? `Enabled${enabledAt ? ` since ${new Date(enabledAt).toLocaleDateString()}` : ''}`
              : 'Disabled'}
        </span>
      </div>
    </div>
  )
}
