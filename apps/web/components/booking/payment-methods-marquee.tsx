// ── Cinta de formas de pago — señal de confianza antes de reservar ────────────
// Reemplaza el badge estático que vivía en el footer (components/booking/
// payment-methods-badges.tsx, ahora retirado): una franja horizontal con
// desplazamiento lateral lento y continuo, ubicada justo después de la
// sección "Reserva tu viaje" + QR en el micrositio, y después de los planes
// en el landing. Los íconos son genéricos (no reproducen logos de Apple/
// Google/Zelle) — el nombre de marca va en el texto, el ícono solo ilustra
// el concepto (contactless / billete / transferencia).

interface PaymentMethodsDict {
  paymentMethodsTitle: string
  paymentMethodsTagline: string
  paymentCard: string
  paymentApplePay: string
  paymentGooglePay: string
  paymentCash: string
  paymentZelle: string
  paymentTransfer: string
}

interface Props {
  acceptsCardOnline: boolean
  t: PaymentMethodsDict
  tone?: 'dark' | 'light'
  brandColor?: string
}

const CardIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
)

// Símbolo genérico de "contactless" (el mismo que aparece en los datáfonos de
// cualquier marca) — representa el pago vía wallet (Apple Pay / Google Pay)
// sin reproducir el logo de ninguna de las dos.
const ContactlessIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
    <path d="M6 8.5a6.2 6.2 0 0 1 0 7" />
    <path d="M9.7 6.2a10 10 0 0 1 0 11.6" />
    <path d="M13.4 4a13.9 13.9 0 0 1 0 16" />
  </svg>
)

const CashIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

// Flechas de intercambio bidireccional — transferencia instantánea (Zelle).
const ExchangeIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 7h13" /><path d="M15 3l4 4-4 4" />
    <path d="M18 17H5" /><path d="M9 21l-4-4 4-4" />
  </svg>
)

const BankIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v8" /><path d="M19 10v8" /><path d="M9.5 10v8" /><path d="M14.5 10v8" />
    <line x1="3" y1="20" x2="21" y2="20" />
  </svg>
)

export function PaymentMethodsMarquee({ acceptsCardOnline, t, tone = 'dark', brandColor }: Props) {
  const methods = [
    ...(acceptsCardOnline
      ? [
          { key: 'card', icon: CardIcon, label: t.paymentCard },
          { key: 'apple', icon: ContactlessIcon, label: t.paymentApplePay },
          { key: 'google', icon: ContactlessIcon, label: t.paymentGooglePay },
        ]
      : []),
    { key: 'cash', icon: CashIcon, label: t.paymentCash },
    { key: 'zelle', icon: ExchangeIcon, label: t.paymentZelle },
    { key: 'transfer', icon: BankIcon, label: t.paymentTransfer },
  ]

  const kickerCls = tone === 'dark' ? 'text-white/45' : 'text-[#9a948a]'
  const taglineCls = tone === 'dark' ? 'text-white/70' : 'text-[#42484f]'
  const pillCls =
    tone === 'dark'
      ? 'border-white/12 bg-white/[0.03] text-white/85'
      : 'border-black/[0.08] bg-black/[0.015] text-[#2a2e33]'
  const edgeFrom = tone === 'dark' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)'

  return (
    <div>
      <div className="text-center mb-10">
        <p className={`text-[11px] uppercase tracking-[0.3em] mb-3 ${kickerCls}`}>{t.paymentMethodsTitle}</p>
        <p className={`text-base sm:text-lg font-medium max-w-md mx-auto ${taglineCls}`}>{t.paymentMethodsTagline}</p>
      </div>

      <div
        className="lux-marquee-group relative overflow-hidden"
        style={{
          maskImage: `linear-gradient(90deg, transparent, ${edgeFrom} 8%, ${edgeFrom} 92%, transparent)`,
          WebkitMaskImage: `linear-gradient(90deg, transparent, ${edgeFrom} 8%, ${edgeFrom} 92%, transparent)`,
        }}
      >
        <div className="lux-marquee-track flex w-max items-center gap-4">
          {[...methods, ...methods].map((m, i) => (
            <span
              key={`${m.key}-${i}`}
              className={`inline-flex shrink-0 items-center gap-2.5 rounded-full border px-5 py-3 text-sm font-medium ${pillCls}`}
            >
              <span style={brandColor ? { color: brandColor } : undefined}>{m.icon}</span>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
