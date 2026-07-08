import type { ComplianceStatus } from './engine'

export const COMPLIANCE_STATUS_CLS: Record<ComplianceStatus, string> = {
  compliant:       'bg-green-500/10 text-green-400 border-green-500/20',
  partial:         'bg-amber-500/10 text-amber-400 border-amber-500/20',
  at_risk:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  non_compliant:   'bg-red-500/10 text-red-400 border-red-500/20',
  pending_review:  'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
}
