import { describe, it, expect } from 'vitest'
import {
  computeResponseDeadline,
  isExpired,
  computeMargin,
  canAffiliateRespond,
  canOwnerCancel,
  nextOperationalStatus,
  resolveBrandingLabel,
} from './engine'

const NOW = new Date('2026-07-09T12:00:00Z')

describe('computeResponseDeadline', () => {
  it('viaje dentro de 24h → 10 minutos', () => {
    const scheduled = new Date(NOW.getTime() + 3 * 3_600_000)
    const deadline = computeResponseDeadline(scheduled, NOW)
    expect(deadline.getTime() - NOW.getTime()).toBe(10 * 60_000)
  })

  it('viaje entre 24h y 48h → 30 minutos', () => {
    const scheduled = new Date(NOW.getTime() + 30 * 3_600_000)
    const deadline = computeResponseDeadline(scheduled, NOW)
    expect(deadline.getTime() - NOW.getTime()).toBe(30 * 60_000)
  })

  it('viaje a más de 48h → 2 horas', () => {
    const scheduled = new Date(NOW.getTime() + 5 * 86_400_000)
    const deadline = computeResponseDeadline(scheduled, NOW)
    expect(deadline.getTime() - NOW.getTime()).toBe(120 * 60_000)
  })
})

describe('isExpired', () => {
  it('true si ya pasó la hora límite', () => {
    expect(isExpired(new Date(NOW.getTime() - 1000).toISOString(), NOW)).toBe(true)
  })
  it('false si todavía no llega', () => {
    expect(isExpired(new Date(NOW.getTime() + 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('computeMargin', () => {
  it('resta el payout y el fee de lo cobrado al pasajero', () => {
    expect(computeMargin({ passengerChargedAmount: 200, agreedPrice: 140, platformFeeAmount: 5 })).toBe(55)
  })
  it('puede dar negativo si se ofrece más de lo cobrado', () => {
    expect(computeMargin({ passengerChargedAmount: 100, agreedPrice: 130 })).toBe(-30)
  })
})

describe('canAffiliateRespond', () => {
  it('true si está requested/countered y no expiró', () => {
    expect(canAffiliateRespond('requested', new Date(NOW.getTime() + 1000).toISOString(), NOW)).toBe(true)
  })
  it('false si ya expiró', () => {
    expect(canAffiliateRespond('requested', new Date(NOW.getTime() - 1000).toISOString(), NOW)).toBe(false)
  })
  it('false si ya fue aceptado', () => {
    expect(canAffiliateRespond('accepted', new Date(NOW.getTime() + 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('canOwnerCancel', () => {
  it('true mientras está pendiente de respuesta o recién aceptado', () => {
    expect(canOwnerCancel('requested')).toBe(true)
    expect(canOwnerCancel('accepted')).toBe(true)
  })
  it('false una vez que el viaje está en curso o cerrado', () => {
    expect(canOwnerCancel('in_progress')).toBe(false)
    expect(canOwnerCancel('completed')).toBe(false)
  })
})

describe('nextOperationalStatus', () => {
  it('avanza en orden hasta completed', () => {
    expect(nextOperationalStatus('accepted')).toBe('en_route')
    expect(nextOperationalStatus('en_route')).toBe('arrived')
    expect(nextOperationalStatus('arrived')).toBe('in_progress')
    expect(nextOperationalStatus('in_progress')).toBe('completed')
  })
  it('null después de completed o en estados no operativos', () => {
    expect(nextOperationalStatus('completed')).toBeNull()
    expect(nextOperationalStatus('requested')).toBeNull()
  })
})

describe('resolveBrandingLabel', () => {
  it('white_label no muestra nada', () => {
    expect(resolveBrandingLabel('white_label', 'Revival', 'Afiliado X').operatedByLine).toBeNull()
  })
  it('operated_by muestra solo el afiliado', () => {
    expect(resolveBrandingLabel('operated_by', 'Revival', 'Afiliado X').operatedByLine).toBe('Afiliado X')
  })
  it('co_branded muestra ambas marcas', () => {
    expect(resolveBrandingLabel('co_branded', 'Revival', 'Afiliado X').operatedByLine).toBe('Revival · Afiliado X')
  })
})
