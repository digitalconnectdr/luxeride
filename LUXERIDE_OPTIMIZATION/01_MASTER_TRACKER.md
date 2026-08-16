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
| 1.1 | 1 | Confirmar/descartar `/book/luxeride` | CRITICAL | PENDING | — | No reproducible en código; posible dato desactualizado del prompt | — | — | — | Respuesta del usuario | — |
| 1.2 | 1 | Agregar `noindex` a rutas con PII: `/quote/[id]`, `/review/[id]`, `/affiliate/join/[token]`, `/corporate/join/[token]` | CRITICAL | PENDING | esos `page.tsx` + `robots.ts` | Datos de pasajero/empresa potencialmente indexables hoy | Metadata `robots: {index:false}` por página + disallow en robots.ts | tsc/build | — | — | — |
| 1.3 | 1 | SEO Publication Gate para micrositios (`seo_status` DRAFT/PRIVATE/READY/INDEXABLE) | CRITICAL | PENDING | migración nueva + `sitemap.ts` + `book/[slug]/page.tsx` | Sitemap indexa cualquier operador activo con flota, sin exigir perfil completo | Migración + columna + lógica de gate + UI para que el operador marque "listo para indexar" | tsc/build/vitest | — | Requiere migración (se presenta al usuario, no se aplica sola) | — |
| 1.4 | 1 | Inventario completo de rutas con clasificación INDEX/NOINDEX/PRIVATE/CONDITIONAL | HIGH | PENDING | `02_INDEXATION_REPORT.md` | — | Tabla completa | — | — | — | — |

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
