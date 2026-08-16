# FASE 0 - Baseline Audit

> Auditoría de solo lectura. Ningún archivo de producto fue modificado para
> generar este documento. Fecha: 2026-08-15. Dominio auditado:
> `https://getluxeride.vercel.app`.

## Resumen ejecutivo

El prompt maestro asume, en varios puntos, un estado del proyecto más básico
del que realmente existe. LuxeRide ya tiene **infraestructura SEO/GEO/AEO real
construida y en producción** (ver sección "Ya existe" abajo) - no es una
landing sin optimizar. El gap real no es "construir SEO desde cero", es
**expandir la arquitectura de páginas comerciales (money pages, features,
solutions, compare, resources) que hoy no existe**, cerrar huecos puntuales de
indexación, y agregar lo que falta de analytics/ads readiness.

No se pudo reproducir el problema descrito en 1.3 (`/book/luxeride`
interpretable como empresa de transporte): no existe ninguna empresa con
`slug = 'luxeride'` en las migraciones de Supabase revisadas. Puede ser una
suposición del prompt, o el usuario vio esto en otro contexto (ej. un nombre
de operador de prueba ya borrado). **Marcado como `CONTENT FACT REQUIRED`**  - 
se confirmará contra la base de datos real antes de tratarlo como bug.

## Stack

- Next.js **14.2.3**, App Router (`apps/web/`, monorepo).
- Supabase (Postgres + RLS) como backend.
- Deploy en Vercel, dominio actual `getluxeride.vercel.app` (Hobby plan,
  confirmado en sesión anterior).
- i18n propio (EN/ES/PT) vía `/en`, `/es`, `/pt` + dict, no next-intl.

## Ya existe (NO reconstruir)

| Área | Estado | Evidencia |
|---|---|---|
| `robots.ts` | Bloquea `/admin/`, `/super-admin/`, `/dispatcher/`, `/corporate/`, `/driver/`, `/account/`, `/auth/`, `/api/`, `/track/`, `/payment/`. Apunta a sitemap dinámico. | `app/robots.ts` |
| `sitemap.ts` | Dinámico: home + `/en` `/es` `/pt` + `/privacy` `/terms` + un `/{slug}` por cada empresa `status=active` **con al menos un `vehicle_types.is_active`** (evita listar operadores sin flota real). Excluye `SEO_EXCLUDED_SLUGS` y operadores con `custom_domain_status='verified'` (evita canonical cruzado). | `app/sitemap.ts` |
| Entity SEO (parcial) | JSON-LD `Organization` + `SoftwareApplication` (`applicationSubCategory: "Ground Transportation Dispatch Software"`) + `FAQPage` ya en el home, con `parentOrganization` apuntando a JPRS Digital Connect. Sin `aggregateRating`/`review` inventados (correcto, no viola Fase 26). | `lib/seo/structured-data.ts` |
| hreflang | Implementado para EN/ES/PT. | `lib/seo/hreflang.ts` |
| Exclusión de slugs | `SEO_EXCLUDED_SLUGS` ya existe como mecanismo (usado por sitemap). | `lib/seo/excluded-slugs.ts` |
| Canonical dinámico | `book/[slug]/page.tsx` ya resuelve canonical a `custom_domain` cuando está verificado, o a `BASE/{slug}` si no - bug de canonical cruzado ya corregido en sesión 2026-08-01. | Memoria de sesión + código |
| GA4 | `NEXT_PUBLIC_GA_MEASUREMENT_ID` ya wireado vía `gtag.js` en `app/layout.tsx`. | `app/layout.tsx:11,103-110` |
| UTM/gclid | Captura de atribución (`utm_*`, `gclid`) ya implementada en el wizard de reserva y persistida en `bookings.attribution`. | Memoria de sesión (2026-08-01) |
| Conversion tracking Google Ads | Infraestructura por operador ya construida (Settings → GA4 Measurement ID por empresa). | Memoria de sesión (2026-08-01) |
| Título del home | Ya incluye señal de entidad: `"{brand.name} | {metaTitle} | by {poweredBy}"` - ya dice "by JPRS Digital Connect" de forma natural. | `app/page.tsx:10` |
| `/demo` (micrositio ficticio) | Ya tiene `robots: { index: false, follow: false }` explícito - correctamente fuera de índice. | `app/demo/page.tsx:5-8` |
| Redirect de enlace corto `/{slug}` | Ya existe, redirige a `/book/{slug}` (no es una página fantasma indexable por separado). | `app/[slug]/page.tsx` |
| llms.txt | Ya existe y se mantiene actualizado (última pasada: equipaje/meet&greet/peajes/cortesía, 2026-08-01). | Memoria de sesión |

