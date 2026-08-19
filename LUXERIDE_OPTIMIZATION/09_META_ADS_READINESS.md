# Fase 15 - Meta Ads Readiness

Estado actual: **PARTIAL** (infraestructura completa, activación opt-in por operador).

Construido 2026-08-17:
- `lib/tracking/meta-capi.ts` - Conversions API server-side (evento `Purchase`,
  email/teléfono del pasajero hasheados en SHA-256, `waitUntil` de Vercel).
- `components/booking/meta-pixel-tracker.tsx` - Pixel del navegador (`fbq`),
  mismo `eventId` que la CAPI para deduplicación.
- Ambos se disparan desde `/payment/success`, mismo punto donde ya vive
  `ConversionTracker` (Google Ads).
- Configuración en `/admin/settings` → sección "Meta Ads": `meta_pixel_id` +
  `meta_capi_token` en `companies.settings.tracking` (JSONB, sin migración).

Por qué sigue en `PARTIAL` y no `READY`: cada operador debe pegar su propio
Pixel ID (y opcionalmente el token de CAPI) desde su cuenta de Meta Business
- sin eso, el código está listo pero inactivo, igual que GA4/QuickBooks. No
hay credenciales de prueba en este entorno para verificar el disparo real de
eventos contra una cuenta de Meta Business real - queda pendiente del usuario.
