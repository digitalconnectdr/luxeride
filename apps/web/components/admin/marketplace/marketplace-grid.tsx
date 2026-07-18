'use client'
// ── Tienda de servicios adicionales — grid + modal de detalle/compra ──────────
// Mismo patrón de modal que EnterpriseLeadModal (createPortal a document.body,
// overlay + panel centrado). Los datos ya vienen resueltos desde el servidor
// (lib/billing/catalog.ts + dict.admin.marketplace) — este componente solo
// presenta y maneja el estado de qué tarjeta está abierta y qué tier elegido.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  Wallet,
  FileSignature,
  Percent,
  Bot,
  TrendingUp,
  Handshake,
  Check,
  type LucideIcon,
} from 'lucide-react'
import type { MarketplaceItemKey } from '@/lib/billing/catalog'
import type { Dictionary } from '@/lib/i18n/server'

const ICONS: Record<MarketplaceItemKey, LucideIcon> = {
  driver_payroll: Wallet,
  esignature: FileSignature,
  promo_codes: Percent,
  ai_chat: Bot,
  ai_growth: TrendingUp,
  affiliate_network: Handshake,
}

export interface MarketplaceTierData {
  addonKey: string
  tierLabel: '' | 'basic' | 'plus'
  tierName?: string
  price: number
  quota?: number
  checkoutUrl?: string
  bestFor?: string
}

export interface MarketplaceCardData {
  key: MarketplaceItemKey
  route: string
  isActive: boolean
  includedInElitePlan: boolean
  hasFixedPrice: boolean
  name: string
  shortDesc: string
  features: string[]
  usage: string
  quotaUnit?: string
  perUnitNoun?: string
  tiers: MarketplaceTierData[] | null
}

/** Interpreta **negrita** en texto de dict estatico (no HTML, sin dangerouslySetInnerHTML). */
function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-sl-on-surface">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function StatusBadge({ active, t }: { active: boolean; t: T }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-600 text-white">
        <Check size={10} strokeWidth={3} />
        {t.activeBadge}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
      <span className="relative flex h-1.5 w-1.5">
        <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
      </span>
      {t.availableBadge}
    </span>
  )
}

/** Costo por unidad (precio / cuota) redondeado a centavos, para comparar tiers. */
function unitCost(tier: MarketplaceTierData): number | null {
  if (!tier.quota) return null
  return tier.price / tier.quota
}

type T = Dictionary['admin']['marketplace']

function priceLabel(card: MarketplaceCardData, t: T): string | null {
  if (!card.hasFixedPrice || !card.tiers || card.tiers.length === 0) return null
  if (card.tiers.length === 1) return `$${card.tiers[0].price}${t.perMonth}`
  const min = Math.min(...card.tiers.map((tier) => tier.price))
  return `${t.startingAt} $${min}${t.perMonth}`
}

