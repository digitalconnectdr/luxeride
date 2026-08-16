# Master Tracker — Optimización Integral LuxeRide

Estados: `PENDING` · `IN PROGRESS` · `BLOCKED` · `FIXED` · `PASS` · `FAIL` · `EXTERNAL ACTION REQUIRED`
Prioridades: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`

## Fase 0 — Baseline

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.1 | 0 | Auditoría completa de código (routing, metadata, schema, robots, sitemap, analytics) | — | **PASS** | ver `00_BASELINE_AUDIT.md` | — | Auditoría de solo lectura | N/A | 12 gaps reales identificados, resto ya existía | Confirmar G11 con el usuario | 2026-08-15 |

## Fase 1 — Indexación y Crawling (siguiente, CRITICAL — no iniciada)

| ID | Phase | Task | Priority | Status | Files | Issue | Implementation | Tests | Result | Pending | Date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | 1 | Confirmar/resolver `/book/luxeride` | CRITICAL | **FIXED** | `app/(booking)/book/[slug]/page.tsx`, DB `companies` | Confirmado real por el usuario y en producción: empresa fantasma `slug='luxeride'` (creada 2026-06-12, 0 reservas, 0 flota, 0 dueño, `status='active'`) servía `index,follow` con copy de "reserva tu traslado" — leía como si LuxeRide fuera la empresa de transporte | 1) `companies.status` → `suspended` en producción. 2) `generateMetadata` ahora hace `noindex,nofollow` cuando `company.status !== 'active'`, no solo por `SEO_EXCLUDED_SLUGS` — corrige la causa raíz para cualquier operador futuro en el mismo estado | tsc PASS, build PASS, verificado en vivo | `robots: noindex, nofollow` confirmado en producción tras el deploy (commit `d5b7f52`) | — | 2026-08-16 |
| 1.2 | 1 | Agregar `noindex` a rutas con PII | CRITICAL | **FIXED** | `affiliate/join/[token]/page.tsx`, `corporate/join/[token]/page.tsx` | Auditoría corregida: `/quote/[id]` y `/review/[id]` YA tenían `noindex,nofollow` (el hallazgo original de la Fase 0 estaba mal en esos dos). Los que sí faltaban: `/affiliate/join/[token]` y `/corporate/join/[token]` exponen nombre de empresa/cuenta sin ningún `robots` | `robots: {index:false, follow:false}` agregado a ambos `generateMetadata` | tsc PASS, build PASS, vitest 303/303 | — | — | 2026-08-16 |
| 1.3 | 1 | SEO Publication Gate para micrositios | CRITICAL | **FIXED** | `book/[slug]/page.tsx` | Cualquier empresa `status='active'` quedaba `index,follow` sin exigir contenido real | Gate computado (sin migración ni UI nueva): `noindex` si falta logo, descripción, contacto, o flota activa. Auditado contra producción antes de aplicar: la única empresa activa hoy ("luxeride-platform") cumple los 4 requisitos — cero regresión | tsc PASS, build PASS, vitest 303/303; impacto verificado contra DB real antes del cambio | — | — | 2026-08-16 |
| 1.4 | 1 | Inventario completo de rutas con clasificación INDEX/NOINDEX/PRIVATE/CONDITIONAL | HIGH | **FIXED** | `02_INDEXATION_REPORT.md`, 5x `auth/*/page.tsx`, `track/[id]/page.tsx` | Auditando el layout raíz se encontró un gap más serio que el original: `robots:{index:true,follow:true}` es el default global, así que las 5 páginas de `/auth/*` (sin metadata propia) eran indexables de verdad, no solo con título genérico. `/track/[id]` (ubicación en vivo) tampoco tenía `robots` explícito | `noindex,follow` + título propio (reusando i18n existente) en las 5 páginas de auth; `noindex,follow` en `/track/[id]` | tsc PASS, build PASS, vitest 303/303 | — | — | 2026-08-16 |

**FASE 1 CERRADA (1.1–1.4).** Ver `02_INDEXATION_REPORT.md` para el detalle completo.

## Fases 2-27 — Backlog (no iniciadas, orden sugerido tras Fase 1)

| Fase | Tema | Prioridad sugerida | Gap relacionado |
|---|---|---|---|
| 2 | Homepage: title/H1/subheadline/pricing resumido/referral fuera del funnel/claims auditados | HIGH | — |
| 3 | 6 money pages (`/limo-software/` etc.) | CRITICAL | G1 |
| 4 | Feature pages (`/features/*`) | HIGH | G2 |
| 5 | Solution pages (`/solutions/*`) | HIGH | G2 |
| 6 | `/pricing/` standalone | HIGH | G3 |
| 7 | Comparison engine (`/compare/*`) | HIGH | G2 |
| 8 | `/about/`, `/security/`, `/faq/`, `/integrations/` | HIGH | G4 |
| 9 | Entity SEO: `creator` explícito, BreadcrumbList, FAQ schema en páginas nuevas | MEDIUM | G10 |
| 10 | AEO/GEO/LLM: bloques de respuesta extraíble en cada página nueva | HIGH | (depende de Fases 3-8) |
| 11 | Resource Center (infraestructura, sin contenido todavía) | MEDIUM | G5 |
| 12 | Internal linking entre todo lo anterior | MEDIUM | (depende de Fases 3-8) |
| 13 | Fix metadata de `/auth/signup` | MEDIUM | G7 |
| 14 | Google Ads readiness (landings + eventos) | HIGH | (depende de Fases 3, 6) |
| 15 | Meta Pixel + CAPI desde cero | HIGH | G9 |
| 16 | Auditoría de analytics (evitar tags duplicados) | MEDIUM | — |
| 17-20 | Performance / Responsive / Accessibility / Security | se audita en su momento | — |
| 21 | Confirmar `SITE_URL` centralizado sin hardcodes sueltos | LOW | G12 |
| 22-28 | QA final, no-indexación de contenido privado (ya cubierto en Fase 1), QA de micrositios, reglas de contenido, reporte final | — | — |
