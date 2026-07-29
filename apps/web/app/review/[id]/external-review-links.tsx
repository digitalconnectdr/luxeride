// ── Paso a Google / TripAdvisor tras calificar ────────────────────────────────
// Ninguna de las dos plataformas permite publicar una reseña por API: solo
// leerlas y responderlas. La única vía permitida es llevar a la persona al
// formulario para que la escriba ella.
//
// DOS REGLAS que este componente respeta, y que NO son opcionales:
//
//   1. Se muestra a TODO el que califica, den 5 estrellas o 1. Filtrar por
//      nota (mandar solo a los contentos) es "review gating", prohibido por
//      Google desde la política de febrero 2026, y castigado con eliminación
//      de reseñas, penalización del listado o suspensión de la cuenta.
//   2. No se ofrece NADA a cambio. Incentivar reseñas también está prohibido.
//      Por eso las recompensas automáticas (lib/rewards/engine.ts) no tienen
//      disparador por puntuación.

import { Star } from 'lucide-react'

interface Props {
  googlePlaceId: string | null
  tripadvisorUrl: string | null
  brandColor: string
  labels: {
    title: string
    body: string
    google: string
    tripadvisor: string
  }
}

export function ExternalReviewLinks({ googlePlaceId, tripadvisorUrl, brandColor, labels }: Props) {
  // Si el operador no configuró ninguna, no se muestra el bloque.
  if (!googlePlaceId && !tripadvisorUrl) return null

  // Deep link oficial al formulario de reseña de Google.
  const googleUrl = googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(googlePlaceId)}`
    : null

  const linkCls =
    'flex items-center justify-center gap-2 w-full rounded-xl border border-white/12 bg-white/[0.04] ' +
    'px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.08]'

  return (
    <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
      <div className="text-center">
        <p className="text-sm font-medium text-white/85">{labels.title}</p>
        <p className="mt-1 text-xs text-white/45 leading-relaxed">{labels.body}</p>
      </div>

      <div className="space-y-2">
        {googleUrl && (
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            <Star size={15} strokeWidth={2} style={{ color: brandColor }} />
            {labels.google}
          </a>
        )}
        {tripadvisorUrl && (
          <a href={tripadvisorUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            <Star size={15} strokeWidth={2} style={{ color: brandColor }} />
            {labels.tripadvisor}
          </a>
        )}
      </div>
    </div>
  )
}
