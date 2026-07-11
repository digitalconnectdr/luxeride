// ── Tarjeta genérica de upsell para un add-on de pago ──────────────────────────
// Versión simplificada del patrón de AffiliateNetworkUpsell (sin fallback de
// formulario de "solicitar acceso" — para estos 3 add-ons nuevos, el precio ya
// está decidido, así que solo se necesita el link de checkout de Whop cuando
// exista, o un aviso cuando el operador todavía no lo configuró).

export function AddonUpsellCard({
  title,
  body,
  price,
  checkoutUrl,
  companyEmail,
}: {
  title: string
  body: string
  price: number
  checkoutUrl?: string
  companyEmail?: string | null
}) {
  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-3 max-w-lg">
      <p className="font-playfair text-lg font-semibold text-sl-on-surface">{title}</p>
      <p className="text-sm text-sl-on-surface-muted">{body}</p>
      <p className="text-2xl font-bold text-sl-on-surface">
        ${price}
        <span className="text-sm font-normal text-sl-on-surface-muted">/mes</span>
      </p>

      {checkoutUrl ? (
        <div className="space-y-2">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-4 py-2 bg-bronze text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Activar por ${price}/mes →
          </a>
          {companyEmail ? (
            <p className="text-xs text-sl-on-surface-muted">
              Usa el email de tu cuenta ({companyEmail}) al pagar en Whop, para que se active automáticamente.
            </p>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Agrega un email a tu empresa en Configuración antes de activar este add-on.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-sl-on-surface-muted bg-sl-surface border border-sl-outline-variant rounded-lg px-3 py-2">
          Este add-on todavía no está disponible para autoservicio. Contacta soporte para activarlo.
        </p>
      )}
    </div>
  )
}
