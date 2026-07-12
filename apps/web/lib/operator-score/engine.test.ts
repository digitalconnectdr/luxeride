import { describe, expect, it } from 'vitest'
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
} from './engine'

describe('scoreComplianceReadiness', () => {
  it('pasa directo el compliance_score ya existente', () => {
    expect(scoreComplianceReadiness(85)).toBe(85)
  })
  it('null si no hay dato', () => {
    expect(scoreComplianceReadiness(null)).toBeNull()
  })
})

describe('scoreAffiliateReliability', () => {
  it('promedia respuesta y puntualidad', () => {
    expect(scoreAffiliateReliability({ responseRatePct: 80, punctualityPct: 60 })).toBe(70)
  })
  it('null si no hay actividad de afiliados (nunca penaliza)', () => {
    expect(scoreAffiliateReliability({ responseRatePct: null, punctualityPct: null })).toBeNull()
  })
})

describe('scoreChauffeurQuality', () => {
  it('combina puntualidad, (100-cancelacion) y rating normalizado', () => {
    // puntualidad 90, cancelacion 10 -> 90, rating 5 -> 100 => promedio 93.3 -> 93
    expect(scoreChauffeurQuality({ punctualityPct: 90, cancellationPct: 10, avgRating: 5 })).toBe(93)
  })
  it('null si no hay ningun dato', () => {
    expect(scoreChauffeurQuality({ punctualityPct: null, cancellationPct: null, avgRating: null })).toBeNull()
  })
})

describe('scoreDispatchEfficiency', () => {
  it('porcentaje de despachos rapidos', () => {
    expect(scoreDispatchEfficiency({ dispatchedCount: 10, fastDispatchCount: 8 })).toBe(80)
  })
  it('null sin reservas despachadas', () => {
    expect(scoreDispatchEfficiency({ dispatchedCount: 0, fastDispatchCount: 0 })).toBeNull()
  })
})

describe('scoreCustomerExperience', () => {
  it('normaliza rating 1-5 a 0-100', () => {
    expect(scoreCustomerExperience(5)).toBe(100)
    expect(scoreCustomerExperience(1)).toBe(0)
    expect(scoreCustomerExperience(3)).toBe(50)
  })
  it('null sin calificaciones', () => {
    expect(scoreCustomerExperience(null)).toBeNull()
  })
})

describe('scoreRevenueHealth', () => {
  it('sin cambio (0%) da el neutral 70', () => {
    expect(scoreRevenueHealth({ currentPeriodRevenue: 1000, priorPeriodRevenue: 1000 })).toBe(70)
  })
  it('crecimiento sube el score, limitado a +30', () => {
    expect(scoreRevenueHealth({ currentPeriodRevenue: 2000, priorPeriodRevenue: 1000 })).toBe(100)
  })
  it('caida baja el score, limitado a -30', () => {
    expect(scoreRevenueHealth({ currentPeriodRevenue: 0, priorPeriodRevenue: 1000 })).toBe(40)
  })
  it('sin periodo anterior pero con actividad actual da neutral', () => {
    expect(scoreRevenueHealth({ currentPeriodRevenue: 500, priorPeriodRevenue: 0 })).toBe(70)
  })
  it('sin ninguna actividad da null', () => {
    expect(scoreRevenueHealth({ currentPeriodRevenue: 0, priorPeriodRevenue: 0 })).toBeNull()
  })
})

describe('scoreGrowthPerformance', () => {
  it('conversion cotizacion a reserva', () => {
    expect(scoreGrowthPerformance({ quotesCount: 20, bookingsCount: 10 })).toBe(50)
  })
  it('se limita a 100 aunque haya mas reservas que cotizaciones registradas', () => {
    expect(scoreGrowthPerformance({ quotesCount: 5, bookingsCount: 10 })).toBe(100)
  })
  it('null sin cotizaciones', () => {
    expect(scoreGrowthPerformance({ quotesCount: 0, bookingsCount: 0 })).toBeNull()
  })
})

describe('scoreCorporateAccountStrength', () => {
  it('porcentaje de facturas al dia', () => {
    expect(scoreCorporateAccountStrength({ totalInvoices: 10, overdueInvoices: 2 })).toBe(80)
  })
  it('null sin cuentas corporativas (nunca penaliza)', () => {
    expect(scoreCorporateAccountStrength({ totalInvoices: 0, overdueInvoices: 0 })).toBeNull()
  })
})

describe('computeOperatorScore', () => {
  it('promedia solo las areas con datos', () => {
    const result = computeOperatorScore({
      complianceReadiness: 80,
      affiliateReliability: null,
      chauffeurQuality: 90,
      dispatchEfficiency: null,
      customerExperience: 100,
      revenueHealth: null,
      growthPerformance: null,
      corporateAccountStrength: null,
    })
    expect(result.overall).toBe(90) // (80+90+100)/3
  })

  it('null si ninguna area tiene datos', () => {
    const result = computeOperatorScore({
      complianceReadiness: null,
      affiliateReliability: null,
      chauffeurQuality: null,
      dispatchEfficiency: null,
      customerExperience: null,
      revenueHealth: null,
      growthPerformance: null,
      corporateAccountStrength: null,
    })
    expect(result.overall).toBeNull()
  })
})
