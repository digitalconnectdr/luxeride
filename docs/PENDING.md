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
1. ✅ **Path corto** `/<slug>` (HECHO 2026-06-14): middleware reescribe
   `/<slug>` → `/book/<slug>` (excluye rutas reservadas). Es el canónico
   (canonical/OG/JSON-LD/sitemap). Tarjeta "Tu enlace de reservas" en Config.
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

### D. Microsite / portada branded por operador (✅ HECHO 2026-06-14)
IMPLEMENTADO: el link corto /<slug> muestra una micropágina del operador con
hero (logo/slogan/imagen), sección de servicios, "sobre nosotros", formulario
de reserva embebido y QR. Configurable desde Configuración → Portada + Servicios.
Migración 17 (companies: tagline/hero_image_url/about + tabla company_services).
Falta (mejora futura): más bloques de portada (galería de flota, testimonios),
y enlazar el QR a la PWA cuando exista (Fase 2A). Plan original abajo (cumplido):


Hoy /book/<slug> entra directo al wizard de reservas. El usuario quiere que sea
una PÁGINA PRINCIPAL del operador con su marca completa: logo, colores, slogan,
hero, **sus servicios**, y un botón "Reservar" + un QR para instalar la PWA de
ESE operador. Cada empresa personaliza su portada.
Plan:
1. Campos nuevos en companies (o settings.site): tagline/slogan, hero_image,
   about/description, redes. UI en Configuración → "Marca/Portada".
2. **Servicios configurables desde el dashboard** (REQUISITO 2026-06-14): cada
   operador define la lista de servicios que ofrece (ej. traslado aeropuerto,
   chofer por horas, bodas/eventos, corporativo) con título, descripción e
   ícono/imagen. Modelo: tabla `company_services` (company_id, title, desc,
   icon/image, sort_order, is_active) con CRUD en Configuración → Portada
   (mismo patrón de edición inline que Flota/Zonas). Esos servicios se
   renderizan en una sección del microsite. i18n + brand.* obligatorios.
3. Ruta de portada del operador (p.ej. /book/<slug> muestra la portada y
   /book/<slug>/reservar abre el wizard), con la marca aplicada (ya tenemos
   logo + primary_color).
4. QR para PWA: generar QR (lib qrcode) que apunte al portal; al abrirlo en
   móvil ofrece "instalar app". DEPENDE de la PWA (Fase 2A) para instalación;
   el QR al portal de reservas se puede generar desde ya.
Es un mini-CMS por operador — feature mediana, se cruza con la PWA branded (C.4).

### E. SEO para IA + todos los buscadores (pedido 2026-06-14)
- ✅ Buscadores: el SEO (meta tags, OG, sitemap, canonical, robots) es estándar
  → sirve para Google, Bing, DuckDuckGo, Brave, Ecosia, etc. (no solo Google).
  Pendiente usuario: enviar el sitemap también en Bing Webmaster Tools.
- ✅ IA: JSON-LD LocalBusiness por operador (2026-06-14) → ChatGPT, Perplexity,
  Claude, Gemini pueden entender y recomendar cada operador. robots no bloquea
  GPTBot/PerplexityBot/etc.
- Opcional futuro: llms.txt (índice para LLMs) + más tipos Schema (Review,
  AggregateRating cuando existan calificaciones) para recomendaciones más ricas.

### B. Calificaciones + chat (obs. 12)
1. **Calificaciones bidireccionales**: bookings.rating ya existe (cliente→
   conductor). Agregar driver_rating (conductor→cliente) + promedio en el
   perfil del conductor (drivers.avg_rating) y métricas (puntualidad,
   cancelaciones) para el ranking interno.  ⬜ PENDIENTE.
2. ✅ **Chat cliente↔conductor (HECHO 2026-06-16)**: implementado como tabla
   `trip_messages` (booking_id, company_id, sender 'client'|'driver', body,
   created_at) en vez del nombre tentativo `booking_messages`. RLS: el conductor
   asignado lee/escribe sus viajes; admin/owner/dispatcher LEEN (auditable ✅).
   El pasajero escribe sin login vía server actions con service-role validando
   el UUID de la reserva (capability URL). UI: panel de chat en /track/[id]
   (lado cliente) y en /driver/trips (lado conductor), con polling cada 8s.
   Componente reutilizable components/trip/trip-chat.tsx. Migración 18.
   Falta (mejora): realtime de Supabase en vez de polling; vista admin de hilos.
3. Disponibles tanto en web como en la futura PWA (reutilizan el backend).

### B-bis. Seguimiento del pasajero: rediseño + cancelar + reportar (HECHO 2026-06-16)
Pedido del usuario: el link de seguimiento se veía muy básico y faltaban acciones.
- ✅ **Rediseño /track/[id]**: encabezado con referencia, estado actual destacado
  (pulse), timeline con horas por etapa (check al completar), tarjeta de conductor
  + vehículo + placa, ruta con conectores, contacto. Sigue siendo dark premium.
