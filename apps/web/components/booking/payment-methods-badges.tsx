interface PaymentMethodsDict {
  paymentMethodsTitle: string
  paymentCard: string
  paymentCash: string
  paymentZelle: string
  paymentTransfer: string
}

interface Props {
  acceptsCardOnline: boolean
  t: PaymentMethodsDict
  tone?: 'dark' | 'light'
}

// Insignias de "formas de pago" del micrositio — tarjeta solo si la empresa
// tiene Whop Connect onboarded; efectivo/Zelle/transferencia siempre están
// disponibles (registro manual por reservación, sin gate de configuración).
export function PaymentMethodsBadges({ acceptsCardOnline, t, tone = 'dark' }: Props) {
  const methods = [
    ...(acceptsCardOnline ? [t.paymentCard] : []),
    t.paymentCash,
    t.paymentZelle,
    t.paymentTransfer,
  ]
  const badgeCls = tone === 'dark' ? 'border-white/15 text-white/70' : 'border-black/10 text-[#42484f]'
  const titleCls = tone === 'dark' ? 'text-white/40' : 'text-[#9ca3af]'

  return (
    <div>
      <h4 className={`text-[11px] uppercase tracking-[0.28em] mb-3 ${titleCls}`}>{t.paymentMethodsTitle}</h4>
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <span key={m} className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${badgeCls}`}>
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}
