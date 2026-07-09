import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { verifyWhopSignature, mapWhopPlanId, parseWhopEvent, isWhopSuccessEvent, isWhopDeactivationEvent, isAffiliateAddonPlan } from './whop'

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
  it('extrae type/eventId/email/planId/membershipId de la forma más común (data.*)', () => {
    const body = {
      id: 'evt_999',
      type: 'membership_activated',
      data: { id: 'mem_123', email: 'owner@empresa.com', plan_id: 'plan_starter' },
    }
    expect(parseWhopEvent(body)).toEqual({
      type: 'membership_activated',
      eventId: 'evt_999',
      email: 'owner@empresa.com',
      planId: 'plan_starter',
      membershipId: 'mem_123',
    })
  })

  it('prueba rutas alternativas de email (data.user.email)', () => {
    const body = { type: 'membership_activated', data: { user: { email: 'a@b.com' } } }
    expect(parseWhopEvent(body).email).toBe('a@b.com')
  })

  it('un upgrade/downgrade conserva el mismo membershipId pero es un eventId distinto', () => {
    const original = { id: 'evt_1', type: 'membership_activated', data: { id: 'mem_123', email: 'a@b.com', plan_id: 'plan_starter' } }
    const upgrade = { id: 'evt_2', type: 'membership_activated', data: { id: 'mem_123', email: 'a@b.com', plan_id: 'plan_pro' } }
    const parsedOriginal = parseWhopEvent(original)
    const parsedUpgrade = parseWhopEvent(upgrade)
    expect(parsedUpgrade.membershipId).toBe(parsedOriginal.membershipId)
    expect(parsedUpgrade.eventId).not.toBe(parsedOriginal.eventId)
    expect(parsedUpgrade.planId).not.toBe(parsedOriginal.planId)
  })

  it('devuelve null en los campos ausentes en vez de lanzar', () => {
    expect(parseWhopEvent({})).toEqual({ type: 'unknown', eventId: null, email: null, planId: null, membershipId: null })
  })
})

describe('isWhopSuccessEvent', () => {
  it('reconoce membership_activated (confirmado en el dashboard de Whop)', () => {
    expect(isWhopSuccessEvent('membership_activated')).toBe(true)
  })

  it('ignora eventos no relacionados', () => {
    expect(isWhopSuccessEvent('membership_deactivated')).toBe(false)
    expect(isWhopSuccessEvent('unknown')).toBe(false)
  })
})

describe('isWhopDeactivationEvent', () => {
  it('reconoce membership_deactivated', () => {
    expect(isWhopDeactivationEvent('membership_deactivated')).toBe(true)
  })

  it('ignora eventos no relacionados', () => {
    expect(isWhopDeactivationEvent('membership_activated')).toBe(false)
    expect(isWhopDeactivationEvent('unknown')).toBe(false)
  })
})

describe('isAffiliateAddonPlan', () => {
  beforeAll(() => {
    process.env.WHOP_PLAN_ID_AFFILIATE_ADDON = 'plan_affiliate_addon'
  })

  it('reconoce el plan del add-on cuando está configurado', () => {
    expect(isAffiliateAddonPlan('plan_affiliate_addon')).toBe(true)
  })

  it('no confunde el add-on con un plan principal', () => {
    expect(isAffiliateAddonPlan('plan_starter')).toBe(false)
  })

  it('devuelve false si no se pasa planId', () => {
    expect(isAffiliateAddonPlan(null)).toBe(false)
  })

  it('devuelve false si la env var no está configurada', () => {
    delete process.env.WHOP_PLAN_ID_AFFILIATE_ADDON
    expect(isAffiliateAddonPlan('plan_affiliate_addon')).toBe(false)
  })
})
