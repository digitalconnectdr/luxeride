# LuxeRide — Estado y pendientes

> Actualizado: 2026-06-14. Para retomar el trabajo, leer este archivo +
> docs/COMPETITIVE-ANALYSIS.md + docs/PHASE-2-MOBILE.md.

## ✅ Completado (Phase 1 + mejoras)

- F1.0–F1.17 completos (ver SETUP.md): booking engine, dispatch realtime,
  Stripe Connect + checkout + depósitos + propinas, policy engine,
  corporate + facturación automática (cron), notificaciones email/SMS
  (HTML brandeado), reports + audit (paginado 50), tracking público,
  flight tracking (AeroDataBox activo / FlightAware listo), multi-stop,
  pagos manuales (cash/Zelle/transferencia), seed demo.
- Tema Ivory en todo el sistema + sidebar colapsable con íconos + favicon.
- Landing premium con fotos de flota, animaciones, pricing, FAQ, trilingüe.
- i18n EN/ES/PT: landing, wizard, tracking, pagos, auth chrome, nav admin,
  y chrome de Fleet/Zones/Airports/Team/Pricing/Settings + formularios
  cliente (tipos de vehículo, estados, roles de equipo).
- Tooltips explicativos (InfoTip) en Aeropuertos y Reglas de precio.
- Aeropuertos personalizados (alta manual con IATA).
- Panel /super-admin/subscriptions: solicitudes pendientes (aprobar/
  rechazar), renovaciones +1/+3/+12 meses, plan editable, vencimientos.
- Bloqueo real de usuarios (is_active en middleware + login) y banner.
- Reset de contraseña: ya existía ("Forgot password?" en login).
- Tests Vitest (29) en CI. Fix crash Stripe Connect. Fix timezone recargos.
- Google Maps funcionando (faltaba habilitar Maps JS/Places/Routes API).
- **Signup arreglado** (2026-06-11): handle_new_user() sin search_path fijo
  hacía fallar a GoTrue con "Database error creating new user". Fix aplicado
  en producción + migración 16. signupAction ahora confirma el email
  (email_confirm: true) y hace auto-login al dashboard.
- GA4 + Search Console + sitemap.xml + robots.txt (faltan las 2 env vars).
- **Producción viva**: main ahora contiene todo develop (historias unidas
  con merge -s ours). Push a main = deploy de producción en
  https://getluxeride.vercel.app (público, sin login de Vercel).
- **Ronda de fixes 2026-06-14** (observaciones del usuario):
  - Edición en Flota (tipos), Zonas (+ campo radio), Aeropuertos y Reglas de
    precio — antes solo se podía crear/eliminar (obs. 1,3,4,5).
  - Equipo: alta directa con contraseña temporal en vez del email de
    invitación que no llegaba (obs. 2).
  - Pagos/Política en Configuración traducidos EN/ES/PT (obs. 6).
  - Export CSV respeta el idioma (obs. 9).
  - Dashboard 100% i18n + gráfico de semana inicia DOMINGO (obs. 11).
  - Marca centralizada en lib/brand.ts (obs. 13).
  - Logo del sidebar enlaza al dashboard (obs. 7). Mensaje de "regla de
    precio" ahora accionable.
  - Directorio del landing ELIMINADO (decisión white-label puro, ver abajo).
    El sitemap quedó reducido al landing del software.
  - Aclaración importante: hay 2 empresas — "LuxeRide" (slug luxeride, cuenta
    super_admin, vacía) y "LuxeRide Platform" (slug luxeride-platform, la
    operadora con el vehículo/tipo/precio). El booking real es
    /book/luxeride-platform. Pendiente decisión del usuario: consolidar /
    renombrar para usar el slug "luxeride" en la operadora.

## ⬜ Pendientes del USUARIO (configuración)

1. **Search Console**: GA4 (G-GQNY35MX3V) y la meta de verificación ya
   están en producción ✅ — falta dar "Verificar" en Search Console y
   enviar https://getluxeride.vercel.app/sitemap.xml en Sitemaps.
