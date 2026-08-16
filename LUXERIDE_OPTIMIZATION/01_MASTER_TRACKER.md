# Master Tracker - Optimización Integral LuxeRide

Estados: `PENDING` · `IN PROGRESS` · `BLOCKED` · `FIXED` · `PASS` · `FAIL` · `EXTERNAL ACTION REQUIRED`
Prioridades: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`

## Fase 0 - Baseline

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | 0 | Auditoría completa de código (routing, metadata, schema, robots, sitemap, analytics) | N/A | **PASS** | ver `00_BASELINE_AUDIT.md` | N/A | Auditoría de solo lectura | N/A | 12 gaps reales identificados, resto ya existía | Confirmar G11 con el usuario | 2026-08-15 |

## Fase 1 - Indexación y Crawling (siguiente, CRITICAL - no iniciada)

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | 1 | Confirmar/resolver `/book/luxeride` | CRITICAL | **FIXED** | `app/(booking)/book/[slug]/page.tsx`, DB `companies` | Confirmado real por el usuario y en producción: empresa fantasma `slug='luxeride'` (creada 2026-06-12, 0 reservas, 0 flota, 0 dueño, `status='active'`) servía `index,follow` con copy de "reserva tu traslado" - leía como si LuxeRide fuera la empresa de transporte | 1) `companies.status` → `suspended` en producción. 2) `generateMetadata` ahora hace `noindex,nofollow` cuando `company.status !== 'active'`, no solo por `SEO_EXCLUDED_SLUGS` - corrige la causa raíz para cualquier operador futuro en el mismo estado | tsc PASS, build PASS, verificado en vivo | `robots: noindex, nofollow` confirmado en producción tras el deploy (commit `d5b7f52`) | N/A | 2026-08-16 |
| 1.2 | 1 | Agregar `noindex` a rutas con PII | CRITICAL | **FIXED** | `affiliate/join/[token]/page.tsx`, `corporate/join/[token]/page.tsx` | Auditoría corregida: `/quote/[id]` y `/review/[id]` YA tenían `noindex,nofollow` (el hallazgo original de la Fase 0 estaba mal en esos dos). Los que sí faltaban: `/affiliate/join/[token]` y `/corporate/join/[token]` exponen nombre de empresa/cuenta sin ningún `robots` | `robots: {index:false, follow:false}` agregado a ambos `generateMetadata` | tsc PASS, build PASS, vitest 303/303 | N/A | - | 2026-08-16 |
| 1.3 | 1 | SEO Publication Gate para micrositios | CRITICAL | **FIXED** | `book/[slug]/page.tsx` | Cualquier empresa `status='active'` quedaba `index,follow` sin exigir contenido real | Gate computado (sin migración ni UI nueva): `noindex` si falta logo, descripción, contacto, o flota activa. Auditado contra producción antes de aplicar: la única empresa activa hoy ("luxeride-platform") cumple los 4 requisitos - cero regresión | tsc PASS, build PASS, vitest 303/303; impacto verificado contra DB real antes del cambio | N/A | - | 2026-08-16 |
| 1.4 | 1 | Inventario completo de rutas con clasificación INDEX/NOINDEX/PRIVATE/CONDITIONAL | HIGH | **FIXED** | `02_INDEXATION_REPORT.md`, 5x `auth/*/page.tsx`, `track/[id]/page.tsx` | Auditando el layout raíz se encontró un gap más serio que el original: `robots:{index:true,follow:true}` es el default global, así que las 5 páginas de `/auth/*` (sin metadata propia) eran indexables de verdad, no solo con título genérico. `/track/[id]` (ubicación en vivo) tampoco tenía `robots` explícito | `noindex,follow` + título propio (reusando i18n existente) en las 5 páginas de auth; `noindex,follow` en `/track/[id]` | tsc PASS, build PASS, vitest 303/303 | N/A | - | 2026-08-16 |

| 1.5 | 1 | `app/not-found.tsx` global (no existía) | HIGH | **FIXED** | `app/not-found.tsx`, i18n `notFound` (en/es/pt) | Sin este archivo, Next usa su 404 default sin override de metadata → hereda `index:true` del layout raíz. Efecto real observado en vivo: `/track/[id]` con ID inexistente devolvía DOS `<meta name="robots">` contradictorios | Página 404 propia con `noindex,nofollow` - cierra el hueco para cualquier 404 del sitio, no solo el caso puntual | tsc PASS, build PASS, vitest 303/303 | N/A | - | 2026-08-16 |

**FASE 1 CERRADA (1.1–1.5).** Ver `02_INDEXATION_REPORT.md` para el detalle completo.

## Fase 2 - Home Optimization (HIGH, cerrada)

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | 2 | Auditoría de claims: "certification" → "badge" | MEDIUM | **FIXED** | `lib/i18n/dictionaries/{en,es,pt}.ts` (`landing.trust.points`, `book.verifiedBadgeTooltip`) | LuxeRide Verified es un puntaje de cumplimiento interno, no una certificación de un tercero - llamarlo "certification" es un claim no verificable | Reemplazado por "badge"/"insignia"/"selo" en las 3 páginas donde aparecía (home + tooltip del micrositio) | tsc PASS | N/A | - | 2026-08-16 |
| 2.2 | 2 | Auditoría de claims: "QuickBooks (coming soon)" desactualizado | MEDIUM | **FIXED** | `lib/i18n/dictionaries/{en,es,pt}.ts` (`landing.plans[0].features`) | La integración de QuickBooks Online ya está construida y validada end-to-end contra un sandbox real (sesión 2026-07-11), pero el copy del plan Starter seguía diciendo "próximamente" | Se quitó el paréntesis "(coming soon)"/"(próximamente)"/"(em breve)" | tsc PASS, verificado en navegador | N/A | - | 2026-08-16 |
| 2.3 | 2 | Accesibilidad: `PaymentMethodsMarquee` duplica contenido para el scroll infinito | LOW | **FIXED** | `components/booking/payment-methods-marquee.tsx` | El track visual se duplica (`[...methods, ...methods]`) para el efecto de scroll continuo, sin `aria-hidden` - un lector de pantalla anunciaba cada método de pago pagado 2 veces | `<ul className="sr-only">` con la lista real + `aria-hidden="true"` en el track visual duplicado | tsc PASS, build PASS | N/A | - | 2026-08-16 |
| 2.4 | 2 | `/pricing/` standalone (extraído del `#pricing` del home) | HIGH | **FIXED** | `app/pricing/page.tsx`, `lib/i18n/dictionaries/{en,es,pt}.ts` (`pricingPage`), `app/sitemap.ts`, `middleware.ts` | No existía `/pricing/` fuera del ancla del home (gap G3 de la Fase 0) | Página nueva que reusa el array `plans` COMPLETO sin modificarlo (dato protegido) + `pricingIncluded` + FAQ del landing, con metadata/JSON-LD propios (`buildLandingStructuredData` reusado, genera Offers desde `plans`) | tsc PASS, build PASS, vitest 303/303, verificado en navegador | Agregado a `RESERVED_SEGMENTS` en middleware (mismo bug de link-corto que en Fase 3) | - | 2026-08-16 |
| 2.5 | 2 | Simplificar pricing del home + link a `/pricing/` | HIGH | **FIXED** | `components/landing/landing-content.tsx` | Cada tarjeta de plan mostraba hasta 15 líneas de features en el home - demasiado denso para un funnel de conversión | Recorte presentacional a las primeras 6 features (`plan.features.slice(0,6)`, sin tocar el array `plans`) + nota "+N more" + link "See full pricing" a `/pricing/` | tsc PASS, build PASS, vitest 303/303, verificado en navegador | N/A | - | 2026-08-16 |
| 2.6 | 2 | Extraer programa de referidos a `/referral-program/` | HIGH | **FIXED** | `app/referral-program/page.tsx`, `lib/i18n/dictionaries/{en,es,pt}.ts` (`referralProgramPage`), `lib/referrals/tiers.ts`, `app/sitemap.ts`, `middleware.ts` | El pitch completo de "refiere y gana" vivía en medio del funnel del home, dirigido a operadores ya clientes en vez del visitante nuevo evaluando el software | Página nueva con tabla de niveles construida desde `REFERRAL_TIERS` (datos reales: 5%/8%/12%/15% en 1-3/4-6/7-11/12+ referidos activos, no inventados) + FAQ propia; el home queda con un teaser de una línea + link | tsc PASS, build PASS, vitest 303/303, verificado en navegador (niveles coinciden exactamente con el código) | Agregado a `RESERVED_SEGMENTS` en middleware | - | 2026-08-16 |

**FASE 2 CERRADA (2.1–2.6).** Título/H1/subheadline del hero se auditaron y se dejaron sin cambios (ya cumplían con la Fase 0: título con señal de entidad, sin claims no verificables).

## Fase 3 - Money Pages (CRITICAL, cerrada)

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | 3 | 6 money pages standalone (`/limo-software`, `/black-car-software`, `/chauffeur-software`, `/airport-transfer-software`, `/limo-dispatch-software`, `/limo-booking-software`) | CRITICAL | **FIXED** | `app/<slug>/page.tsx` x6, `components/marketing/money-page-layout.tsx`, `lib/seo/structured-data.ts`, `lib/i18n/dictionaries/{en,es,pt}.ts` (`moneyPages`), `app/sitemap.ts`, `middleware.ts` | No existían páginas dedicadas por caso de uso; todo el SEO transaccional dependía del home genérico. Contenido de cada página derivado de features reales del código (no inventado): fleet/pricing/dispatch para limo-software, corporate accounts/QuickBooks para black-car, compliance/ratings para chauffeur, flight tracking/meet&greet/luggage para airport-transfer, dispatch board/auto-assign para limo-dispatch, booking engine/multi-idioma/widget para limo-booking - cada FAQ y caso de uso genuinamente distinto (sin doorway pages) | Layout compartido data-driven + `buildMoneyPageStructuredData` (WebPage+BreadcrumbList+FAQPage, reusa Organization/SoftwareApplication del landing) + metadata completa (canonical, OG, Twitter) + 6 entradas en sitemap | tsc PASS, build PASS, vitest 303/303, verificado en navegador (las 6 rutas, títulos correctos, contenido completo, JSON-LD presente) | Bug encontrado y corregido en el camino: `middleware.ts` reescribe cualquier segmento de 1 palabra no reservado a `/book/<slug>` (link corto de operador) - las 6 rutas nuevas devolvían 404 hasta agregarlas a `RESERVED_SEGMENTS`. Regresión verificada: el short-link real (`/luxeride-platform`) sigue funcionando | Capturas reales del producto pendientes de insertar (usuario compartió pantallazos por chat sin ruta de archivo accesible; contenido quedó 100% en texto, sin inventar nada) | 2026-08-16 |

## Fases 4-27 - Backlog (no iniciadas, orden sugerido tras Fase 1)

| Fase | Tema | Prioridad sugerida | Gap relacionado |
|---|---|---|---|
| 4 | Feature pages (`/features/*`) | HIGH | G2 |
| 5 | Solution pages (`/solutions/*`) | HIGH | G2 |
| 6 | ~~`/pricing/` standalone~~ | ~~HIGH~~ | ya cerrado en Fase 2.4 |
| 7 | Comparison engine (`/compare/*`) | HIGH | G2 |
| 8 | `/about/`, `/security/`, `/faq/`, `/integrations/` | HIGH | G4 |
| 9 | Entity SEO: `creator` explícito, BreadcrumbList, FAQ schema en páginas nuevas | MEDIUM | G10 |
| 10 | AEO/GEO/LLM: bloques de respuesta extraíble en cada página nueva | HIGH | (depende de Fases 3-8) |
| 11 | Resource Center (infraestructura, sin contenido todavía) | MEDIUM | G5 |
| 12 | Internal linking entre todo lo anterior | MEDIUM | (depende de Fases 3-8) |
| 13 | Fix metadata de `/auth/signup` | MEDIUM | G7 |
| 14 | Google Ads readiness (landings + eventos) | HIGH | (depende de Fases 3, 6) |
| 15 | Meta Pixel + CAPI desde cero | HIGH | G9 |
| 16 | Auditoría de analytics (evitar tags duplicados) | MEDIUM | N/A |
| 17-20 | Performance / Responsive / Accessibility / Security | se audita en su momento | N/A |
| 21 | Confirmar `SITE_URL` centralizado sin hardcodes sueltos | LOW | G12 |
| 22-28 | QA final, no-indexación de contenido privado (ya cubierto en Fase 1), QA de micrositios, reglas de contenido, reporte final | N/A | - |
