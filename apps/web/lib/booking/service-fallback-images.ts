// ── Fotos de respaldo para servicios sin imagen propia ────────────────────────
// Antes: se elegía una foto de stock por POSICIÓN en un array (i % length),
// sin relación con el contenido real del servicio — por eso "Bodas y eventos"
// podía caer en una foto de una furgoneta en la nieve. Ahora se elige por
// COINCIDENCIA DE PALABRA CLAVE en el título del servicio (ES/EN/PT), y solo
// si nada coincide se usa un genérico de sedán ejecutivo negro — nunca un
// ícono ni una foto que no tenga que ver con lo que se vende. Todas las fotos
// verificadas contra su descripción real en Unsplash (no solo el nombre del
// archivo) antes de usarlas aquí.

const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`

interface Category {
  keywords: string[]
  url: string
}

const CATEGORIES: Category[] = [
  {
    // Bodas y eventos / Weddings and events / Casamentos e eventos
    keywords: ['boda', 'bodas', 'wedding', 'casamento', 'casamentos', 'quincea', 'evento', 'eventos', 'event'],
    url: U('d_wZcidBNl0'), // Novia subiendo a una limusina blanca elegante
  },
  {
    // Traslados al aeropuerto / Airport transfers
    keywords: ['aeropuerto', 'airport', 'aeroporto', 'vuelo', 'flight', 'voo'],
    url: U('hQrfHQQ3Nh8'), // Jet en la pista del aeropuerto
  },
  {
    // Corporativo / Corporate / Executivo
    keywords: ['corporativo', 'corporate', 'negocio', 'negocios', 'business', 'empresa', 'executiv', 'ejecutiv'],
    url: U('KDA9cnw8jZw'), // Hombre de traje junto a SUVs negras en un estacionamiento
  },
  {
    // Chofer por horas / Hourly chauffeur / disposición
    keywords: ['hora', 'horas', 'hourly', 'disposal', 'disposición', 'chofer', 'chauffeur', 'motorista'],
    url: U('pgWzo-bNUeM'), // Sedán Mercedes-Benz negro de lujo, entorno urbano
  },
  {
    // Tours / paseos por la ciudad
    keywords: ['tour', 'paseo', 'passeio', 'sightsee', 'city tour'],
    url: U('bVMv6f_2aEE'), // Auto negro circulando entre edificios altos
  },
]

// Genérico: sedán ejecutivo negro — solo si ninguna categoría coincide.
const DEFAULT_IMAGE = U('L5MoSNaOEcU')

export function resolveServiceFallbackImage(title: string): string {
  const t = title.toLowerCase()
  for (const category of CATEGORIES) {
    if (category.keywords.some((k) => t.includes(k))) return category.url
  }
  return DEFAULT_IMAGE
}