2. (Opcional) Vercel → Settings → Deployment Protection → desactivar
   "Vercel Authentication" si se quiere compartir previews de develop sin
   login de Vercel. Producción (getluxeride.vercel.app) ya es pública.
3. **Vercel env vars** (opcionales, activan features): RESEND_API_KEY +
   RESEND_FROM_EMAIL (key ya existe, dominio por verificar en resend.com),
   CRON_SECRET (facturación corporativa + alertas de documentos),
   UPSTASH_REDIS_REST_URL/TOKEN (rate limit distribuido).
4. **Stripe real** cuando haya clientes: keys + webhook
   (/api/stripe/webhook) + habilitar Connect en dashboard.stripe.com.
5. **Twilio** (SMS) cuando se quiera activar.
6. Probar /super-admin/subscriptions con el usuario super_admin.

## ⬜ Funciones grandes pospuestas (decisión 2026-06-14: bugs primero)

Observaciones 10 y 12 del usuario — features nuevas que requieren tablas +
realtime + geolocalización. Plan para una fase dedicada:

### A. Dispatch avanzado (obs. 10)
1. **Mapa en vivo** en el Dispatch Board: ubicación de conductores
   (drivers.current_lat/lng vía web push del navegador del conductor o la
   futura PWA) + pins de los pickups pendientes. Usar Google Maps JS
   (ya tenemos la key) o Mapbox. Realtime de Supabase para mover los pines.
2. **Estados de rechazo / incidente**: agregar a booking status
   `rejected_by_driver`, `rejected_by_customer`, `driver_incident`. Migración
   del enum + UI en el board + registro en audit_log. Notificar a la otra parte.
3. **Reasignación de conductor**: acción "Reasignar" en un viaje ya asignado
   (libera al conductor 1, asigna al 2, registra motivo en audit_log, notifica
   a cliente + ambos conductores). Ya existe assignDriverToVehicle como base.
4. Clasificación de eventualidades: tabla `booking_events` (tipo, actor,
   motivo, timestamp) para trazabilidad completa cliente↔conductor.

### ✅ White-label por empresa (2026-06-14) — HECHO
Cada empresa personaliza su marca: Configuración → "Marca" (logo + color).
Aplicado en portal /book/[slug], emails, tracking y logo en el sidebar del
panel. Storage bucket "branding".
**DECISIÓN DE NEGOCIO 2026-06-14: white-label PURO.** El directorio/marketplace
del landing se ELIMINÓ (queda comentado en app/page.tsx). El landing solo vende
el software; cada operador usa su propio /book/su-slug. Implicaciones:
- El **widget embebible** (backlog #2) sube de prioridad: es como cada operador
  pone reservas en SU web.
- **SEO de operadores**: cada portal /book/<slug> SÍ se indexa bajo el dominio
  de LuxeRide (sitemap + generateMetadata con title/description/OG por empresa).
  El operador aparece en buscadores SIN dominio propio. El dominio propio
  (sección C niveles 2-3) sigue siendo un plus de marca/URL, no un requisito SEO.
- La **PWA** debe ser **branded por empresa**, no genérica (ver sección C.4).

### C. White-label avanzado: link corto + dominio + PWA branded (pedido 2026-06-14)
Hoy el link de un operador es `getluxeride.vercel.app/book/<slug>` y el slug ya
se deriva del nombre (ej. "Revival" → /book/revival). El usuario quiere links
más cortos/branded y que la PWA + dashboard + app conductor muestren la marca
del cliente. Plan por niveles (de menor a mayor esfuerzo):
1. **Path corto** `/<slug>` (sin /book/): middleware reescribe `/<slug>` →
   `/book/<slug>` si el slug es una empresa (validar contra reservas del
   sistema /admin, /auth, etc.). Rápido.
2. **Subdominio** `<slug>.dominio.com`: requiere dominio propio (no
   *.vercel.app) + wildcard domain en Vercel + middleware que lea el subdominio
   (host header) y resuelva la empresa. Es el estándar SaaS.
3. **Dominio propio del cliente** `reservas.suempresa.com`: Vercel custom
   domains por empresa (límite en plan Hobby; requiere upgrade).
4. **PWA branded por empresa** (se cruza con Fase 2A PWA): manifest dinámico
   por empresa (nombre, iconos = logo del cliente, theme_color = primary_color)
   servido según slug/subdominio, para que "instalar app" muestre la marca del
   cliente. La app del conductor (Fase 2B) hereda el mismo branding.
Branding en dashboard: ✅ logo en el sidebar (2026-06-14). Falta (opcional)
aplicar primary_color a los acentos del panel admin.

### B. Calificaciones + chat (obs. 12)
1. **Calificaciones bidireccionales**: bookings.rating ya existe (cliente→
   conductor). Agregar driver_rating (conductor→cliente) + promedio en el
   perfil del conductor (drivers.avg_rating) y métricas (puntualidad,
   cancelaciones) para el ranking interno.
2. **Chat cliente↔conductor**: tabla `booking_messages` (booking_id, sender,
   body, created_at) con RLS (cliente y conductor del viaje + admins de la
   empresa). Realtime para el hilo. Auditable: los admins ven todos los hilos
   de su empresa (cumple el requisito de auditoría del usuario).
3. Disponibles tanto en web como en la futura PWA (reutilizan el backend).

## ⬜ Backlog de DESARROLLO (próximas sesiones, en orden sugerido)

0. **Limpieza de marca**: migrar los ~40 literales "LuxeRide" / "JPRS Digital
   Connect" que quedan hardcodeados (titles de metadata, páginas auth /
   super-admin / booking / payment / track) a `lib/brand.ts` (`brand.name`,
   `brand.poweredBy`). Objetivo: renombrar el sistema cambiando un solo lugar.
   Regla vigente: todo lo NUEVO ya debe usar brand.* (no hardcodear).

