# Fase 2 - Home Optimization Report

Estado: **CERRADA (2026-08-16).** Ver el detalle completo de cada ítem en
`01_MASTER_TRACKER.md`, sección "Fase 2".

## Resumen

| Ítem del prompt original | Resultado |
|---|---|
| Cambios de title/H1/subheadline | Auditados, sin cambios: el hero ya tenía título con señal de entidad ("by JPRS Digital Connect"), sin claims no verificables y sin necesidad de reescritura. |
| Simplificación de pricing en home + link a `/pricing/` | `/pricing/` construido como página standalone (reusa el array `plans` completo, sin modificarlo). El home ahora muestra solo las primeras 6 features por plan + "+N more" + link "See full pricing". |
| Extracción del referral program a página propia | `/referral-program/` construido con tabla de niveles real (`lib/referrals/tiers.ts`: 5%/8%/12%/15% en 1-3/4-6/7-11/12+ referidos activos). El home queda con un teaser de una línea. |
| Auditoría de claims no verificables | Dos hallazgos reales corregidos: "certification" → "badge" (LuxeRide Verified es un puntaje interno, no una certificación de terceros) y "QuickBooks (coming soon)" → sin paréntesis (la integración ya está construida y validada desde 2026-07-11). |
| Fix "certification" → "badge" | Hecho (ver arriba), en EN/ES/PT, home + tooltip del micrositio. |
| Accesibilidad de marquees duplicados | `PaymentMethodsMarquee` duplica su contenido visualmente para el scroll infinito; se agregó una lista `sr-only` con los métodos reales (sin duplicar) y `aria-hidden="true"` en el track decorativo. |

## Verificación

tsc PASS, build PASS, vitest 303/303, verificado en navegador (home + `/pricing/` +
`/referral-program/`, contenido y JSON-LD correctos, short-link de operador sin
regresión tras el cambio de `middleware.ts`).
