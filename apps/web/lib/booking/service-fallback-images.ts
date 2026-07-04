// ── Fotos de respaldo para servicios sin imagen propia ────────────────────────
// Antes: se elegía una foto de stock por POSICIÓN en un array (i % length),
// sin relación con el contenido real del servicio — por eso "Bodas y eventos"
// podía caer en una foto de una furgoneta en la nieve. Ahora se elige por
// COINCIDENCIA DE PALABRA CLAVE en el título del servicio (ES/EN/PT). Si el
// título no coincide con ninguna categoría conocida (nombres reales varían
// mucho: "City-to-City Transportation", "In-City Rides", "Port Transfers"...),
// cae a un POOL de fotos genéricas de sedán de lujo que ROTA por índice — así
// varios servicios sin categoría reconocida en la misma página nunca repiten
// la misma foto (antes: los 3 sin match mostraban literalmente la misma
// imagen). Todas las fotos verificadas con una petición HTTP real contra el
// endpoint de descarga de Unsplash (no solo su descripción de búsqueda) antes
// de usarlas aquí — dos elegidas solo por descripción resultaron rotas
// (404/403) en una pasada anterior.

const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`

interface Category {
  keywords: string[]
  url: string
}

const CATEGORIES: Category[] = [
  {
    // Bodas, eventos, prom / Weddings, events, prom / Casamentos, eventos
    keywords: [
      'boda', 'bodas', 'wedding', 'casamento', 'casamentos', 'quincea', 'evento', 'eventos', 'event',
      'prom', 'graduacion', 'graduación', 'formatura',
    ],
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
    keywords: ['tour', 'paseo', 'passeio', 'sightsee', 'excursion', 'excursión'],
    url: U('bVMv6f_2aEE'), // Auto negro circulando entre edificios altos
  },
  {
    // Intermunicipal / larga distancia / ciudad a ciudad
    keywords: ['city-to-city', 'city to city', 'intercity', 'inter-city', 'long distance', 'long-distance', 'interurbano', 'larga distancia'],
    url: U('a0SRjVsk7Jg'), // Sedán Audi negro en carretera abierta
  },
  {
    // Puerto / crucero
    keywords: ['port', 'puerto', 'muelle', 'cruise', 'crucero', 'cruzeiro', 'dock'],
    url: U('_SlOgSKro2I'), // Crucero atracado en un puerto costero
  },
]

// Pool genérico (sedanes/SUVs de lujo, distintos entre sí) — solo para
// servicios cuyo título no coincide con ninguna categoría. Rota por índice
// para que dos servicios "sin match" en la misma página no repitan foto.
// 16 fotos: cubre con margen a empresas con muchos servicios sin repetir.
const GENERIC_POOL = [
  U('swH_BwdisfQ'), // Cadillac negro estacionado
  U('Wj4Ny_cMUrE'), // SUV negra en un garaje
  U('r73ofIPEfag'), // Cadillac Escalade negra estacionada
  U('j1p0gpG_yuA'), // Cadillac SUV negra estacionada
  U('OinkFJ4Ueg8'), // Mercedes-Benz negro estacionado
  U('xdYroKLD92U'), // Limusina negra frente a una entrada elegante
  U('L5MoSNaOEcU'), // Sedán Mercedes-Benz negro circulando
  U('FMbWFDiVRPs'), // Sedán negro
  U('y3neNkE6efI'), // BMW M3 negro estacionado en la calle
  U('PKdQIG4goQc'), // Mercedes-Benz Clase C negro estacionado
  U('hFA1GbXWb_8'), // Rolls-Royce negro frente a árboles
  U('gmpU5NBYISQ'), // Auto negro junto a una pared de ladrillo
  U('6PMsXs0heLo'), // Auto negro frente a un edificio
  U('aiTB7gO4s2g'), // Vehículo en un garaje
  U('nM6DOKLZkHc'), // Automóvil oscuro junto a la carretera
  U('eig1_P6XW9Q'), // SUV negra estacionada bajo árboles
]

export function resolveServiceFallbackImage(title: string, index: number): string {
  const t = title.toLowerCase()
  for (const category of CATEGORIES) {
    if (category.keywords.some((k) => t.includes(k))) return category.url
  }
  return GENERIC_POOL[index % GENERIC_POOL.length]
}
