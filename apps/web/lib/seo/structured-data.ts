// ── Datos estructurados JSON-LD del landing ────────────────────────────────
// Organization + SoftwareApplication (con ofertas por plan) + FAQPage.
// Objetivo: SEO tradicional (rich results) + AEO/GEO (que los motores de
// respuesta e IA generativas puedan citar precios/features/FAQ con precisión
// en vez de tener que inferirlos del HTML visual).

import { brand } from '@/lib/brand'

interface PlanForSchema {
  name: string
  price: string
  desc: string
  features: string[]
}

interface FaqForSchema {
  q: string
  a: string
}

function parsePrice(price: string): number | null {
  const match = price.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

export function buildLandingStructuredData(params: {
  baseUrl: string
  description: string
  plans: PlanForSchema[]
  faq: FaqForSchema[]
}) {
  const { baseUrl, description, plans, faq } = params

  const offers = plans
    .map((plan) => {
      const price = parsePrice(plan.price)
      // Precio "a medida" (Enterprise): antes se descartaba el plan entero del
      // array de offers, dejándolo invisible para buscadores y LLMs que leen
      // este JSON-LD — ahora se mantiene, sin price numérico.
      return {
        '@type': 'Offer',
        name: plan.name,
        priceCurrency: 'USD',
        ...(price !== null
          ? { price: price.toFixed(2) }
          : { priceSpecification: { '@type': 'PriceSpecification', description: plan.price } }),
        description: [plan.desc, ...plan.features].join('. '),
        url: `${baseUrl}/#pricing`,
      }
    })
    .filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: brand.name,
        url: baseUrl,
        logo: `${baseUrl}/icon.svg`,
        parentOrganization: {
          '@type': 'Organization',
          name: brand.poweredBy,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${baseUrl}/#software`,
        name: brand.name,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Ground Transportation Dispatch Software',
        operatingSystem: 'Web',
        description,
        url: baseUrl,
        offers,
        provider: { '@id': `${baseUrl}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${baseUrl}/#faq`,
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      },
    ],
  }
}
