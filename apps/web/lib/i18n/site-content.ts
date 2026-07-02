// ── Contenido del micrositio por idioma (tagline/about) ───────────────────────
// El operador puede escribir un slogan/about distinto por idioma en Ajustes →
// Portada (settings.site.i18n). ES vive históricamente en las columnas
// tagline/about de companies (compatibilidad con lo ya guardado); EN/PT son
// overrides opcionales. Si el idioma actual no tiene texto propio, se usa el
// de ES, y si tampoco existe, el valor legado de la columna.

import type { Locale } from './config'

export type SiteI18n = Partial<Record<Locale, { tagline?: string | null; about?: string | null }>>

export function resolveLocalizedField(
  i18n: SiteI18n | null | undefined,
  locale: Locale,
  field: 'tagline' | 'about',
  legacyValue: string | null,
): string | null {
  return i18n?.[locale]?.[field] || i18n?.es?.[field] || legacyValue || null
}