1. **2ª pasada i18n** (~1 sesión): conectar al diccionario las páginas
   nativas en español para EN/PT — bookings lista/detalle/nueva, dispatch
   board (columnas/acciones), reports, audit, corporate, driver/account,
   login/signup completos, secciones policy/payments de Settings,
   formulario nuevo vehículo, detalles de conductor/vehículo.
2. **Widget de reservas embebible** (~1 sesión): iframe/script del wizard
   para incrustar en el sitio web de cada operador.
3. **Reviews post-viaje**: email al completar con link de calificación
   (bookings.rating ya existe) — cierra gap competitivo.
4. **Pipeline de cotizaciones**: UI de quotes + follow-up automático de
   cotizaciones abandonadas (Moovs-style).
5. **Notificar al super admin** (email) cuando entra una solicitud nueva
   desde el landing + cron aviso de suscripciones por vencer.
6. **PWA del sistema** (DECIDIDO 2026-06-11: va ANTES que las apps nativas;
   si funciona bien, recién entonces se hace la versión nativa) —
   manifest.json + service worker + installable en iOS/Android, push web,
   offline básico para el driver. Detalle en docs/PHASE-2-MOBILE.md (Fase 2A).
   AJUSTE 2026-06-14: por white-label puro, el manifest debe ser DINÁMICO por
   empresa (nombre/iconos/theme_color del cliente), no genérico — ver sección C.4.
7. **Fase 2B móvil nativo** (driver app primero, SOLO si la PWA valida bien)
   — plan en docs/PHASE-2-MOBILE.md.
8. Gaps mayores: QuickBooks, e-signatures, farm-in/farm-out, promo codes,
   detección de conflictos de vehículo, nómina de conductores, WhatsApp.

## Datos operativos

- Deploy: push a develop → preview (requiere login de Vercel salvo que se
  desactive Deployment Protection); push a main → PRODUCCIÓN
  (https://getluxeride.vercel.app, pública). Para promover: merge develop→main.
- Migraciones: SQL Editor de Supabase (proyecto iwjtjwryhtpzuvwmlpjk) o
  `supabase db push`.
- Flujo de solicitudes: signup del landing crea empresa en `trial` →
  aparece en /super-admin/subscriptions → Aprobar la activa con 1 mes.
- Tests: `npm test` (raíz). Build: `npx next build` en apps/web.
