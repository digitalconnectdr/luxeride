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

// El endpoint /download de Unsplash devuelve un 302 (redirect), no la imagen -
// el optimizador de imágenes de Next.js no sigue redirecciones, así que estas
// 23 fotos se mostraban rotas en producción en cualquier micrositio sin foto
// propia por servicio. U() ahora recibe directo el ID final estable de
// images.unsplash.com (verificado con petición HTTP real, 200 + image/jpeg,
// antes de reemplazar cada URL).
const U = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=1600`

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
    url: U('1764269712383-0a3bb68e5ae5'), // Novia subiendo a una limusina blanca elegante
  },
  {
    // Traslados al aeropuerto / Airport transfers
    keywords: ['aeropuerto', 'airport', 'aeroporto', 'vuelo', 'flight', 'voo'],
    url: U('1633433490429-e9c2d1f6a94f'), // Jet en la pista del aeropuerto
  },
  {
    // Corporativo / Corporate / Executivo
    keywords: ['corporativo', 'corporate', 'negocio', 'negocios', 'business', 'empresa', 'executiv', 'ejecutiv'],
    url: U('1769787301187-0fab290ba2f2'), // Hombre de traje junto a SUVs negras en un estacionamiento
  },
  {
    // Chofer por horas / Hourly chauffeur / disposición
    keywords: ['hora', 'horas', 'hourly', 'disposal', 'disposición', 'chofer', 'chauffeur', 'motorista'],
    url: U('1780296269675-169390638617'), // Sedán Mercedes-Benz negro de lujo, entorno urbano
  },
  {
    // Tours / paseos por la ciudad
    keywords: ['tour', 'paseo', 'passeio', 'sightsee', 'excursion', 'excursión'],
    url: U('1691084322637-7bec63d04f79'), // Auto negro circulando entre edificios altos
  },
  {
    // Intermunicipal / larga distancia / ciudad a ciudad
    keywords: ['city-to-city', 'city to city', 'intercity', 'inter-city', 'long distance', 'long-distance', 'interurbano', 'larga distancia'],
    url: U('1616549972169-0a0d961c9905'), // Sedán Audi negro en carretera abierta
  },
  {
    // Puerto / crucero
    keywords: ['port', 'puerto', 'muelle', 'cruise', 'crucero', 'cruzeiro', 'dock'],
    url: U('1768099838425-f739da8678e0'), // Crucero atracado en un puerto costero
  },
]

// Pool genérico (sedanes/SUVs de lujo, distintos entre sí) — solo para
// servicios cuyo título no coincide con ninguna categoría. Rota por índice
// para que dos servicios "sin match" en la misma página no repitan foto.
// 16 fotos: cubre con margen a empresas con muchos servicios sin repetir.
const GENERIC_POOL = [
  U('1735620731955-b047a7122892'), // Cadillac negro estacionado
  U('1736572199225-e8dc0a233faf'), // SUV negra en un garaje
  U('1767749995458-b0927324e4d0'), // Cadillac Escalade negra estacionada
  U('1767749995450-7b63ab7cd4fd'), // Cadillac SUV negra estacionada
  U('1780296270302-625bbda9362e'), // Mercedes-Benz negro estacionado
  U('1771775751121-3091d79073d4'), // Limusina negra frente a una entrada elegante
  U('1779025313068-b4a11d86bf0d'), // Sedán Mercedes-Benz negro circulando
  U('1485291571150-772bcfc10da5'), // Sedán negro
  U('1610099610040-ab19f3a5ec35'), // BMW M3 negro estacionado en la calle
  U('1589148938909-4d241c91ee52'), // Mercedes-Benz Clase C negro estacionado
  U('1681167816895-940c56e0d2a5'), // Rolls-Royce negro frente a árboles
  U('1609521233053-345bfa8b6f17'), // Auto negro junto a una pared de ladrillo
  U('1710011115859-a8e9254f80d2'), // Auto negro frente a un edificio
  U('1665749771400-efc76a3fc5e9'), // Vehículo en un garaje
  U('1678305961875-14e14986e514'), // Automóvil oscuro junto a la carretera
  U('1778943242936-7e93c588ad77'), // SUV negra estacionada bajo árboles
]

export function resolveServiceFallbackImage(title: string, index: number): string {
  const t = title.toLowerCase()
  for (const category of CATEGORIES) {
    if (category.keywords.some((k) => t.includes(k))) return category.url
  }
  return GENERIC_POOL[index % GENERIC_POOL.length]
}
