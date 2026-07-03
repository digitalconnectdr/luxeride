import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { verifyWhopSignature, mapWhopPlanId, parseWhopEvent, isWhopSuccessEvent } from './whop'

const SECRET = 'test-secret'

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex')
}

describe('verifyWhopSignature', () => {
  it('acepta una firma válida (header plano)', () => {
    const body = '{"type":"payment.succeeded"}'
    expect(verifyWhopSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('acepta una firma válida con prefijo "sha256="', () => {
    const body = '{"type":"payment.succeeded"}'
    expect(verifyWhopSignature(body, `sha256=${sign(body)}`, SECRET)).toBe(true)
  })

  it('rechaza una firma inválida', () => {
    const body = '{"type":"payment.succeeded"}'
    expect(verifyWhopSignature(body, 'deadbeef', SECRET)).toBe(false)
  })

  it('rechaza si no hay header', () => {
    expect(verifyWhopSignature('{}', null, SECRET)).toBe(false)
  })

  it('rechaza si el body fue alterado', () => {
    const original = '{"type":"payment.succeeded","amount":10}'
    const tampered = '{"type":"payment.succeeded","amount":9999}'
    expect(verifyWhopSignature(tampered, sign(original), SECRET)).toBe(false)
  })
})

describe('mapWhopPlanId', () => {
  beforeAll(() => {
    process.env.WHOP_PLAN_ID_STARTER = 'plan_starter'
    process.env.WHOP_PLAN_ID_PROFESSIONAL = 'plan_pro'
    process.env.WHOP_PLAN_ID_ENTERPRISE = 'plan_ent'
  })

  it('mapea starter/professional/enterprise correctamente', () => {
    expect(mapWhopPlanId('plan_starter')).toBe('starter')
    expect(mapWhopPlanId('plan_pro')).toBe('professional')
    expect(mapWhopPlanId('plan_ent')).toBe('enterprise')
  })

  it('devuelve undefined si no coincide con ningún plan configurado', () => {
    expect(mapWhopPlanId('plan_desconocido')).toBeUndefined()
  })

  it('devuelve undefined si no se pasa planId', () => {
    expect(mapWhopPlanId(null)).toBeUndefined()
  })
})

describe('parseWhopEvent', () => {
  it('extrae type/email/planId/membershipId de la forma más común (data.*)', () => {
    const body = {
      type: 'payment.succeeded',
      data: { id: 'mem_123', email: 'owner@empresa.com', plan_id: 'plan_starter' },
    }
    expect(parseWhopEvent(body)).toEqual({
      type: 'payment.succeeded',
      email: 'owner@empresa.com',
      planId: 'plan_starter',
      membershipId: 'mem_123',
    })
  })

  it('prueba rutas alternativas de email (data.user.email)', () => {
    const body = { type: 'membership.went_valid', data: { user: { email: 'a@b.com' } } }
    expect(parseWhopEvent(body).email).toBe('a@b.com')
  })

  it('devuelve null en los campos ausentes en vez de lanzar', () => {
    expect(parseWhopEvent({})).toEqual({ type: 'unknown', email: null, planId: null, membershipId: null })
  })
})

describe('isWhopSuccessEvent', () => {
  it('reconoce eventos de pago/membresía exitosa', () => {
    expect(isWhopSuccessEvent('payment.succeeded')).toBe(true)
    expect(isWhopSuccessEvent('membership.went_valid')).toBe(true)
  })

  it('ignora eventos no relacionados', () => {
    expect(isWhopSuccessEvent('membership.went_invalid')).toBe(false)
    expect(isWhopSuccessEvent('unknown')).toBe(false)
  })
})
