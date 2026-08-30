// ── Países soportados ───────────────────────────────────────────────────────
// Extraído de app/admin/settings/page.tsx (donde vivía inline, solo para el
// select de país de la empresa) para reusarlo también en el selector de
// país+ciudad del registro (/auth/signup) y de Configuración - misma lista,
// un solo lugar. Refleja los mercados reales del negocio (US/DO como
// principales, más los países donde ya se ha operado o cotizado), no una
// lista ISO completa de 195 países.

export interface Country {
  code: string
  name: string
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'MX', name: 'Mexico' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'ES', name: 'Spain' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
]