- ✅ **Cancelar viaje (cliente)**: server action cancelTripByClientAction (usa el
  status `cancelled` existente; permitido en pending/assigned/en_route/arrived).
  Componente components/trip/track-actions.tsx con confirmación + motivo.
- ✅ **Reportar al conductor**: tabla `trip_reports` (category false_arrival/
  no_contact/unsafe/other + reason) + reportDriverAction. RLS: admin/owner/
  dispatcher gestiona. Migración 18. Falta (mejora): vista admin de reportes.
- ✅ **No-show del conductor**: driverNoShowAction (solo desde `arrived`) + botón
  con confirmación en components/driver/trip-actions.tsx.
- ✅ **Cancelación respeta la política** (2026-06-16): cancelTripByClientAction
  ahora usa parsePolicy + computeCancellationFee (mismo motor F1.10 que el admin)
  e inserta booking_fees si aplica. El panel de cancelar muestra un PREVIEW del
  cargo (gratis vs % según anticipación) vía getCancellationPreviewAction.
- ✅ **Parada durante el viaje con re-cotización y cobro** (2026-06-16):
  addTripStopAction (cliente) y driverAddTripStopAction (conductor) agregan un
  waypoint a un viaje en curso. Recalculan la RUTA con coordenadas (AddressInput
  + calculateRoute) y el COSTO con calculateFare → respeta TODOS los modelos de
  precio (flat_rate/per_mile/per_km/hourly/zone_based). El extra se suma a
  total_amount + booking_fees('route_change_fee') y se avisa por el chat. Si el
  viaje ya tenía pago con tarjeta exitoso y la empresa tiene Connect, se genera
  un Stripe Checkout SOLO por la diferencia (createStopChargeIfPaidOnline) y el
  cliente paga; si pagaba al conductor, el extra se suma al total que cobra.
  quoteTripStopAction muestra el costo ANTES de confirmar. UI: track-actions.tsx
  (cliente) y driver-add-stop.tsx (conductor). El conductor ve los waypoints en
  su ruta. Pendiente (mejora): re-cotización para round_trip/hourly con reglas
  especiales y tarifa fija por parada configurable.
- Relación con Sección A (obs.10): versión enfocada. Pendiente aún el sistema
  completo de eventos (booking_events) + estados rejected_by_* + mapa en vivo +
  re-cotización automática al agregar parada (hoy el costo extra lo ajusta el
  operador manualmente).

### B-ter. Ajustes UX 2026-06-17 (pruebas en producción del usuario)
- ✅ **Reserva en pantalla completa**: nueva página /book/<slug>/reservar (premium,
  2 columnas: panel de marca + wizard centrado). Los CTAs del micrositio ("Reservar
  ahora", hero, servicios, footer) enlazan ahí en vez de la card embebida (que se
  veía muy grande). El micrositio ahora cierra con una sección CTA + QR.
- ✅ **Tracking elevado a premium**: /track/[id] con Playfair, oro hairline, grano,
  timeline refinado (check dorado + horas), tarjeta de conductor con anillo. Mismo
  lenguaje visual que el micrositio.
- ✅ **Auto-refresh del tracking ESCALONADO** (2026-06-17): para no saturar con
  reservas a días vista, el polling entra por cercanía al viaje — en movimiento o
  a ≤2h → 15s; a ≤24h → 60s; a >24h → sin polling. Resuelve la observación del
  usuario (una reserva a 7 días no consume nada hasta acercarse) y a la vez arregla
  el bug de que en `pending` no actualizaba (LXR-2026-00002).
- ✅ **Gráfica "Reservaciones — esta semana"**: las barras usaban height:% contra un
  contenedor de altura auto (no resolvía) → se agregó una pista de altura fija.
- ✅ **Conductores · Viajes**: mostraba drivers.total_trips (columna no incrementada)
  → ahora cuenta los viajes COMPLETADOS dinámicamente por conductor.
- ✅ **Dispatch Board en vivo**: además del Supabase Realtime (que depende de que la
  tabla esté en la publicación + autorización), se agregó polling cada 12s como
  respaldo confiable, igual que los portales de cliente/conductor.

### B-quater. Micrositio: legibilidad + foto de vehículos (2026-06-17)
- ✅ **"La diferencia" legible**: el texto iba sobre la foto del hero (overlay /92
  insuficiente) → ahora fondo sólido #0a0a0d + foto al 40% con degradado casi
  opaco del lado del texto; cuerpo a white/75.
