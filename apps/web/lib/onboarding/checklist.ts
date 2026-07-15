// ── Checklist de onboarding — puro, sin acceso a datos ─────────────────────────
// Misma forma que lib/operator-score/engine.ts: counts entran, items salen.
// Cada item representa UNA sección que la empresa debe configurar para operar.

export type OnboardingItemKey = 'fleet' | 'pricing' | 'payments' | 'team' | 'branding'

export interface OnboardingCounts {
  vehicleTypesCount: number
  vehiclesCount: number
  serviceZonesCount: number
  pricingRulesCount: number
  paymentProviderConnected: boolean
  teamOrDriversCount: number
  hasLogo: boolean
  hasBrandColor: boolean
  companyServicesCount: number
}

export interface OnboardingItem {
  key: OnboardingItemKey
  done: boolean
  href: string
}

export function computeOnboardingChecklist(counts: OnboardingCounts): OnboardingItem[] {
  return [
    {
      key: 'fleet',
      done: counts.vehicleTypesCount > 0 && counts.vehiclesCount > 0,
      href: '/admin/fleet',
    },
    {
      key: 'pricing',
      done: counts.serviceZonesCount > 0 || counts.pricingRulesCount > 0,
      href: '/admin/zones',
    },
    {
      key: 'payments',
      done: counts.paymentProviderConnected,
      href: '/admin/settings#payments',
    },
    {
      key: 'team',
      done: counts.teamOrDriversCount > 0,
      href: '/admin/team',
    },
    {
      key: 'branding',
      done: counts.hasLogo && counts.hasBrandColor && counts.companyServicesCount > 0,
      href: '/admin/settings#branding',
    },
  ]
}

export function getOnboardingProgress(items: OnboardingItem[]): { completed: number; total: number } {
  return { completed: items.filter((i) => i.done).length, total: items.length }
}
