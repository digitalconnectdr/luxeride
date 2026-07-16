// Niveles del programa de referidos — mantener en sync con el CHECK de
// tier_key en supabase/migrations/20260716000054_referral_program.sql.
// El % de cada nivel se congela en company_referrals.commission_pct al
// momento exacto de cada referido individual; este módulo solo determina
// en qué nivel está un referrer AHORA, para saber qué % aplica al PRÓXIMO
// referido que consiga.

export type ReferralTierKey = 'iniciado' | 'socio' | 'aliado' | 'embajador'

export interface ReferralTier {
  key: ReferralTierKey
  min: number
  max: number | null
  pct: number
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { key: 'iniciado', min: 1, max: 3, pct: 5 },
  { key: 'socio', min: 4, max: 6, pct: 8 },
  { key: 'aliado', min: 7, max: 11, pct: 12 },
  { key: 'embajador', min: 12, max: null, pct: 15 },
]

/** Nivel vigente según el conteo de referidos ACTIVOS (dentro de sus 12 meses). Null si aún no tiene ninguno. */
export function getTierForCount(activeReferralCount: number): ReferralTier | null {
  if (activeReferralCount <= 0) return null
  const match = REFERRAL_TIERS.find(
    (t) => activeReferralCount >= t.min && (t.max === null || activeReferralCount <= t.max),
  )
  return match ?? REFERRAL_TIERS[REFERRAL_TIERS.length - 1]
}