## Gaps reales confirmados (esto SÍ falta)

| # | Gap | Prioridad | Fase del prompt |
|---|---|---|---|
| G1 | **Cero money pages**: `/limo-software/`, `/black-car-software/`, `/chauffeur-software/`, `/airport-transfer-software/`, `/limo-dispatch-software/`, `/limo-booking-software/` no existen. | CRITICAL | Fase 3 |
| G2 | **Cero feature pages** (`/features/*`), **cero solution pages** (`/solutions/*`), **cero comparison pages** (`/compare/*`). | HIGH | Fase 4, 5, 7 |
| G3 | **No existe `/pricing/` standalone** - el pricing vive solo dentro del home (`#pricing`). | HIGH | Fase 2.5, 6 |
| G4 | **No existen `/about/`, `/security/`, `/faq/`, `/integrations/`**. | HIGH | Fase 8 |
| G5 | **No existe `/resources/`** ni su arquitectura. | MEDIUM | Fase 11 |
| G6 | **Sin SEO Publication Gate en micrositios**: el sitemap indexa TODO operador activo con flota, sin verificar logo/descripción/completitud de perfil (no hay campo `seo_status` DRAFT/PRIVATE/READY/INDEXABLE como pide 1.4/1.5). Esto es un riesgo real de páginas *thin*. | CRITICAL | Fase 1.4, 1.5 |
| G7 | **`/auth/signup` sin metadata propia** - no exporta `metadata` ni `generateMetadata()`, hereda el default del layout raíz (no dice "Start Free Trial", como pide Fase 13). | MEDIUM | Fase 13 |
| G8 | **Rutas con datos personales sin `noindex` explícito ni bloqueo en `robots.ts`**: `/quote/[id]` (cotización con datos del pasajero), `/review/[id]` (token de reseña), `/affiliate/join/[token]`, `/corporate/join/[token]`. `/r/[code]` es solo un redirect (no indexable per se, pero vale confirmar). | CRITICAL | Fase 23 |
| G9 | **Meta Pixel / Conversions API: no existe en absoluto** (cero resultados en todo `apps/web`). Meta Ads Readiness hoy es `BLOCKED`, no `PARTIAL`. | HIGH | Fase 15 |
| G10 | **Sin `BreadcrumbList`** en ninguna página. | MEDIUM | Fase 9.4 |
| G11 | **`/book/luxeride` no reproducible** - requiere confirmación del usuario antes de "corregir" algo que no se pudo localizar en el código. | N/A | Fase 1.3 |
| G12 | **No hay `SITE_URL` centralizado como env var** - existe `getAppUrl()` como helper (usado por robots/sitemap), lo cual ya cumple el espíritu de Fase 21, pero vale auditar que TODO el código lo use y no haya hardcodes de `getluxeride.vercel.app` sueltos. | LOW | Fase 21 |

## No auditado todavía (Fases 17-20, 22 - se auditan en su propia fase, no bloquean el inicio)

Performance (Core Web Vitals reales), accessibility completo, security headers,
dependencias vulnerables, y QA responsive en los 10 breakpoints - el propio
prompt los trata como fases posteriores con su propio ciclo
implementar→auditar→corregir, no como prerequisito de Fase 0. Se auditarán
cuando les toque su fase, contra el código ya modificado por las fases
anteriores (auditar antes tendría que repetirse de todos modos).

## Conclusión Fase 0

**PASS.** Ningún hallazgo aquí bloquea empezar Fase 1. El árbol de decisión
para Fase 1 es más acotado de lo que el prompt original asume, porque gran
parte de la política de indexación ya está bien construida - el trabajo real
de Fase 1 es: cerrar G8 (privacidad - CRITICAL), construir G6 (publication
gate de micrositios - CRITICAL), y confirmar/descartar G11 con el usuario.
