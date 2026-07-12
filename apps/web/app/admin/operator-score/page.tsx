import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { gatherOperatorScoreInputs } from '@/lib/operator-score/gather'
import {
  computeOperatorScore,
  scoreAffiliateReliability,
  scoreChauffeurQuality,
  scoreComplianceReadiness,
  scoreCorporateAccountStrength,
  scoreCustomerExperience,
  scoreDispatchEfficiency,
  scoreGrowthPerformance,
  scoreRevenueHealth,
  type OperatorScoreArea,
} from '@/lib/operator-score/engine'

const AREA_ORDER: OperatorScoreArea[] = [
  'revenueHealth',
  'dispatchEfficiency',
  'chauffeurQuality',
  'complianceReadiness',
  'customerExperience',
  'growthPerformance',
  'corporateAccountStrength',
  'affiliateReliability',
]

function scoreColor(score: number | null): string {
  if (score == null) return 'text-sl-on-surface-muted'
  if (score >= 85) return 'text-green-600'
  if (score >= 70) return 'text-bronze'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export default async function OperatorScorePage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const inputs = await gatherOperatorScoreInputs(admin, user.company_id)
  const t = getDict().admin.operatorScore

  const { overall, areas } = computeOperatorScore({
    complianceReadiness: scoreComplianceReadiness(inputs.complianceScore),
    affiliateReliability: scoreAffiliateReliability(inputs.affiliateReliability),
    chauffeurQuality: scoreChauffeurQuality(inputs.chauffeurQuality),
    dispatchEfficiency: scoreDispatchEfficiency(inputs.dispatchEfficiency),
    customerExperience: scoreCustomerExperience(inputs.customerExperienceAvgRating),
    revenueHealth: scoreRevenueHealth(inputs.revenue),
    growthPerformance: scoreGrowthPerformance(inputs.growth),
    corporateAccountStrength: scoreCorporateAccountStrength(inputs.corporateAccounts),
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 flex flex-col items-center text-center">
        <p className="text-xs uppercase tracking-widest text-sl-on-surface-muted">{t.overallScore}</p>
        <p className={`font-playfair text-6xl font-semibold mt-3 ${scoreColor(overall)}`}>
          {overall ?? '—'}<span className="text-2xl text-sl-on-surface-muted">/100</span>
        </p>
        <p className="text-xs text-sl-on-surface-muted mt-3 max-w-md">{t.overallNote}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {AREA_ORDER.map((key) => {
          const score = areas[key]
          return (
            <div key={key} className="bg-sl-surface border border-sl-outline-variant rounded-xl p-5">
              <p className="text-xs font-medium text-sl-on-surface-muted">{t.areas[key].label}</p>
              <p className={`font-playfair text-3xl font-semibold mt-2 ${scoreColor(score)}`}>
                {score ?? '—'}
              </p>
              <p className="text-[11px] text-sl-on-surface-muted mt-2 leading-snug">
                {score == null ? t.noData : t.areas[key].desc}
              </p>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-sl-on-surface-muted/70">{t.methodNote}</p>
    </div>
  )
}
