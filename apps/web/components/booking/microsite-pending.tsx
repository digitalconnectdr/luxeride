// ── Página "en preparación" para empresas que existen pero no están activas
// (trial/suspendida/cancelada). Antes esto devolvía un 404 genérico y sin
// contexto; ahora explica la situación sin exponer detalles sensibles de la
// cuenta (mismo mensaje para cualquier estado no-activo).

interface Props {
  companyName: string
  logoUrl: string | null
  brandColor: string | null
  phone: string | null
  email: string | null
  t: { pendingTitle: string; pendingBody: string; pendingContact: string; call: string }
}

export function MicrositePending({ companyName, logoUrl, brandColor, phone, email, t }: Props) {
  const accent = brandColor || '#c9a24b'
  return (
    <div className="min-h-screen bg-[#f6f3ec] text-[#1d1b18] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={companyName} className="h-14 w-14 mx-auto rounded-xl object-contain bg-white ring-1 ring-black/5 p-2" />
        ) : (
          <span className="h-14 w-14 mx-auto rounded-xl flex items-center justify-center font-playfair text-xl font-medium text-white" style={{ backgroundColor: accent }}>
            {companyName.charAt(0)}
          </span>
        )}
        <p className="mt-5 font-playfair text-lg font-medium">{companyName}</p>
        <span className="block h-px w-12 mx-auto my-6" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <h1 className="font-playfair text-2xl sm:text-3xl font-medium tracking-[-0.01em]">{t.pendingTitle}</h1>
        <p className="mt-4 text-[#5b554b] leading-relaxed">
          {t.pendingBody.replace('{company}', companyName)}
        </p>
        {(phone || email) && (
          <div className="mt-8 pt-6 border-t border-black/[0.08]">
            <p className="text-sm text-[#9a948a] mb-3">{t.pendingContact}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              {phone && <a href={`tel:${phone}`} className="font-medium hover:opacity-70 transition-opacity" style={{ color: accent }}>{t.call}: {phone}</a>}
              {email && <a href={`mailto:${email}`} className="font-medium hover:opacity-70 transition-opacity" style={{ color: accent }}>{email}</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