export function MarketplaceGrid({
  cards,
  t,
  companyEmail,
}: {
  cards: MarketplaceCardData[]
  t: T
  companyEmail?: string | null
}) {
  const [selectedKey, setSelectedKey] = useState<MarketplaceItemKey | null>(null)
  const [tierIdx, setTierIdx] = useState(0)
  const selected = cards.find((c) => c.key === selectedKey) ?? null

  useEffect(() => {
    if (!selected) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedKey(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  function openCard(key: MarketplaceItemKey) {
    setSelectedKey(key)
    setTierIdx(0)
  }

  const selectedTier = selected?.tiers?.[tierIdx] ?? null

  const bestValueIdx = (() => {
    const tiers = selected?.tiers
    if (!tiers || tiers.length < 2) return -1
    let best = -1
    let bestCost = Infinity
    tiers.forEach((tier, i) => {
      const cost = unitCost(tier)
      if (cost != null && cost < bestCost) {
        bestCost = cost
        best = i
      }
    })
    return best
  })()
  const selectedUnitCost = selectedTier ? unitCost(selectedTier) : null

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = ICONS[card.key]
          const price = priceLabel(card, t)
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => openCard(card.key)}
              className="text-left bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3 hover:border-bronze/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-11 h-11 rounded-full bg-sl-bg flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-bronze" strokeWidth={1.75} />
                </div>
                <StatusBadge active={card.isActive} t={t} />
              </div>
              <div>
                <p className="font-playfair text-lg font-semibold text-sl-on-surface">{card.name}</p>
                <p className="text-sm text-sl-on-surface-muted mt-1">{card.shortDesc}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-sl-on-surface">{price ?? '—'}</span>
                <span className="text-xs font-medium text-bronze">{t.viewDetails} →</span>
              </div>
            </button>
          )
        })}
      </div>

      {selected && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedKey(null)} />
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-sl-outline-variant p-6">
            {(() => {
              const Icon = ICONS[selected.key]
              return (
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-sl-bg flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-bronze" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-playfair text-xl font-semibold text-sl-on-surface">{selected.name}</h3>
                      <StatusBadge active={selected.isActive} t={t} />
                    </div>
                    <p className="text-sm text-sl-on-surface-muted mt-1">{selected.shortDesc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(null)}
                    aria-label={t.close}
                    className="shrink-0 leading-none text-xl text-sl-on-surface-muted hover:text-sl-on-surface transition-colors"
                  >
                    ×
                  </button>
                </div>
              )
            })()}

            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
                {t.featuresTitle}
              </p>
              <ul className="space-y-1.5">
                {selected.features.map((f) => (
                  <li key={f} className="text-sm text-sl-on-surface flex items-start gap-2">
                    <Check size={14} className="text-bronze shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
                {t.usageTitle}
              </p>
              <p className="text-sm text-sl-on-surface-muted">{renderRichText(selected.usage)}</p>
            </div>

            {selected.hasFixedPrice && selected.tiers && selected.tiers.length > 1 && (
              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
                  {t.choosePlan}
                </p>
                <div className="flex gap-2 bg-sl-bg border border-sl-outline-variant rounded-full p-1.5 w-fit">
                  {selected.tiers.map((tier, idx) => (
                    <button
                      key={tier.addonKey}
                      type="button"
                      onClick={() => setTierIdx(idx)}
                      className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        idx === tierIdx ? 'bg-gold text-gray-900 shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
                      }`}
                    >
                      {tier.tierName ?? tier.tierLabel}
                      {idx === bestValueIdx && (
                        <span className="absolute -top-2 -right-1.5 text-[8px] font-bold uppercase tracking-wide px-1.5 py-[1px] rounded-full bg-bronze text-white shadow-sm">
                          {t.bestValueLabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedTier?.bestFor && (
                  <p className="text-xs text-sl-on-surface-muted mt-3 italic">{selectedTier.bestFor}</p>
                )}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-sl-outline-variant">
              {selected.includedInElitePlan && (
                <p className="text-xs text-sl-on-surface-muted mb-3">{t.includedInElite}</p>
              )}

              {!selected.hasFixedPrice ? (
                selectedTier?.checkoutUrl ? (
                  <BuyAction checkoutUrl={selectedTier.checkoutUrl} companyEmail={companyEmail} t={t} />
                ) : (
                  <ContactSupport t={t} />
                )
              ) : selectedTier ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-playfair font-semibold text-sl-on-surface">
                      ${selectedTier.price}
                      <span className="text-sm font-sans font-normal text-sl-on-surface-muted">{t.perMonth}</span>
                    </span>
                    {selectedTier.quota != null && selected.quotaUnit && (
                      <span className="text-xs text-sl-on-surface-muted">
                        · {selectedTier.quota} {selected.quotaUnit}
                      </span>
                    )}
                  </div>
                  {selectedUnitCost != null && selected.perUnitNoun && (
                    <p className="text-xs text-sl-on-surface-muted">
                      ${selectedUnitCost.toFixed(2)} {selected.perUnitNoun}
                    </p>
                  )}
                  {selected.isActive ? (
                    <Link
                      href={selected.route}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-gray-900 text-sm font-semibold rounded-xl hover:bg-gold/90 shadow-sm transition-colors"
                    >
                      {t.goToFeature.replace('{feature}', selected.name)}
                    </Link>
                  ) : selectedTier.checkoutUrl ? (
                    <BuyAction checkoutUrl={selectedTier.checkoutUrl} companyEmail={companyEmail} t={t} />
                  ) : (
                    <ContactSupport t={t} />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function BuyAction({ checkoutUrl, companyEmail, t }: { checkoutUrl: string; companyEmail?: string | null; t: T }) {
  return (
    <div className="space-y-2">
      <a
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-gray-900 text-sm font-semibold rounded-xl hover:bg-gold/90 shadow-sm transition-colors"
      >
        {t.buyButton}
      </a>
      {companyEmail ? (
        <p className="text-xs text-sl-on-surface-muted">{t.emailHint.replace('{email}', companyEmail)}</p>
      ) : (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t.emailMissing}
        </p>
      )}
    </div>
  )
}

function ContactSupport({ t }: { t: T }) {
  return (
    <div className="bg-sl-bg border border-sl-outline-variant rounded-lg px-4 py-3">
      <p className="text-sm font-medium text-sl-on-surface">{t.contactSupportTitle}</p>
      <p className="text-xs text-sl-on-surface-muted mt-0.5">{t.contactSupportBody}</p>
    </div>
  )
}
