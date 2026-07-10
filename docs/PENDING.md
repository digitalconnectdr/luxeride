# LuxeRide — Estado y pendientes

> Actualizado: 2026-07-02. Para retomar el trabajo, leer este archivo +
> docs/COMPETITIVE-ANALYSIS.md + docs/PHASE-2-MOBILE.md.

## ✅ Backlog de desarrollo original — COMPLETO (0–6)
Los 7 ítems que estaban en "Backlog de DESARROLLO" (más abajo) ya están hechos:
limpieza de marca (lib/brand.ts en todo lo nuevo), 2ª pasada i18n del admin,
widget embebible (/embed/[slug]), reviews post-viaje (email + página pública
de calificación), pipeline de cotizaciones (quotes list + /quote/[id] +
follow-up cron), notificaciones a super-admin (nueva solicitud + vencimientos),
PWA branded por empresa (manifest dinámico + service worker). Quedan pendientes
SOLO el #7 (app nativa) y #8 (gaps mayores), ver sección Fase 2 más abajo.

## ✅ Micrositio: sistema de 4 plantillas + contenido multi-idioma (2026-06-26/07-02)
Cada operador elige el diseño de su micrositio en Ajustes → Portada:
- **Noir** (oscuro cinematográfico), **Ivory** (claro editorial, crema+dorado),
  **Bold** (oscuro cálido con acento de marca, inspirado en landings de alquiler
  de autos de lujo — rediseñado tras feedback, la v1 con tipografía sans-black
  y ticker fue rechazada por "poco elegante"), **Corporate** (blanco/grafito,
  minimalista, pensado para cuentas B2B).
- Mismo modelo de datos para las 4 (servicios, flota, reseñas) — solo cambia
  el layout. Selector con preview vía `?preview=<id>` sin guardar el cambio.
- **Contenido real multi-idioma**: slogan, "sobre nosotros" y título/descripción
  de cada servicio ahora tienen pestañas EN/ES/PT en el admin (Ajustes → Portada
  y Ajustes → Servicios). Español vive en las columnas legadas (compatibilidad
  total, cero regresión); inglés/portugués son overrides opcionales guardados
  en columnas/settings JSONB (`i18n`). Fallback: idioma actual → ES → legado.
  Migración 19 (`company_services.i18n`) aplicada en producción 2026-07-02.
- Bugs corregidos en el camino: enlace público roto en 6 lugares (QR del
  micrositio, `start_url` del manifest PWA, canonical/OG, botón volver, link
  compartido en Ajustes, página de reseñas) — todos apuntaban a `/<slug>` en
  vez de `/book/<slug>`; se agregó además una redirección `/[slug]` →
  `/book/[slug]` como red de seguridad para enlaces ya compartidos. Animación
  de entrada (`RevealStagger`) que dejaba tarjetas invisibles tras cambiar de
  idioma sin recargar (`viewport once:true` no se re-disparaba con hijos
  re-keyeados) — cambiado a `once:false`. Página informativa de marca en vez
  de 404 genérico para empresas en trial/suspendidas/canceladas
  (`MicrositePending`), en `/book/[slug]`, `/reservar` y `/embed/[slug]`.
- Pendiente (mejora futura, sin pedir aún): extender el mismo patrón i18n a
  nombres/amenities de vehículos si se pide; aplicar traducciones EN/PT reales
  a los servicios de las empresas demo (hoy caen al fallback ES).

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
3. **Vercel env vars** (opcionales, activan features — verificado 2026-07-08
   que degradan limpio sin romper nada si faltan): RESEND_API_KEY +
   RESEND_FROM_EMAIL (key ya existe, dominio por verificar en resend.com —
   sin esto, `lib/notifications/index.ts` deja las notificaciones en status
   `pending` sin enviar, no falla), CRON_SECRET (facturación corporativa +
   alertas de documentos). ✅ **UPSTASH_REDIS_REST_URL/TOKEN configurado
   (2026-07-09)** — rate limit ya corre distribuido sobre Redis en
   producción (verificado: contador de Commands en el dashboard de Upstash
   sube al probar login), en vez del fallback en memoria por instancia.
4. **Stripe real** cuando haya clientes: keys + webhook
   (/api/stripe/webhook) + habilitar Connect en dashboard.stripe.com.