- ✅ **Foto por tipo de vehículo (base_image_url)**: NO existía UI para subirla, por
  eso la flota mostraba una foto genérica que no coincidía con el nombre (ej. "G63
  AMG" con una SUV cualquiera). Ahora:
  - Subida de imagen en Flota → editar/crear tipo de vehículo (bucket "branding",
    PNG/JPG/WebP ≤5 MB) vía uploadVehicleImage en actions/fleet.ts.
  - El micrositio usa base_image_url cuando existe; si NO hay foto, muestra un
    PLACEHOLDER elegante (ícono por clase) en vez de un auto que no corresponde.
  - i18n EN/ES/PT: fleet.typeForm.image/imageHint/imageRemove/imageCurrent.

### B-quinque. Reserva full-screen + tracking premium (2026-06-17)
- ✅ **Página de reserva**: logo crudo (fondo blanco que restaba elegancia) → wordmark
  del nombre; card más ANCHA (max-w-lg) para que "Reservar con <empresa>" quepa en
  una línea aunque el nombre sea largo, y más COMPACTA en alto (header/stepper/padding).
- ✅ **Tracking premium (mejoras del usuario)**: frase contextual por estado ("{driver}
  te espera en el punto de recogida"), progreso "Paso X de 6", selector de idioma
  EN/ES/PT en la página, pickup/destino con "Abrir en Maps" + "Copiar" (CopyButton),
  y chat con respuestas rápidas ("Mi vuelo está retrasado", etc.).
- ⬜ **Fase 2 del tracking (pendiente, requiere datos/infra)**:
  - Mapa en vivo / estático con vehículo + ruta + ETA → se cruza con Sección A
    (GPS del conductor). Un mapa estático necesita habilitar Static Maps API.
  - Tarjeta del chofer con foto, ⭐ rating e idiomas → rating es B.1 (calificaciones)
    y faltan campos de perfil del conductor (foto/idiomas).
  - Acuses de lectura del chat ("visto/respondió") → trip_messages.read_at existe
    pero falta marcar leído del lado del conductor.

### B-quinquies. Tracking "Premium Trip Control Center" (2026-06-17)
Sobre las observaciones del usuario para el link de seguimiento:
- ✅ Idioma EN/ES/PT en la página, frase contextual por estado, "Paso X de 6",
  pickup/destino con "Abrir en Maps" + "Copiar", chat con respuestas rápidas,
  jerarquía de acciones (cancelar de-enfatizado). (commit 1a62baa)
- ✅ **Mapa estático elegante** (pickup A + destino B + ruta, estilo oscuro) con
  fallback si la "Maps Static API" no está habilitada (StaticMap onError).
  REQUIERE habilitar "Maps Static API" en la misma key de Google.
- ✅ **ETA/distancia** de la ruta (de distance_miles/duration_minutes del quote).
- ✅ Tarjeta del chofer: subtítulo "Chofer profesional" + botón "Compartir viaje"
  (navigator.share con fallback a copiar enlace).
- ⬜ FASE 2 (necesitan datos/infra nuevos): tracking GPS en vivo del conductor
  (Sección A), foto + ⭐rating + idiomas del chofer (rating = B.1; foto/idiomas =
  campos nuevos de perfil), acuses de lectura del chat ("visto/respondió").

### B-sexies. Vista del conductor premium + ajustes tracking (2026-06-17)
- ✅ **Portal del conductor rediseñado** (/driver/trips) al mismo universo premium
  oscuro del pasajero: header de marca (logo en caja + nombre + "Portal del
  conductor" + "{driver} · En servicio" + cerrar sesión), y por viaje un layout
  2 columnas (desktop): IZQ = estado actual + progreso del servicio (5 pasos) +
  acción principal; DER = ruta (Waze/Google Maps/Copiar + agregar parada) +
  pasajero (Llamar/WhatsApp/Mensaje) + chat (respuestas rápidas) + soporte
  (contactar dispatch). DriverTripActions/DriverAddStop pasados a tema oscuro.
- ✅ **Tracking**: "Agregar parada" ahora va DENTRO de la tarjeta de ruta.
  Título de pestaña localizado (generateMetadata). Confirmado: no hay textos
  hardcodeados; todo cambia con el selector de idioma (lo que se veía en inglés
  era la página en locale EN, comportamiento correcto).
- ⬜ FASE 2 conductor: foto/idiomas del pasajero, reporte de incidencias del
  conductor (acción nueva), historial de eventos del viaje.

### F. Pago al momento de la reserva (2026-06-16)
✅ El wizard ahora ofrece "Confirmar y pagar ahora" (Stripe Checkout) además de
"Reservar y pagar después", SOLO cuando el operador tiene Stripe Connect
onboarded (onlinePaymentsEnabled). No se piden datos de tarjeta en el formulario
(va por la página segura de Stripe, por PCI). Antes el pago online solo aparecía
en la pantalla de éxito; ahora es parte del paso de confirmación.

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
