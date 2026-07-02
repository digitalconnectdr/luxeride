// ── Contenido del micrositio por idioma (tagline/about, título/descripción de
// servicios) ───────────────────────────────────────────────────────────────
// El operador puede escribir texto distinto por idioma (Ajustes → Portada,
// Ajustes → Servicios). ES vive históricamente en las columnas legadas
// (tagline/about de companies, title/description de company_services) para no
// perder lo ya guardado; EN/PT son overrides opcionales guardados en una
// columna i18n (JSONB). Si el idioma actual no tiene texto propio, se usa el
// de ES, y si tampoco existe, el valor legado de la columna.

import type { Locale } from './config'

export type LocalizedText<F extends string> = Partial<Record<Locale, Partial<Record<F, string | null | undefined>>>>

export type SiteI18n = LocalizedText<'tagline' | 'about'>
export type ServiceI18n = LocalizedText<'title' | 'description'>

export function resolveLocalizedField<F extends string>(
  i18n: LocalizedText<F> | null | undefined,
  locale: Locale,
  field: F,
  legacyValue: string | null,
): string | null {
  return i18n?.[locale]?.[field] || i18n?.es?.[field] || legacyValue || null
}
