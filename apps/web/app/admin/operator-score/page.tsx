import {
  TrendingUp,
  Gauge,
  Star,
  ShieldCheck,
  User,
  ArrowUpRight,
  Building2,
  Users,
  Info,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react'
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

const AREA_ICONS: Record<OperatorScoreArea, LucideIcon> = {
  revenueHealth: TrendingUp,
  dispatchEfficiency: Gauge,
  chauffeurQuality: Star,
  complianceReadiness: ShieldCheck,
  customerExperience: User,
  growthPerformance: ArrowUpRight,
  corporateAccountStrength: Building2,
  affiliateReliability: Users,
}

function scoreColor(score: number | null): string {
  if (score == null) return 'text-sl-on-surface-muted'
  if (score >= 85) return 'text-green-600'
  if (score >= 70) return 'text-bronze'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

// Puntos decorativos muy sutiles en los extremos de la tarjeta principal —
// puramente ornamentales, no interactivos.
function DotField({ align }: { align: 'left' | 'right' }) {
  const dots = Array.from({ length: 24 }, (_, i) => i)
  return (
    <svg
      aria-hidden
      className={`hidden md:block absolute top-1/2 -translate-y-1/2 ${align === 'left' ? '-left-6' : '-right-6'} w-32 h-32 pointer-events-none`}
      viewBox="0 0 120 120"
    >
      {dots.map((i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        return (
          <circle
            key={i}
            cx={10 + col * 20}
            cy={10 + row * 20}
            r={2}
            className="fill-[#8a6520]"
            opacity={0.12}
          />
        )
      })}
    </svg>
  )
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

  // Arco de progreso — circunferencia de un círculo r=54 (viewBox 120x120),
  // dorado/bronce siempre (color corporativo, no semántico de desempeño).
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = overall == null ? 0 : Math.max(0, Math.min(100, overall)) / 100
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-playfair text-4xl font-semibold text-[#1d1b18] tracking-tight">{t.title}</h1>
            <p className="text-sm text-[#75716a] mt-2">{t.subtitle}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#e5e1d8] px-4 py-2 shadow-sm">
            <CalendarDays size={14} className="text-[#8a6520] shrink-0" />
            <span className="text-xs font-medium text-[#1d1b18]">{t.periodLabel}</span>
          </div>
        </div>

        {/* Puntaje general — gauge circular + explicación */}
        <div className="relative overflow-hidden bg-white border border-[#e5e1d8] rounded-2xl shadow-sm px-8 py-10 flex flex-col md:flex-row items-center gap-10">
          <DotField align="left" />
          <DotField align="right" />

          <div className="relative shrink-0 w-40 h-40">
            <svg viewBox="0 0 120 120" className="w-40 h-40 -rotate-90">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e1d8" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#8a6520"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-playfair text-5xl font-semibold text-[#8a6520] leading-none">
                {overall ?? '—'}
              </span>
              <span className="text-xs text-[#75716a] mt-1">/100</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">
              {t.overallScore}
            </p>
            <div className="w-8 h-[2px] bg-[#8a6520] mt-2 mb-3 mx-auto md:mx-0" />
            <p className="text-sm text-[#75716a] max-w-md leading-relaxed">{t.overallNote}</p>
          </div>
        </div>

        {/* 8 áreas — icono + jerarquía de puntuación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AREA_ORDER.map((key) => {
            const score = areas[key]
            const Icon = AREA_ICONS[key]
            return (
              <div key={key} className="bg-white border border-[#e5e1d8] rounded-2xl shadow-sm px-5 py-5">
                <div className="w-9 h-9 rounded-full bg-[#f6f4ef] flex items-center justify-center mb-3">
                  <Icon size={16} className="text-[#8a6520]" strokeWidth={1.75} />
                </div>
                <p className="text-xs font-medium text-[#1d1b18]">{t.areas[key].label}</p>
                <p className={`font-playfair text-3xl font-semibold mt-1.5 ${scoreColor(score)}`}>
                  {score ?? '—'}
                </p>
                <p className="text-[11px] text-[#75716a] mt-2 leading-snug">
                  {score == null ? t.noData : t.areas[key].desc}
                </p>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#75716a]/80 px-1">
          <Info size={13} className="shrink-0" />
          <p>{t.methodNote}</p>
        </div>

      </div>
    </div>
  )
}