5. **Twilio** (SMS) cuando se quiera activar — mismo patrón placeholder-safe,
   sin las 3 env vars (`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
   `TWILIO_FROM_NUMBER`) los SMS simplemente no salen.
6. Probar /super-admin/subscriptions con el usuario super_admin.
7. **Páginas de Privacy Policy y Terms of Service** — ✅ completado
   2026-07-08: `/privacy` y `/terms`, contenido real en EN/ES/PT (no
   placeholder), enlazadas desde el footer del landing y en el sitemap.
   Incluye deslinde explícito de que el Compliance Center no certifica
   cumplimiento regulatorio. En el camino se corrigió un bug real:
   `middleware.ts` reescribía `/privacy`/`/terms` como link corto de
   operador (`/<slug>` → `/book/<slug>`) al no estar en
   `RESERVED_SEGMENTS` — ya agregado. Nota: contenido genérico de SaaS,
   no es asesoría legal — recomendar revisión por un abogado antes de
   considerarlo vinculante.

## ⬜ Funciones grandes pospuestas (decisión 2026-06-14: bugs primero)

Observaciones 10 y 12 del usuario — features nuevas que requieren tablas +
realtime + geolocalización. Plan para una fase dedicada:

### A. Dispatch avanzado (obs. 10) — ✅ HECHO (2026-07-03)
Implementado con desviaciones deliberadas del plan original abajo (confirmadas
con el usuario antes de construir) — ver ítem 9 más abajo para el detalle
completo de lo construido. Diferencias clave: (a) el mapa en vivo reutiliza
`trip_locations` (ya existía, no se creó `drivers.current_lat/lng`); (b) los
rechazos/incidentes NO se agregaron como estados nuevos de `booking_status`
— se registran en la tabla `booking_events` (punto 4 de abajo) mientras la
reserva vuelve a un estado ya existente, evitando tocar el enum que se usa en
~15 archivos distintos.
1. ~~Mapa en vivo~~ en el Dispatch Board: ubicación de conductores
   (drivers.current_lat/lng vía web push del navegador del conductor o la
   futura PWA) + pins de los pickups pendientes. Usar Google Maps JS
   (ya tenemos la key) o Mapbox. Realtime de Supabase para mover los pines.
2. ~~Estados de rechazo / incidente~~: agregar a booking status
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
4. ✅ **PWA branded por empresa** (HECHO 2026-07-09): manifest dinámico por
   empresa ya existía para pasajero (`/manifest/[slug]`) y conductor
   (`/manifest/driver/[slug]`); se agregó el que faltaba para el panel admin
   (`/manifest/admin/[slug]`, enlazado vía `generateMetadata` en
   `app/admin/layout.tsx`) — nombre, iconos = logo del cliente, theme_color =
   primary_color, en los 3 portales.
Branding en dashboard: ✅ logo en el sidebar (2026-06-14). ✅ primary_color
aplicado a los acentos del panel admin (HECHO 2026-07-09): variable CSS
`--color-bronze` inyectada en `app/admin/layout.tsx` + `tailwind.config.ts`
(`bronze.DEFAULT: var(--color-bronze, #8a6520)`) — los ~52 archivos que ya
usaban clases `bronze`/`gold` se re-temáticos automáticamente por operador,
sin tocarlos uno por uno. Scoped solo a `/admin/*` (super-admin/auth/
dispatcher mantienen la marca propia de LuxeRide).

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
1. ✅ **Calificaciones bidireccionales (HECHO 2026-07-03)**: bookings.rating ya
   existía (cliente→conductor). Se agregó el espejo driver_rating/
   driver_rating_comment/driver_rated_at (conductor→cliente, uso interno, nunca
   se muestra al pasajero) — el conductor lo hace desde /driver/trips en una
   sección "Califica a tus pasajeros recientes" que aparece para viajes
   completados en los últimos 7 días sin calificar. drivers.rating (existía
   desde la migración 04 pero nunca se actualizaba) ahora se recalcula por
   trigger cada vez que cambia bookings.rating. Métricas de puntualidad
   (% de llegadas dentro de 10 min del horario) y cancelaciones/no-show,
   calculadas dinámicamente (sin columnas nuevas, mismo enfoque que
   total_trips), visibles en /admin/drivers/[id]. Migración 21.
2. ✅ **Chat cliente↔conductor (HECHO 2026-06-16, mejorado 2026-07-03)**:
   implementado como tabla `trip_messages` (booking_id, company_id, sender
   'client'|'driver', body, created_at, read_at) en vez del nombre tentativo
   `booking_messages`. RLS: el conductor asignado lee/escribe sus viajes;
   admin/owner/dispatcher LEEN (auditable ✅). El pasajero escribe sin login vía
   server actions con service-role validando el UUID de la reserva (capability
   URL). UI: panel de chat en /track/[id] (lado cliente) y en /driver/trips
   (lado conductor). Componente reutilizable components/trip/trip-chat.tsx.
   Migración 18. **Mejoras 2026-07-03** (migración 21): trip_messages agregada
   a Realtime (ya no depende solo de polling — queda un polling lento de 20s
   como respaldo); acuses de lectura reales (el campo read_at existía sin
   usarse) con "✓ visto" bajo los mensajes propios; vista de solo lectura para
   el operador en /admin/messages (lista de hilos por reserva) y
   /admin/messages/[id] (conversación completa), para supervisión y soporte.
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

### B-septies. Ajustes finos tracking/conductor (2026-06-17/18)
- ✅ Pasajero: módulos dentro de un contenedor exterior (como el conductor);
  tamaños de header (logo 44px + título semibold) igualados en ambas vistas.
- ✅ Conductor: tema claro Ivory; **selector de idioma EN/ES/PT** con i18n COMPLETO
  (nueva sección dict.driver; DriverTripActions/DriverAddStop reciben labels).
- ✅ Conductor: **mapa estático** (pickup A → destino B) igual que el pasajero,
  con variante clara (StaticMap light). Requiere "Maps Static API" habilitada.

### F. Pago al momento de la reserva (2026-06-16)
✅ El wizard ahora ofrece "Confirmar y pagar ahora" (Stripe Checkout) además de
"Reservar y pagar después", SOLO cuando el operador tiene Stripe Connect
onboarded (onlinePaymentsEnabled). No se piden datos de tarjeta en el formulario
(va por la página segura de Stripe, por PCI). Antes el pago online solo aparecía
en la pantalla de éxito; ahora es parte del paso de confirmación.

### G. LuxeRide Affiliate Network — farm-out/farm-in entre operadores (Fase 1 ✅ implementada 2026-07-09)

**Implementado (Fase 1 — MVP privado):**
1. Migración `20260709000039_affiliate_network.sql`: `companies.affiliate_network_enabled`
   (+ `_at`, backfill TRUE para elite/enterprise existentes), `company_affiliates`
   (relación bidireccional con aprobación manual), `affiliate_trips` (solicitud/
   viaje — booking, precio ofrecido/contraofertado/acordado, margen, vista
   previa limitada antes de aceptar, liquidación), `affiliate_messages` (chat
   comercial + operativo), `affiliate_network_leads` (autoservicio, mismo
   patrón que `enterprise_leads`).
2. `lib/affiliates/engine.ts` (17 tests): tiempo límite de respuesta (10min/
   30min/2h según cercanía del viaje), cálculo de margen, transiciones de
   estado operativo, texto de marca según `branding_mode`.
3. `app/actions/affiliates.ts`: relación (invitar por slug/aprobar/rechazar/
   revocar/editar términos), enviar viaje a afiliado, responder (aceptar/
   rechazar/contraofertar), resolver contraoferta, asignar conductor/vehículo
   propio del afiliado, avanzar estado operativo, liquidación manual,
   mensajería, interruptor de monetización (super-admin) + lead de
   autoservicio.
4. UI: `/admin/affiliates` (gestionar relaciones + upsell si no está
   habilitado), `/admin/affiliates/requests` (bandeja de solicitudes
   entrantes — responder, asignar, operar, liquidar, chat), tarjeta "Enviar a
   afiliado" en `/admin/bookings/[id]`, interruptor en
   `/super-admin/companies/[id]`, `/super-admin/affiliate-leads`.
5. **Invariante respetada:** `bookings.company_id/driver_id/vehicle_id/status`
   nunca se tocan — el viaje afiliado vive enteramente en `affiliate_trips`.
   `/track/[id]` sobreescribe SOLO la vista del pasajero (estado, conductor,
   vehículo, línea "Operado por") cuando hay un `affiliate_trip` activo,
   leyendo de `affiliate_trips`, sin mutar el booking original. `/driver/trips`
   muestra los viajes afiliados asignados a ese conductor en una sección
   aparte (no se mezclan con `bookings`, evita conflictos de RLS/company_id
   entre las acciones existentes del conductor y una empresa afiliada
   distinta).

**Fuera de esta ronda (recortes de alcance conscientes, no bloquean lo anterior):**
- ✅ **Tracking GPS en vivo compartido para viajes afiliados — HECHO
  2026-07-10.** Bug real encontrado al implementarlo: `bookings.status`
  NUNCA avanza para un viaje farmed-out (invariante de la Sección G), así que
  el gate `isActive`/`getLiveTripPositionsAction`/`activateLiveMapSessionAction`
  en `/track/[id]` y `app/actions/live-tracking.ts` (que comparaban contra
  `booking.status` directo) ocultaba el mapa en vivo por completo para
  cualquier viaje afiliado que arrancó sin conductor interno asignado — no
  era solo que faltara el lado de ESCRITURA. Arreglado en ambos lados:
  `reportDriverLocation` ahora acepta también al conductor de un
  `affiliate_trips` activo (no solo `bookings.driver_id`), y las lecturas
  (`isActive`, `inMotion`, `allowPassengerShare`) ahora usan `displayStatus`
  (ya calculado con el override de afiliados) en vez de `booking.status`
  crudo. Reportado desde `/driver/trips` (web, `AffiliateTripCard` monta
  `LiveLocationReporter`) y desde la app móvil (`AffiliateTripDetailScreen`
  monta `useDriverLocationReporter`). El pasajero en `/track/[id]` ve el
  mismo mapa interactivo que en un viaje propio, sin cambios de UI.
- **Sin notificaciones por email/SMS** de eventos de afiliados (nueva
  solicitud, aceptada, rechazada) — visibilidad hoy es 100% in-app
  (bandeja + Realtime) + push nativo (app móvil). Requeriría nuevas
  plantillas en `notification_templates`. Sigue sin construir.
- **Autoservicio: código 100% listo, falta que el usuario cree el producto
  en Whop.** Investigado a fondo 2026-07-10: `isAffiliateAddonPlan()`, el
  webhook (`app/api/webhooks/whop/route.ts`) y la UI
  (`AffiliateNetworkUpsell`) ya están completos y funcionando — el
  "checkout" de TODOS los planes en este proyecto (no solo el addon) es una
  URL estática pegada en una env var, nunca generada dinámicamente por
  código; no hay nada más que escribir. Falta únicamente que el usuario cree
  el producto ($29/mes ya decidido) en su dashboard de Whop y dé dos
  valores: `WHOP_PLAN_ID_AFFILIATE_ADDON` y `WHOP_CHECKOUT_URL_AFFILIATE_ADDON`
  (ninguno configurado hoy en producción) — sin eso, seguirá mostrando el
  formulario de lead en vez del botón de pago real.
- ✅ **Fase 2 — Portal de afiliado externo: MVP construido y desplegado
  2026-07-10** (migración `20260710000045_affiliate_external_invite.sql`,
  aplicada en producción por el usuario). `companies.is_external_affiliate` + tabla
  `affiliate_invite_tokens` (capability-URL de un solo uso, mismo patrón que
  `bookings.id` en `/track/[id]`). Flujo: una empresa genera un link desde
  `/admin/affiliates` (`createAffiliateInviteAction`) → el afiliado externo
  entra a `/affiliate/join/[token]` (página pública, sin cuenta previa) →
  completa un alta real (empresa + dueño), reusando el mismo patrón de
  `signupAction` — se crea una fila normal en `companies`
  (`is_external_affiliate = true`, sin plan de LuxeRide) y su
  `company_affiliates` queda YA aprobada (fue invitación explícita, no pasa
  por el flujo de solicitar/aprobar del marketplace interno). El conductor y
  vehículo del afiliado se registran en las MISMAS tablas `drivers`/
  `vehicles` de siempre — nada de texto libre. **Whop Connect obligatorio
  antes de aceptar pagos**: `respondToAffiliateTripAction` bloquea la
  decisión `'accept'` con un error explícito si
  `is_external_affiliate && !whop_connect_onboarded` — cierra la brecha de
  pago sin verificación que el usuario había rechazado en el diseño
  original. El sidebar de `/admin` oculta Dispatch/Zonas/Precios/Reservas/
  Reportes/Corporativo/Compliance para estas cuentas (solo ven Flota,
  Afiliados, Equipo y Configuración — ahí ya está el bloque existente de
  "Conectar Whop" reusado tal cual, sin código nuevo). **Recorte consciente
  de esta ronda**: `/admin/dashboard` no tiene una vista dedicada para
  afiliados externos, solo muestra contadores en cero (no rompe, pero no es
  útil) — dejarlo así hasta que haya feedback real de uso. Fases 3 (pools),
  4 (bidding) y 5 (auto-farm) siguen sin construir — ver diseño completo
  abajo.

Pedido original: explorar cómo resuelven esto Limo Anywhere (**LA Net**) y
**GroundXchange**. Diseño inicial (LA Net/GroundXchange) reemplazado por uno
más completo, basado en un documento propio del usuario ("LuxeRide Affiliate
Network") que describe el módulo con el nivel de detalle de un producto real,
no solo una feature. Investigación + diseño hechos; Fase 1 (MVP privado) ya
construida — ver el resumen arriba; Fases 2-5 siguen sin construir.

**Por qué LuxeRide parte con ventaja estructural:** todas las empresas de
LuxeRide ya comparten el MISMO esquema (`vehicle_types`, `service_zones`,
`bookings`, `drivers`) — no hace falta el "mapeo" manual que sí necesita
GroundXchange (o incluso LA Net entre afiliados de distinta instalación).
Infraestructura ya existente y reutilizable: `booking_events` (bitácora),
`trip_messages`/Realtime (chat), `lib/dispatch/auto-assign.ts` (fase
auto-farm), Whop Connect `application_fee_amount` (split, fase avanzada —
ver Liquidación abajo).

**Alcance del MVP: SOLO LuxeRide↔LuxeRide**, estrictamente opt-in entre
empresas que se aprueban mutuamente — nunca un directorio público (coherente
con la decisión de white-label puro del 2026-06-14). El portal de afiliado
externo sin cuenta (sección "Fase 2" más abajo) es una extensión posterior,
no parte del MVP.

**Diferencia clave vs. el diseño anterior — el viaje afiliado es una
entidad separada, no una reasignación.** El diseño viejo reasignaba
`company_id`/`vehicle_id`/`driver_id` directamente en el booking original,
lo cual le "quitaba" el viaje del panel a la empresa que lo originó — rompe
la idea central de que la empresa principal mantiene la relación comercial
con el pasajero. El diseño correcto: se crea una fila en una tabla nueva
(`affiliate_trips`) que vincula el booking original con la empresa afiliada;
ambas empresas ven el mismo viaje desde su propia perspectiva (una como
"enviado", la otra como "recibido"), sin que nadie pierda visibilidad.

**Flujo correcto: solicitud → aceptación, no transferencia directa.** El
diseño anterior no tenía un paso real de consentimiento del afiliado. El
correcto:
1. Dispatcher entra a una reserva sin cobertura y pulsa **"Enviar a
   afiliado"** (motivo: sin conductor, fuera de zona, sobrecapacidad, mejor
   tarifa del afiliado, etc. — queda en `booking_events`).
2. Define **precio a pagar al afiliado** y ve el margen calculado (precio ya
   cobrado al pasajero − payout al afiliado − fee de plataforma, si aplica).
3. Elige uno o varios afiliados (de su lista de `company_affiliates`
   aprobados) y envía la solicitud — con **tiempo límite de respuesta**
   (ej. 10 min si es hoy, 30 min si es mañana, 2h si es a futuro).
4. **Antes de aceptar**, el afiliado solo ve: zona aproximada, fecha/hora,
   tipo de vehículo, pasajeros, precio ofrecido, distancia/duración
   estimadas — **nunca** nombre completo, teléfono ni dirección exacta del
   pasajero (protege a la empresa principal de que el afiliado se quede con
   el cliente).
5. El afiliado acepta, rechaza, o contraoferta un precio distinto.
6. Al aceptar: se revela el detalle completo (pickup/dropoff exactos,
   nombre, teléfono si está permitido, notas, vuelo), se crea la fila en
   `affiliate_trips`, y si se envió a varios afiliados a la vez, los demás
   pasan automáticamente a "Closed / Awarded to another affiliate" (evitar
   doble aceptación).
7. El afiliado asigna su propio conductor/vehículo y actualiza estados
   (en camino, llegó, en viaje, completado) — visibles para la empresa
   principal en tiempo real.
8. Al completar, se genera la liquidación pendiente (ver abajo).

**Modos de marca frente al pasajero** (nuevo, no estaba en el diseño
anterior) — reutiliza el sistema de branding blanco por empresa que
LuxeRide ya tiene:
- **White-label total**: el pasajero solo ve la marca de la empresa
  principal ("Tu viaje con Revival está confirmado").
- **Operated by**: se muestra "Operado por: [Empresa afiliada]" (por
  transparencia/compliance, si el operador lo prefiere).
- **Co-branded**: "Reservado por Revival. Operado por [Afiliado]."
  La empresa principal elige el modo por defecto en Configuración.

**Liquidación (Settlement) — manual primero, no automática.** El diseño
anterior asumía que el split de pago por Whop Connect
(`application_fee_amount`) resolvería esto automáticamente — poco realista,
porque exige que AMBAS empresas estén en Whop con la estructura compatible.
El MVP debe llevar su propio registro de liquidación dentro de LuxeRide:
monto cobrado al pasajero, payout al afiliado, fee de plataforma (si
aplica), estado (`pending`/`invoiced`/`paid`/`disputed`), método de pago,
fecha. El split automático por Whop queda como mejora de fase avanzada,
solo entre empresas que ya tengan Whop Connect activo mutuamente.

**Tabla de perfil de afiliado — reutiliza compliance-lite de la sección J.**
El documento propone un perfil de afiliado con cobertura (ciudades,
aeropuertos, zonas), servicios, tipos de vehículo, términos de pago
(Net 7/15/30, comisión fija o %), y compliance ligero (estado de seguro,
licencia operativa, fecha de última verificación). Estos últimos campos son
literalmente los mismos que ya se diseñaron en la sección J (Compliance
Center) — no duplicar, reusar esa misma tabla/campos cuando se construya.

**Canales de comunicación (4, no uno genérico):**
1. Empresa principal ↔ empresa afiliada (términos comerciales, cambios).
2. Dispatcher ↔ dispatcher (operativo: "¿conductor asignado?", "vuelo con
   retraso").
3. Conductor afiliado ↔ su propio dispatcher (interno de esa empresa).
4. Pasajero ↔ conductor — solo si la empresa principal lo permite
   explícitamente.
Todos reusan `trip_messages`/Realtime, solo cambia el `sender`/scope.

**Monetización — feature de pago, activable en dos niveles** (pedido
explícito del usuario):
- **Super-admin**: interruptor por empresa (`affiliate_network_enabled` +
  fecha de activación) en `/super-admin/companies/[id]` — para dar acceso
  manual, cortar por impago o abuso, o incluirlo gratis en cuentas
  Enterprise negociadas.
- **Autoservicio**: cada empresa puede activarlo y pagarlo ella misma desde
  `/admin/settings` (nueva tarjeta "LuxeRide Affiliate Network"), mismo
  patrón que ya existe para el checkout de Whop de los planes —
  probablemente vía un plan/producto de Whop dedicado, no parte del plan
  base.
- **Precio decidido (2026-07-09): $29/mes**, plano para Starter y
  Professional (Elite/Enterprise lo incluyen sin costo). Precio deliberadamente
  bajo — la prioridad es maximizar adopción/volumen de viajes farm-out/farm-in,
  no maximizar el ARPU del add-on en sí: cada viaje que pasa por la red de
  afiliados paga la comisión normal de plataforma, así que más empresas
  activadas y más viajes moviéndose entre operadores vale más que cobrar caro
  por el acceso. Checkout real vía Whop implementado (ver Sección G más abajo /
  `lib/billing/whop.ts` → `isAffiliateAddonPlan`, `affiliate_network_whop_membership_id`);
  falta que el usuario cree el producto en Whop con este precio y pase el plan ID
  + checkout URL para activarlo end-to-end.

**Plan de implementación (fases, actualizado):**
1. **Fase 1 — MVP privado.** Tabla `company_affiliates` (relación
   bidireccional con aprobación manual) + tabla `affiliate_trips` (booking
   original, empresa afiliada, precio cobrado, payout, margen, estado de
   solicitud, estado de liquidación). Acción "Enviar a afiliado" con
   aceptar/rechazar manual, un solo afiliado a la vez. Chat 1 y 2. Reporte
   básico de farm-in/farm-out. Liquidación manual. El interruptor de pago
   (super-admin + autoservicio) se construye en esta fase, no después.
2. **Fase 2 — Portal de afiliado externo (revisado 2026-07-08 según
   feedback del usuario: sin texto libre, sin brecha sin Whop).** El diseño
   original de esta fase permitía a un afiliado sin cuenta LuxeRide escribir
   conductor/vehículo como texto libre y liquidar todo manualmente sin pasar
   por Whop — el usuario lo rechazó explícitamente por dos razones: (a) no
   quiere datos sin estructura para algo tan operativo como conductor/
   vehículo, y (b) no quiere abrir una brecha de pago sin verificación por
   Whop. Diseño corregido:
   - El afiliado externo completa un **registro mínimo pero real**, no un
     link anónimo de un solo uso: se le crea una fila normal en `companies`
     (marcada `is_external_affiliate = true`, sin plan/suscripción de
     LuxeRide) a través de un flujo de alta ligero. Esto es clave — al ser
     una `company` real, su conductor y vehículo se registran en las MISMAS
     tablas `drivers`/`vehicles` que ya existen (con validación, no texto
     libre), reutilizando todo el modelo de datos en vez de inventar uno
     paralelo.
   - **Whop Connect es obligatorio antes de poder aceptar cualquier
     solicitud paga** — no hay ruta de "aceptar sin Whop y liquidar a mano
     después". Si el afiliado externo no completó el onboarding de Whop
     Connect, puede ver la invitación y el directorio, pero el botón de
     aceptar queda bloqueado hasta conectar Whop. Esto cierra por completo
     la brecha de pago sin verificación que preocupaba al usuario.
   - El acceso operativo del día a día (ver solicitudes entrantes, aceptar/
     rechazar, asignar su conductor/vehículo ya registrado, actualizar
     estado) puede seguir siendo un portal simplificado por link seguro
     (mismo patrón de capability-URL que `/track/[id]`) — no necesita el
     dashboard completo de un cliente LuxeRide pagante, pero los datos que
     maneja ya no son texto libre ni están fuera del esquema.
   - Sigue siendo el diferenciador más fuerte del documento original, y
     sigue yendo DESPUÉS del MVP (fase separada) — la corrección de este
     feedback no cambia el orden de fases, solo el diseño interno de esta
     fase específica.
3. **Fase 3 — Pools.** Enviar a un grupo de afiliados a la vez (por ciudad,
   aeropuerto, tipo de vehículo, rating) en vez de uno por uno; el primero
   que acepta gana, expiración automática de los demás.
4. **Fase 4 — Bidding.** El afiliado puede contraofertar un precio distinto
   al ofrecido; el dispatcher compara y elige.
5. **Fase 5 — Auto-farm.** Extender `lib/dispatch/auto-assign.ts`: si no hay
   conductor propio disponible o la reserva cae fuera de `service_zones`,
   buscar automáticamente entre afiliados aprobados con cobertura y tipo de
   vehículo compatible, por reglas (zona, rating, precio máximo, margen
   mínimo) — antes de dejar la reserva sin asignar.
6. **Score de confiabilidad por afiliado** (transversal, se puede sumar en
   cualquier fase): puntualidad, cancelaciones, tiempo de respuesta —
   mismo cálculo que ya existe por conductor en `/admin/drivers/[id]`, para
   que Fase 5 priorice al afiliado con mejor historial.

**Diferenciadores reales frente a LA Net/GroundXchange** (según el
documento, validados): link externo sin cuenta para afiliados (punto 2),
chat por viaje en vez de solo email, protección de datos del pasajero antes
de aceptar, tracking en vivo compartido (mapa real, no solo texto de
estado — ninguna competencia lo ofrece hoy), liquidación clara desde el
inicio (cliente paga X / afiliado recibe Y / margen Z visible antes de
enviar la solicitud, no reconciliado por fuera del sistema como hacen LA
Net y GroundXchange).

### H. Gaps vs. Taxi Web Design (investigado 2026-07-06, ✅ completado 2026-07-08)
Comparación directa contra Taxi Web Design (competidor con apps nativas,
modelo cero-comisión). LuxeRide ya iguala o supera su motor de precios
(zonas con códigos postales), cuentas corporativas con facturación
mensual, dispatch board con auto-asignación y mapa en vivo, y el widget
embebible. Los 4 gaps identificados:

1. **✅ Importación masiva por CSV — solo flota.** `lib/csv.ts` (parser
   propio, sin dependencia) + `importVehiclesCsvAction`: sube un CSV
   (máx. 500 filas/1MB), valida make/model/year/plate_number, resuelve
   `vehicle_type` por nombre (opcional) e inserta en lote. Filas
   inválidas se reportan sin abortar el resto. Botón en `/admin/fleet`
   con plantilla descargable.
   **Pendiente aparte**: reglas de precio — el modelo de datos varía
   mucho según el tipo de tarifa (flat_rate, per_mile, per_km, hourly,
   zone_based), un CSV genérico necesita más diseño antes de construirse.
2. **✅ Programador de mantenimiento por vehículo.** Los campos
   (`mileage`, `last/next_maintenance_at`, `insurance_expires_at`) ya
   existían desde la creación del vehículo pero no eran editables después.
   `updateVehicleMaintenanceAction` los actualiza (y registra en
   `maintenance_records` si cambia `last_maintenance_at`); tarjeta
   editable en `/admin/fleet/[id]`; badge ⚠ en la lista principal cuando
   vence en <14 días.
3. **✅ Fechas bloqueadas / horario de operación.** Nuevo en
   `settings.booking` (JSONB, sin migración): `operating_hours_start/end`
   (HH:mm, hora local vía `Intl.DateTimeFormat`) + `blackout_dates`
   (lista YYYY-MM-DD). Validado en `parseOperatingHours` +
   `validateOperatingHours` (`lib/policy/engine.ts`), aplicado en los dos
   puntos de entrada públicos (cotización inicial y creación de reserva)
   — no en el flujo de admin, donde el staff puede reservar fuera de
   horario a propósito. UI en `/admin/settings`.
4. **✅ Terminar "Meet & Greet".** La columna `bookings.meet_and_greet`
   ya existía; ahora tiene checkbox en el wizard público (solo
   `airport_pickup`) y en `/admin/bookings/new`, badge visible en el
   detalle de reserva y en el portal del conductor. i18n EN/ES/PT.

### I. Experiencia del pasajero recurrente — sin cambiar la filosofía "sin instalar nada" (investigado 2026-07-06, ✅ completado 2026-07-08)
Duda del usuario: el PWA del conductor se ofrece instalar solo (manifest +
service worker en `/manifest/driver/[slug]` + `/driver/trips`), pero el del
pasajero (`/manifest/[slug]` + `/book/[slug]`) no lo hace visible aunque
también está correctamente cableado. **No es un bug**: Chrome/Safari solo
muestran el banner de instalación tras suficiente "engagement" (visitas
repetidas), algo que el conductor acumula (usa el portal a diario) y el
pasajero no (escanea el QR una vez). Es coherente además con el FAQ del
landing: *"¿Tengo que instalar algo? No."* ([es.ts:219](../apps/web/lib/i18n/dictionaries/es.ts)) — mensaje de venta
deliberado contra apps tipo Uber/Cabify.

El problema real planteado: un viajero frecuente hoy re-escribe su nombre y
re-hace el pago completo en cada reserva. Se puede resolver sin exigir
cuenta/login ni instalar nada, en 3 capas (orden por esfuerzo):

1. **Autocompletar local (sin backend nuevo)**: guardar nombre/teléfono/
   email en `localStorage` al confirmar una reserva y precargar el
   formulario en la próxima visita al mismo `/book/<slug>` desde el mismo
   dispositivo/navegador.
2. **Reconocer por teléfono (cross-device)**: como el teléfono ya es
   obligatorio en el wizard, buscar server-side por
   `company_id + passenger_phone` la última reserva y ofrecer "¿Eres
   Juan? Usar los mismos datos" con un clic — sin contraseña ni cuenta.
3. **Tarjeta guardada vía Whop** (la pieza de más impacto — confirmado
   contra `node_modules/@whop/sdk/resources/*.d.ts`, no es suposición):
   - `checkoutConfigurations.create({ mode: 'setup' })` guarda una tarjeta
     sin cobrar nada (genera un `SetupIntent`); el checkout normal de pago
     también puede guardarla si el pasajero lo permite.
   - `paymentMethods.list({ member_id })` lista las tarjetas guardadas de
     ese pasajero para esa empresa (marca, últimos 4, vencimiento).
   - `payments.create({ company_id, member_id, payment_method_id, plan })`
     — cobro off-session con la tarjeta guardada, sin checkout nuevo. Este
     es el método clave para "Pagar con tarjeta •••1234" en un clic.
   - El "member" de Whop es **por empresa conectada**: un pasajero que
     viaja con la Empresa A y la Empresa B es un member distinto en cada
     una — correcto y coherente con el modelo white-label (tarjeta guardada
     por operador, no global en LuxeRide).

   Trabajo pendiente del lado LuxeRide (nada de esto existe hoy —
   `lib/whop/checkout.ts` solo crea checkouts de un solo uso):
   - Tabla nueva ligera `passenger_whop_members` (company_id, phone o
     email, whop_member_id) para asociar al pasajero con su member de Whop
     tras el primer pago.
   - En la siguiente reserva, si existe member con tarjeta guardada →
     botón directo "Pagar con tarjeta •••1234" (llama `payments.create`),
     con "usar otra tarjeta" como respaldo al checkout completo de siempre.
   - **Permisos del API key de Whop**: verificar que `WHOP_API_KEY` tenga
     `payment:charge`, `member:payment_methods:read` y
     `payment:setup_intent:read` habilitados en el dashboard de Whop antes
     de construir — el usuario lo está revisando directamente.
     ✅ CONFIRMADO 2026-07-07: el key "LuxeRide Platform" hereda del rol
     Propietario y tiene los 3 permisos (más el set completo de Payments).
     Sin bloqueo técnico — listo para implementar cuando se priorice.

### J. Compliance Center — datos regulatorios EE.UU. ✅ completado 2026-07-08
Implementado tal cual el plan de abajo, las 6 fases:
1. Migración `20260708000034_compliance_center.sql` — columnas indexables
   (fechas/estados que consulta el cron) + JSONB `compliance` en `companies`,
   `drivers` y `vehicles`. Aditivo, sin tocar nada existente. Nota de diseño:
   `manual_review_required` NO quedó como columna — se deriva de
   `compliance_last_reviewed_at IS NULL` (misma idea, un campo menos que
   mantener sincronizado, igual para las 3 entidades).
2. `lib/compliance/engine.ts` — funciones puras `computeDriverCompliance`,
   `computeVehicleCompliance`, `computeCompanyCompliance` (score 0-100,
   deducciones por vencimiento/campo faltante, `blocked` + `blockReason`).
   La empresa NUNCA se bloquea automáticamente, solo se alerta (`alert`).
   13 tests con Vitest (`lib/compliance/engine.test.ts`), sin tocar la DB.
   `lib/compliance/recompute.ts` hace el glue con Supabase (recalcula y
   persiste `compliance_status/score/operational_block/block_reason` tras
   cada edición, y en cascada recalcula la empresa cuando cambia un
   conductor/vehículo de su flota).
3. UI operador: `/admin/compliance` (identidad legal, licencia operativa
   for-hire, USDOT/MC, seguro comercial de la empresa, notas internas) +
   secciones nuevas en `/admin/drivers/[id]` (permiso chauffeur/for-hire,
   clase de licencia) y `/admin/fleet/[id]` (permiso for-hire del vehículo,
   inspección, aseguradora/póliza) — badge de estado + score + motivo de
   bloqueo visible en los tres lugares. Link nuevo en el sidebar
   ("Compliance", sección Management, owner/admin).
4. `/super-admin/compliance` — Compliance Review Queue: empresas,
   conductores y vehículos que no están `compliant` o nunca se revisaron,
   con botón "Marcar revisada" (aprobación admin una sola vez, dispara el
   recálculo). Link nuevo en el sidebar de super-admin.
5. Cron diario `/api/cron/compliance-alerts` (mismo patrón que
   `document-alerts`, protegido con CRON_SECRET): recalcula compliance de
   todos los conductores/vehículos/empresas (captura vencimientos por el
   paso del tiempo aunque nadie edite el registro) y avisa por email lo que
   vence dentro de 30 días — al conductor (permiso chauffeur, reutilizando
   el template `driver_document_expiring`) y al operador (permiso for-hire/
   seguro del vehículo, licencia operativa/seguro de la empresa, vía el
   helper nuevo `sendOperatorEmail` en `lib/notifications` — envío directo
   sin pasar por el sistema de templates, ya que el contenido varía por
   empresa). Agregado a `vercel.json`.
6. Enforcement: `lib/dispatch/auto-assign.ts` excluye conductores
   bloqueados (`operational_block`) y también a los conductores cuyo
   vehículo actual esté bloqueado (antes de elegir candidato, no después).
   `assignDriverAction` (asignación manual desde el Dispatch Board) hace la
   misma validación y devuelve el motivo exacto del bloqueo como error.

Typecheck, 77 tests (Vitest) y build de producción verificados. Migración
pendiente de aplicar en Supabase (requiere confirmación del usuario antes
de correr el SQL).

<details>
<summary>Diseño original (histórico)</summary>

Fuente: documento del usuario "Estructura recomendada del LuxeRide
Compliance Center" (Word, 2026-07-07). Objetivo: datos confiables de las
empresas que adquieran LuxeRide y posicionamiento serio como competidor
en EE.UU. (Sunbiz/Florida, condados Miami-Dade/Broward, FMCSA/USDOT).
Decisión del documento: NO subir documentos por ahora — solo campos
estructurados + fechas de vencimiento + estados de verificación +
bloqueo operativo calculado.

**Lo que YA existe** (no duplicar en la implementación):
- `companies`: teléfono, email, dirección, ciudad, país, zona horaria,
  moneda — falta toda la identidad legal y regulatoria.
- `drivers`: `license_number`, `license_expiry`, `license_state` — falta
  el permiso chauffeur/for-hire y el motor de elegibilidad.
- `vehicles`: VIN, `mileage`, `last/next_maintenance_at`,
  `insurance_expires_at` (con warning visual en `/admin/fleet/[id]`) y la
  tabla `maintenance_records` — falta permiso for-hire, inspección y
  datos de póliza estructurados.
- Cron `document-alerts` — patrón directamente reutilizable para el
  barrido diario de vencimientos.

**Lo que FALTA (MVP del documento, resumido)**:
- Empresa: nombre legal, DBA, tipo de entidad, estado de registro, número
  de registro estatal (cruce con Sunbiz), EIN últimos 4, condado, ZIP,
  áreas/aeropuertos/tipo de operación, licencia operativa for-hire
  (tipo/número/jurisdicción/vencimiento/estado), ¿opera entre estados? +
  USDOT/MC/estado FMCSA, seguro comercial (aseguradora/vencimiento/estado).
- Conductor: permiso chauffeur/for-hire (tipo/número/jurisdicción/
  vencimiento/estado), clase de licencia, elegibilidad calculada
  ("puede recibir viajes" + motivo).
- Vehículo: permiso for-hire del vehículo, inspección (fecha/estado),
  póliza estructurada, capacidad de equipaje, "puede ser asignado" +
  motivo de bloqueo.

**Motor de cumplimiento (calculado, no manual)** — 3 capas del documento:
declarado (lo llena el cliente) → calculado (reglas: vencimientos, campos
faltantes) → revisado (aprobación admin una sola vez + excepciones).
Campos internos: `compliance_status` (Compliant/Partial/At Risk/
Non-Compliant/Pending Review), `compliance_score` 0-100 (100 base menos
deducciones: -30 licencia vencida, -25 seguro vencido, -15 sin
jurisdicción, etc.), `risk_level`, `operational_block` + `block_reason`,
`manual_review_required`, `verification_status`, `last_reviewed_at`,
`next_review_at`, `reviewed_by`, `internal_notes`.

**Reglas de bloqueo**: conductor bloqueado si licencia o permiso vencido
o suspendido; vehículo bloqueado si seguro/permiso/inspección vencidos o
en mantenimiento; empresa alertada (no bloqueada automáticamente) si
licencia operativa o seguro comercial vencen, o si >X% de su flota está
vencida. El admin solo ve una cola de revisión (Compliance Review Queue),
no revisa campo por campo.

**Plan de implementación por fases** (sin romper lo construido — todo es
aditivo):
1. Migración: columnas de fechas/estados indexables (vencimientos que el
   cron consulta) + JSONB `compliance` para el resto de campos MVP en
   `companies`, `drivers` y `vehicles`. Nada existente cambia.
2. `lib/compliance/engine.ts` — funciones puras (mismo patrón que
   `lib/policy/engine.ts`): computeComplianceScore, computeStatus,
   reglas de bloqueo. Testeable con Vitest sin tocar la DB.
3. UI operador: sección/página en `/admin` para llenar los datos
   (empresa + por conductor + por vehículo), con estados visuales.
4. UI super-admin: Compliance Review Queue (pendientes, por vencer,
   bloqueados, incompletos) + aprobación manual inicial.
5. Cron diario (patrón `document-alerts`): recalcula estados por
   vencimiento, dispara alertas email, alimenta la cola.
6. Enforcement: `lib/dispatch/auto-assign.ts` salta conductores/vehículos
   bloqueados; la asignación manual muestra el motivo del bloqueo.

</details>

### K. Reestructuración de planes — límites reales + fee por viaje ✅ completado 2026-07-08
Decidido con el usuario tras revisar `docs/COMPETITIVE-ANALYSIS.md` (pricing de
Limo Anywhere/Moovs). Objetivo: pasar de límites que eran solo copy de
marketing (sin enforcement real en código) a límites de uso reales, y hacer
la estructura de precios más agresiva/competitiva.

**Estructura final de planes** (4 tiers, `company_plan` ahora incluye `elite`
entre `professional` y `enterprise`):

| | Starter | Professional | Elite | Enterprise |
|---|---|---|---|---|
| Precio | $99/mes | $299/mes | $549/mes | A medida |
| Vehículos | 6 | 15 | Ilimitados | Ilimitados |
| Choferes | 6 | 15 | Ilimitados | Ilimitados |
| Fee por viaje | 3% | 1.5% | 0.5% | A medida |
| Reservas/mes | 150 | Ilimitadas | Ilimitadas | Ilimitadas |
| Miembros de equipo | 2 | 8 | Ilimitados | Ilimitados |
| Cuentas corporativas / policy engine | ✗ | ✓ | ✓ | ✓ |
| Red de afiliados (farm-out, sección G) | Costo adicional | Costo adicional | Incluida | Incluida |
| App móvil (futura, Android/iOS) | Costo adicional | Costo adicional | 1 incluida (la otra con costo) | Ambas incluidas |
| Multi-marca / multi-sede | ✗ | ✗ | Parcial | Completo |

**Decisión de negocio clave (fee por viaje):** es un % del valor del viaje,
no un fee fijo por viaje como Limo Anywhere ($0.20-0.25). En tarifas de lujo
altas ($150-300+) el % puede salir más caro por viaje que el fijo de LA —
decisión consciente del usuario: la ganancia viene de operadores de volumen
alto (alineación de costo con crecimiento del operador), no de competir en
ese punto exacto. El argumento de venta pasa de "sin cargo por viaje" a
"casi todo lo que la competencia cobra como add-on ya viene incluido en el
plan". Ver `docs/COMPETITIVE-ANALYSIS.md` (actualizado).

**Decisión de alcance:** aplica a empresas existentes Y nuevas por igual
(no solo registros nuevos) — se hizo un backfill de la migración.

**Implementado:**
1. Migración `20260708000035_plan_elite_tier.sql` — `ALTER TYPE company_plan
   ADD VALUE 'elite'` en su propio archivo (Postgres no permite usar el
   valor nuevo del enum en la misma transacción en que se agrega).
2. Migración `20260708000036_plan_limits.sql` — agrega a `plan_quotas`:
   `max_vehicles`, `max_drivers`, `max_bookings_per_month`,
   `max_team_members`, `platform_fee_pct` (default por plan). Seed de los
   5 planes (incluye `free`: 2/2/20/1/0%). Backfill: copia
   `platform_fee_pct` del plan a `companies.settings.payments.platform_fee_pct`
   de TODAS las empresas existentes (mismo campo que ya leían
   `app/actions/payments.ts`/`trip.ts` para `application_fee_amount` en
   Stripe/Whop Connect — el mecanismo de split YA existía como override
   manual por empresa desde `/super-admin/companies/[id]`; esto solo le da
   un default automático por plan).
3. `lib/plans/limits.ts` — helper central: `getPlanLimits`, y
   `checkVehicleLimit`/`checkVehicleLimitBulk`/`checkDriverLimit`/
   `checkTeamMemberLimit`/`checkMonthlyBookingLimit`. Bloqueo duro (no deja
   crear el recurso N+1, mensaje claro con hint de upgrade) — decisión del
   usuario, no degradación silenciosa como el tracking en vivo.
4. Enforcement conectado en: `createVehicleAction` + `importVehiclesCsvAction`
   (fleet.ts, el bulk valida que quepan TODAS las filas antes de insertar
   ninguna), `inviteTeamMemberAction` (team.ts — ahí se crean tanto choferes
   como miembros de equipo, ya que no existía ninguna acción separada para
   "crear conductor"; `drivers` como tabla operativa se llena luego al
   editar licencia/vehículo, el conteo de "choferes" es sobre
   `user_profiles.role='driver'`), `createBookingAction` (las cotizaciones
   guardadas con `as_quote` NO cuentan contra el límite mensual, solo
   reservas reales) y `createPublicBookingAction` (wizard público).
5. `updateCompanyPlan` (companies.ts, super-admin) ahora también resetea
   `settings.payments.platform_fee_pct` al default del plan nuevo al
   cambiar de plan — el super-admin puede seguir sobreescribiéndolo después
   con `updateCompanyCommissionAction` para casos negociados.
6. Landing (`app/page.tsx` + dictionaries EN/ES/PT): grid de precios pasó de
   3 a 4 columnas (`sm:grid-cols-2 lg:grid-cols-4`), el CTA "Talk to sales"
   ahora se calcula por `i === plans.length - 1` en vez de índice
   hardcodeado (`i === 2`), para no romper si se agrega/quita un tier.

**Pendiente (fuera de esta ronda, no bloquea lo anterior):**
- Red de afiliados (sección G) y apps móviles no existen todavía — los
  flags de plan (`farm_out_included` conceptual, apps incluidas) quedan
  como decisión de producto documentada, no hay columna/enforcement nuevo
  para ellos hasta que esas features se construyan.
- **NO se tocaron precios/productos reales en el dashboard de Whop** — eso
  requiere confirmación explícita aparte del usuario antes de ejecutarse,
  por ser un cambio de facturación en vivo.
- UI de upsell (banner/modal cuando se llega al límite, hoy solo el mensaje
  de error del server action) — se puede refinar en una pasada de diseño
  aparte si se quiere algo más que el mensaje de texto plano.

## Backlog de DESARROLLO (0–6 ✅ COMPLETO, ver resumen arriba — detalle histórico abajo)

0. ✅ **Limpieza de marca**: literales "LuxeRide" hardcodeados migrados a
   `lib/brand.ts`. Regla vigente: todo lo NUEVO ya debe usar brand.* (no
   hardcodear).
1. ✅ **2ª pasada i18n**: páginas nativas del admin conectadas al diccionario
   EN/PT.
2. ✅ **Widget de reservas embebible**: `/embed/[slug]` + tarjeta en Ajustes.
3. ✅ **Reviews post-viaje**: email al completar con link de calificación
   pública.
4. ✅ **Pipeline de cotizaciones**: `/admin/quotes` + `/quote/[id]` + cron de
   follow-up.
5. ✅ **Notificar al super admin**: email por solicitud nueva + cron de
   vencimientos.
6. ✅ **PWA del sistema**: manifest dinámico por empresa + service worker.

## ⬜ Pendiente — Fase 2 (sin fecha, requiere validación o infra nueva)

7. **🔶 Fase 2B móvil nativo — EN PROGRESO desde 2026-07-09, pausado
   2026-07-10 para retomar después** (decisión original de esperar la
   validación de la PWA, superada a pedido del usuario). Driver app
   primero, distribución inicial por sideload (APK directo, sin Google
   Play) para evitar la fricción de la tienda mientras se afina; migrar a
   Play Store más adelante. Ya construido (`apps/driver-mobile/`): las 6
   pantallas completas (Hoy/Reservas con historial ordenado por fecha,
   detalle de viaje con completar por efectivo+firma en modal dedicado,
   Ganancias con rangos 7/15/30 días y conteo de viajes, Documentos con
   cámara, Perfil), migraciones 42-44 aplicadas en producción, y rediseño
   visual premium (tipografía de marca, iconos reales, haptics, motion) +
   una segunda pasada de pulido de UX sobre uso real (contacto
   chat-primero, estado en una sola línea, mapa del pasajero sin
   placeholder-que-parece-error, firma en modal a pantalla completa). GPS
   en vivo del conductor y presencia "en servicio" (migración 43,
   `driver_presence`) ya reportan a la web — **ambos con la app en primer
   plano solamente**, segundo plano/pantalla bloqueada requiere build
   nativo custom (no funciona en Expo Go). También agregado: foto de
   perfil, rechazar viaje, reportar incidente, calificar al pasajero,
   **push con sonido** (Expo, migración 44 `device_tokens`), **chat con
   el pasajero**, y **viajes de la Red de Afiliados visibles**. Se creó
   además `.claude/agents/mobile-ux-reviewer.md`: agente de revisión
   estática que corre tras cada tanda de cambios de UX (no hay
   simulador/emulador en este entorno) para dejar de depender de que el
   usuario reporte cada detalle a mano — su primera corrida encontró y
   corrigió 4 problemas reales. **Falta para retomar:** (a) que el
   usuario genere el primer `eas build --profile development` (bloqueado
   en él, no en código) para validar push real con sonido en pantalla
   bloqueada — imposible de probar en Expo Go; (b) confirmar si el mapa
   estático del pasajero carga en el dispositivo real (posible
   restricción de referrer en la Google Maps key); (c) backlog explícito
   sin empezar: mapa embebido con posición propia (`react-native-maps`),
   multi-stop, cola offline, i18n de la app (deferida a propósito).
   ✅ **Hueco de seguridad ya corregido (2026-07-10)**: `advanceAffiliateTripAction`
   no validaba rol/pertenencia en absoluto — se separó en un core
   (`advanceAffiliateTrip(user, affiliateTripId)`, valida que sea el
   conductor asignado o staff de la empresa afiliada) + wrapper web
   (resuelve el usuario por cookie); la ruta móvil ahora llama al core
   directo con el usuario ya resuelto por bearer token. `assignAffiliateDriverAction`
   se revisó de nuevo y ya tenía `requireRole` + ownership correctos, no
   necesitó cambios. Detalle completo y punto exacto para retomar en
   `docs/PHASE-2-MOBILE.md` → "Estado al pausar (2026-07-10)".
8. **Gaps mayores**: QuickBooks, e-signatures, promo codes, detección de
   conflictos de vehículo, nómina de conductores, WhatsApp Business.
   Pospuesto a propósito. (farm-in/farm-out ya tiene diseño concreto, ver
   sección G más abajo.)
9. **✅ HECHO (2026-07-03) — Dispatch avanzado** (sección A): construido sobre
   una tabla nueva `booking_events` (tipo/actor/motivo/hora) EN VEZ DE agregar
   estados nuevos a `booking_status` (ese enum se referencia en ~15 archivos —
   se prefirió esta ruta, confirmada con el usuario, por mucho menos riesgo,
   misma trazabilidad). Incluye: conductor rechaza un viaje asignado (vuelve
   a "pending"); conductor reporta incidente en viaje activo (alerta por
   email al operador, no cambia el estado); reasignación de conductor con
   motivo + aviso SMS al conductor que pierde el viaje; cancelación del
   cliente con conductor ya asignado también queda registrada; bitácora
   visible en `/admin/bookings/[id]` + badge en el dispatch board; mapa en
   vivo de la flota en el dispatch board (reutiliza `trip_locations`, misma
   cuota mensual de Static Maps que el tracking del pasajero — no es un
   consumidor de costo nuevo/separado). Migración 23.
10. **✅ HECHO (2026-07-03) — Calificaciones bidireccionales** (sección B.1):
    ver detalle arriba.
11. **✅ HECHO (2026-07-03) — Chat**: realtime de Supabase en vez de solo
    polling, acuses de lectura, vista admin de hilos. Ver detalle arriba.
12. **✅ HECHO (2026-07-02) — Tracking fase 2: mapa GPS en vivo (bidireccional,
    solo viaje activo)**. Implementado tal cual el plan de abajo: migración
    `20260702000020_live_tracking.sql` aplicada en producción (tablas
    `trip_locations`, `plan_quotas` seedeada 2,500/8,500/sin-límite,
    `live_tracking_usage`); `LiveTrackingMap` (pasajero, con banner de
    "vista en pausa" y opt-in de compartir ubicación) y `LiveLocationReporter`
    (conductor, con aviso al volver a la pestaña) conectados en
    `/track/[id]` y `/driver/trips`; cuota consumida en cada refresco vía
    `refreshLiveMapAction` con degradación amable al mapa estático simple;
    panel `/super-admin/tracking` para editar la cuota por plan y ver consumo
    real por empresa este mes; color/placa del vehículo ahora visible también
    en `/driver/trips`. Build, typecheck y tests verificados; verificación
    interactiva completa (GPS moviéndose en un viaje real) pendiente de la
    primera reserva activa en producción — el diseño abajo queda como
    referencia histórica del plan original:
    - Conductor reporta posición cada 8-10s (Geolocation API) → tabla
      `trip_locations`; pasajero se suscribe por Supabase Realtime al
      `booking_id`. Solo mientras el viaje está `en_route`/`arrived`/en curso.
      Bidireccional (pasajero visible al conductor) = **opt-in explícito**
      del pasajero, nunca automático.
    - **Costo/estrategia de margen**: usar **Static Maps refrescado** (marcador
      recalculado cada 10-20s sobre una imagen estática, $2/1,000 cargas)
      en vez de un mapa Dynamic/JS interactivo completo ($7/1,000) — mismo
      efecto visual para este caso de uso, mismo SKU que ya usan hoy para la
      ruta del tracking, 3.5x más barato. El pool gratis de 10,000/mes de
      Google es POR CUENTA (compartido entre todos los operadores, no por
      empresa) — por eso la protección real no es "empresa grande = riesgo"
      (para eso ya existe el plan Enterprise con "Custom platform fee
      structure"), sino la suma de muchos operadores Starter/Professional.
    - **Medición de consumo por empresa** (AUTORIZADO): contador de uso
      ligado a `company_id`, incrementado en cada refresco de posición.
      Sirve doble: (a) hace cumplir la cuota por plan, (b) le da al dueño de
      la plataforma visibilidad del consumo total de LuxeRide a nivel
      general (no existe hoy). Requiere: tabla de contador mensual +
      vista/reporte agregada en super-admin.
    - **Cuota por plan, configurable desde super-admin** (AUTORIZADO):
      Starter 2,500 refrescos/mes, Professional 8,500/mes, Enterprise sin
      límite fijo (negociado). Al superar la cuota, esa empresa vuelve
      automáticamente al mapa estático simple que ya existe hoy (SIN vista en
      vivo) por el resto del mes — degradación amable, nunca bloqueo duro.
      Como `plan` hoy es solo un enum sin tabla de límites asociada, esto
      requiere una tabla nueva (`plan_quotas` o similar, seedeada con los
      valores de arriba) + una pantalla simple en /super-admin para editarla
      sin necesidad de un deploy.
    - **Aviso de "vista en pausa"** (AUTORIZADO) — expectativa honesta sobre
      la limitación de rastreo en segundo plano en PWA (especialmente iOS
      Safari: si el conductor sale de la pestaña —p.ej. abre Waze— la
      posición deja de actualizarse):
      - Conductor: al volver a la pestaña tras haber salido, aviso:
        "Tu ubicación dejó de compartirse mientras estuviste fuera de la
        app. Mantén esta pestaña abierta durante el viaje." (Page
        Visibility API, sin backend nuevo.)
      - Pasajero: si no llega actualización de posición en 45-60s con el
        viaje aún activo, banner sobre el mapa: "Ubicación en pausa — el
        conductor puede estar usando otra app de navegación. El resto de tu
        información de viaje sigue actualizada."
      - Se mantiene en PWA por ahora; apps nativas (ítem 7) solo se evalúan
        después de validar bien la PWA — decisión ya tomada, no se repite el
        análisis.
    - Incluye también el quick-win ya identificado: color/placa del
      vehículo YA se muestra al pasajero en /track/[id] (columnas `vehicles.
      color`/`plate_number` ya existen) pero FALTA en la vista del conductor
      (/driver/trips) — cerrar ese hueco es trivial (el dato ya existe).
    - Acción del usuario (fuera de este repo, cuando se implemente): activar
      alerta de presupuesto en Google Cloud Console → Billing → Budgets &
      Alerts, sobre el mismo proyecto donde vive la API key de Maps.

13. **✅ HECHO (2026-07-03) — Auto-asignación justa de viajes + panel de
    conductores activos + chat Dispatch↔Conductor** (feature no planificada,
    pedida directamente por el usuario): al crear una reserva, el sistema
    intenta asignarla sola al conductor "en servicio" (`drivers.is_available`,
    controlado por el propio conductor desde /driver/trips, antes solo lo
    tocaba un admin) sin choque de horario y con MENOS viajes COMPLETADOS
    hoy (`lib/dispatch/auto-assign.ts`) — un viaje cancelado/rechazado antes
    de empezar no cuenta en contra del conductor. Barrido diario de respaldo
    (`/api/cron/auto-assign`, límite de 1x/día del plan Hobby de Vercel) para
    lo que quede pendiente. Dispatch Board: el mapa en vivo pasó de Static
    Maps (imagen fija, se veía pegado a un solo marcador) a un mapa
    interactivo real (pan/zoom, Google Maps JS) — ya no consume la cuota
    mensual de Static Maps del tracking del pasajero. Nuevo panel
    "Conductores activos ahora mismo" (estado, viaje actual, viajes
    completados hoy) con botón de chat por conductor. Tarjetas del board:
    distancia del viaje + hora de "Llegó al pickup" con indicador a-tiempo/
    tarde (margen de 10 min, mismo criterio que /admin/drivers/[id]). Canal
    nuevo `driver_messages` (migración 24): Dispatch puede escribirle a
    cualquier conductor en servicio aunque no tenga un viaje activo (no
    atado a una reserva, a diferencia de `trip_messages`) — visible en el
    panel de conductores activos y en /driver/trips (colapsable: solo un
    botón cuando no hay nada que ver, se resalta en ámbar con contador si
    llega un mensaje nuevo mientras está oculto, para no distraer al
    conductor en movimiento pero tampoco dejar pasar un aviso). Bug
    encontrado y corregido en el camino: `driverSetAvailabilityAction` usaba
    UPDATE, que no da error si el conductor nunca tuvo fila en `drivers`
    (solo en `user_profiles`) — el toggle "funcionaba" sin cambiar nada;
    cambiado a upsert.
14. **Facturación vía Whop.com** (analizado 2026-07-02, dos partes
    independientes):
    - **A. Whop para cobrar el acceso a LuxeRide** (viable, confirmado —
      merchant of record, sin LLC propia necesaria, mismo patrón que
      CredyTek): reemplaza la aprobación manual actual en
      /super-admin/subscriptions por activación automática vía webhook de
      Whop cuando el operador paga. Alcance acotado (checkout + webhook), no
      toca el sistema de pagos operador↔pasajero.
    - **B. Wizard de cobro Stripe/Whop para que los OPERADORES cobren a sus
      pasajeros** (probablemente viable, requiere spike de validación antes
      de comprometer desarrollo completo): Whop sí tiene arquitectura tipo
      "connected accounts" (`companies.create()` con `parent_company_id`,
      `account_links.create()` para onboarding/KYC por sub-cuenta,
      `transfers.create()` para enrutar fondos, precio dinámico por
      transacción vía `initial_price`) — comparable a Stripe Connect, no
      solo comercio de productos digitales de precio fijo. Antes de construir
      el wizard completo: probar en sandbox de Whop el onboarding real de
      una sub-cuenta y confirmar tarifas exactas de este modo "plataforma".
    - **⚠️ Aclaración importante (2026-07-02)**: el botón "Conectar con
      Stripe" para que un OPERADOR conecte su propia cuenta **ya está
      construido** en `/admin/settings` (`isStripeConfigured()` en
      `lib/stripe/server.ts` + flujo de Connect completo), pero queda oculto
      para TODOS los operadores porque la variable de entorno
      `STRIPE_SECRET_KEY` de la PLATAFORMA (en Vercel) nunca se configuró con
      una key real — sin eso, la página solo muestra el aviso "Pagos con
      tarjeta aún no habilitados". No es un bug del operador ni falta
      código: es el interruptor de plataforma pendiente (ya listado arriba en
      "Pendientes del USUARIO", ítem 4). Importante para el wizard B: el
      mismo interruptor (o su equivalente de Whop) tiene que estar activo
      antes de que cualquier operador pueda usarlo.
15. Íconos isométricos de vehículos — PARADO, requiere billing de Gemini
    habilitado por el usuario.
16. **✅ HECHO (2026-07-03) — Precio "Por zona"**: antes el modelo
    `zone_based` guardaba `origin_zone_id`/`destination_zone_id` pero el
    motor nunca los usaba (caía al mismo `base_price` fijo que `flat_rate`,
    sin importar la zona). Diseño acordado con el usuario (inspirado en
    Moovs, adaptado a RD): una zona se define por **códigos postales**
    (chips en `/admin/zones`, estilo Moovs) y/o por **círculo**
    (centro+radio, ya existía) — el código postal tiene prioridad, el
    círculo es respaldo; si varias zonas compiten gana la más específica
    (menos códigos agrupados, o radio más chico). El precio es un **par
    fijo origen→destino** en Reglas de precio (selects de zona que
    aparecen solo cuando el modelo es "Por zona"), y SÍ respeta el tipo de
    vehículo (ej. "Aeropuerto → 51000 en Sedán" vs "…en SUV" son reglas
    distintas con prioridad sobre el par de zona genérico).
    - `lib/pricing/zones.ts` (nuevo, puro/testeado): `resolveZoneId()`
      determina la zona de un punto (código postal del componente
      `postal_code` de Google Places, capturado ahora en `AddressInput` —
      círculo como respaldo por distancia haversine).
    - `lib/pricing/engine.ts`: `bestRule()` ahora recibe un `zonePair`
      opcional — prioriza el match EXACTO de zona+tipo de vehículo, luego
      zona+cualquier tipo, y solo si no hay match de zona cae a las reglas
      normales (una regla `zone_based` sin par de zona coincidente NUNCA
      se usa como respaldo genérico — antes ahí estaba el bug).
    - Migraciones 27 (`service_zones.postal_codes TEXT[]`).
    - Nota aparte (no bloqueante, no causa cobros incorrectos): dentro de
      una regla de precio, `airport_pickup_fee`/`airport_dropoff_fee`
      nunca son editables desde el formulario (siempre 0) — pero ya existe
      un mecanismo separado y funcional para cobros de aeropuerto
      (`/admin/airports`, cargo de pickup/dropoff por aeropuerto
      específico), así que estos campos de `pricing_rules` son
      redundantes/muertos, no una falla activa. `holiday_surcharge_pct`
      se guarda pero el motor nunca lo aplica (función a medio construir).

## Datos operativos

- Deploy: push a develop → preview (requiere login de Vercel salvo que se
  desactive Deployment Protection); push a main → PRODUCCIÓN
  (https://getluxeride.vercel.app, pública). Para promover: merge develop→main.
- Migraciones: SQL Editor de Supabase (proyecto iwjtjwryhtpzuvwmlpjk) o
  `supabase db push`.
- Flujo de solicitudes: signup del landing crea empresa en `trial` →
  aparece en /super-admin/subscriptions → Aprobar la activa con 1 mes.
- Tests: `npm test` (raíz). Build: `npx next build` en apps/web.
