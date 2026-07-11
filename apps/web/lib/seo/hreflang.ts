import type { Locale } from '@/lib/i18n/config'

// Rutas dedicadas por idioma del landing (app/en, app/es, app/pt) para que
// Google pueda indexar cada idioma como página propia y citarlas via hreflang.
export const HREFLANG_LANGUAGES = { en: '/en', es: '/es', pt: '/pt', 'x-default': '/' }

// Mismo mapa sin 'x-default' | lo usa el LanguageSwitcher para navegar entre
// las páginas de idioma en vez de solo refrescar con una cookie nueva.
export const LOCALE_PATHS: Record<Locale, string> = { en: '/en', es: '/es', pt: '/pt' }
