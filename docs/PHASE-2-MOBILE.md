# Phase 2 — Apps Móviles Diferenciadoras

> Rediseñado 2026-06-11 sobre el sistema ya construido (Phase 1 completa:
> dispatch realtime, pagos Stripe+manuales, policy engine, corporate,
> notificaciones, tracking público, flight tracking, i18n EN/ES/PT).

> **DECISIÓN 2026-06-11 — Fase 2A primero: PWA.** Antes de invertir en apps
> nativas, el sistema se convierte en PWA instalable. Si la PWA valida bien
> con usuarios reales, recién entonces se ejecuta el plan nativo de abajo
> (Fase 2B). Ventaja: 90% del valor con ~15% del esfuerzo, sin app stores.

> **DECISIÓN SUPERADA 2026-07-09 — el usuario pidió arrancar la app nativa
> Android del conductor ya, sin esperar validación de la PWA.** Distribución
> inicial planeada por sideload (APK directo desde el sitio, sin Google
> Play) para evitar fricción de tienda mientras se afina; migrar a Play
> Store más adelante cuando esté lista (evita el aviso de "apps de orígenes
> desconocidos"). iOS queda fuera de este alcance por ahora (Apple no
> permite sideload sin el programa Enterprise de $299/año). Ver estado en
> "Progreso Fase 2B" más abajo.

## Fase 2A — PWA (va primero)

1. **Manifest + íconos**: app/manifest.ts (name, short_name, theme_color
   #1d1b18, background #f6f4ef, display: standalone, start_url por rol),
   íconos 192/512 + maskable + apple-touch-icon.
2. **Service worker**: cache de shell y assets (next-pwa o serwist),
   estrategia network-first para datos, offline fallback elegante.
3. **Instalable**: banner propio "Instala LuxeRide" (beforeinstallprompt en
   Android/desktop; instrucciones para iOS Safari "Compartir → Añadir a
   pantalla de inicio").
4. **Web Push** (sustituye Expo push de 2B): tabla device_tokens +
   Notification API + VAPID; hooks existentes (driver_assigned, en_route…)
   disparan push web además de email/SMS. iOS lo soporta desde 16.4 en
   PWAs instaladas.
5. **Driver-first**: vista /driver optimizada móvil (botón gigante de
   avance de viaje ya existe), cola offline de acciones del conductor
   (IndexedDB) para aeropuertos con mala señal.
6. **Medir**: GA4 eventos de instalación y uso standalone → criterio para
   decidir si se hace la Fase 2B nativa.

## Por qué las apps son EL diferenciador

| | Limo Anywhere | Moovs | LuxeRide Phase 2 |
|---|---|---|---|
| Driver app | Incluida (básica) | Incluida | Incluida — premium |
| Passenger app | **$199 + $99/mes** (solo gratis en plan $549) | **$499/mes + $1,000 setup** | **Incluida en Professional** |
| Idiomas | EN | EN | **EN / ES / PT** |
| Flight-aware pickups | Add-on | Plan alto | Incluido |

La passenger app que la competencia cobra como add-on caro, LuxeRide la
incluye — ese es el titular de ventas de Phase 2.

## Ventaja técnica acumulada

Las apps NO necesitan un backend nuevo. Reutilizan lo ya construido:
- **Supabase**: auth + RLS ya aíslan por empresa y rol (driver ve solo SUS
  viajes — policy `drivers_select_assigned_bookings` ya existe)
- **Realtime** ya habilitado en bookings → las apps se actualizan en vivo
- **Server actions equivalentes**: la lógica de avance de viaje
  (driverAdvanceTripAction), pricing y policies vive en el servidor
- **i18n**: los diccionarios EN/ES/PT se comparten con las apps
- **Flight tracking + tracking público**: ya operativos

---

# Fase 2B — Apps nativas

## Progreso (2026-07-09) — esqueleto + slice vertical + pantallas completas + rediseño premium

Construido para probar el pipeline completo (build → APK → instalar en un
Android real) antes de invertir en todas las pantallas de golpe:

- **`apps/driver-mobile/`** — proyecto Expo (SDK **54**, bajado desde el 57
  con el que arrancó `create-expo-app@latest` porque el Expo Go de Play
  Store solo soporta SDK 54) + TypeScript nuevo en el monorepo
  (`@plataforma/driver-mobile`, workspace ya cubierto por `apps/*` en el
  `package.json` raíz).
- **Login**: contra Supabase Auth directo (`supabase.auth.signInWithPassword`)
  — mismas cuentas que ya usan los conductores en `/driver/trips` de la web,
  sin backend nuevo para esto.
- **Pantalla de viaje activo**: lee el viaje del conductor DIRECTO de
  Supabase (`bookings`, filtrado por `driver_id` + estados activos) — la
  policy RLS `drivers_select_assigned_bookings` ya lo permite, no hace falta
  ruta API para leer.
- **Avanzar el viaje (escritura)**: SÍ necesitó una ruta API nueva
  (`POST /api/mobile/driver/advance-trip` en `apps/web`), porque no existe
  ninguna policy RLS de `UPDATE` para el rol `driver` sobre `bookings` (solo
  staff puede hacer UPDATE directo — el conductor en la web también pasa por
  service-role vía Server Action). La ruta valida el bearer token
  (`lib/auth/mobile.ts` → `getUserFromBearerToken`, nuevo) y llama
  `advanceDriverTrip()` — el mismo núcleo de lógica que ya usaba
  `driverAdvanceTripAction` en `app/actions/driver.ts` (se extrajo para
  compartirse entre el Server Action de la web y la ruta API de la app,
  sin duplicar transición de estados + notificación al pasajero).
- **Guardarraíl de rol**: si alguien que no es `driver` inicia sesión en esta
  app, se cierra la sesión con un aviso — la app es solo para conductores.
- **Pantallas completas (Sprint 1-2 adelantado)**: navegación por tabs (Hoy /
  Ganancias / Documentos / Perfil) con un stack nativo dentro de "Hoy"
  (lista de viajes → detalle). Completar viaje incluye cobro en efectivo
  (`payments` con `payment_method: 'cash'`) y firma del pasajero
  (`react-native-signature-canvas`, subida a Storage bucket `documents` ya
  existente). Documentos permite tomar foto de licencia/seguro con la
  cámara (`expo-image-picker`) y sube a Storage bajo la carpeta propia del
  conductor (RLS `drivers_upload_own_documents`, migración 12). Perfil
  controla disponibilidad (`is_available`) reusando la misma ruta API del
  toggle web.
- **Migración 42** (`20260709000042_driver_mobile_app.sql`) — columnas
  `drivers.license_photo_url`, `drivers.insurance_photo_url` y
  `bookings.passenger_signature_path`. **Aplicada en producción** por el
  usuario vía Supabase SQL Editor.
- **Rediseño premium** (mismo día, a pedido explícito del usuario: "quiero
  que esté a la altura de las mejores aplicaciones del mercado"): sistema de
  diseño compartido en `lib/theme.ts` (paleta bronce/dorado sobre fondo casi
  negro, escalas de espacio/radio), tipografía de marca (Playfair Display
  para titulares/cifras grandes + Inter para todo lo demás, vía
  `@expo-google-fonts/*`), iconos reales de `@expo/vector-icons` (Ionicons)
  en vez de emojis, componentes compartidos (`components/ui.tsx`: Card,
  Button, StatusBadge, EmptyState) para que las 6 pantallas no diverjan,
  feedback táctil (`expo-haptics` + escala animada en cada botón vía
  `components/PressableScale.tsx`), y toques de motion (fade-in escalonado
  de las tarjetas de viajes, shake de error en login, degradado sutil en la
  tarjeta de ganancias con `expo-linear-gradient`). Ningún cambio tocó la
  lógica de datos (`lib/api.ts`, `lib/upload.ts`, `lib/supabase.ts`) ni el
  backend — pase puramente visual.
- **`eas.json`**: perfil `apk` listo (`buildType: apk`, `distribution:
  internal`) para generar un `.apk` instalable por sideload; perfil
  `production` (`app-bundle`) ya preparado para cuando se suba a Google Play.
- **Verificado**: `tsc --noEmit` limpio y `npx expo export --platform
  android` compila el bundle completo sin errores — confirma que el código
  es sano antes de gastar un build real en EAS.
- **Pendiente del usuario** (requiere su propia cuenta, no algo que se pueda
  automatizar desde aquí): con la cuenta de expo.dev ya creada, correr
  `eas build --platform android --profile apk` desde `apps/driver-mobile`,
  descargar el `.apk` resultante y colgarlo en el sitio para que los
  conductores lo instalen.
- **Pendiente de decisión**: la app quedó 100% en español (divergiendo del
  resto de la plataforma, que es EN/ES/PT estricto) — flagged al usuario,
  sin decidir todavía si se le agrega i18n completo. Decisión 2026-07-09:
  primero terminar/probar la app, traducir después.
- **Reporte de GPS en vivo (2026-07-09)** — la app ya reporta la posición del
  conductor mientras el viaje está activo, igual que la web
  (`live-location-reporter.tsx`, throttle ~8s, mismos estados activos), para
  que `/track/[id]` (mapa en vivo del pasajero) funcione igual sin importar
  si el conductor usa la web o la app nativa. `reportDriverLocationAction`
  en `app/actions/live-tracking.ts` se refactorizó al mismo patrón núcleo +
  wrapper que ya usaban `advanceDriverTrip`/`setDriverAvailability`
  (`reportDriverLocation(user, ...)` + ruta nueva
  `/api/mobile/driver/report-location`). En el cliente:
  `lib/locationReporter.ts` (hook `useDriverLocationReporter`, usa
  `expo-location`'s `watchPositionAsync`), montado en `TripDetailScreen` —
  incluye el mismo aviso que la web cuando la app vuelve de segundo plano
  ("tu ubicación dejó de compartirse").
  **Limitación pendiente (NO resuelta, requiere build nativo custom):** solo
  reporta con la app en primer plano. Reportar con la app cerrada/pantalla
  bloqueada requiere "background location" de `expo-location` — no funciona
  en Expo Go, exige un dev client custom + permisos adicionales de
  Android/iOS. Se deja para una fase posterior si hace falta.

### Ronda 2 (2026-07-09, mismo día) — foto de perfil + presencia de flota + acciones portadas de la web

A pedido del usuario ("no quiero que se vea de aficionados"):

- **Foto de perfil del conductor**: `drivers.photo_url` (migración 43),
  bucket público `avatars` ya existente (migración 12, RLS por carpeta
  propia) — se sube desde `ProfileScreen` (`expo-image-picker`, galería) vía
  `lib/upload.ts` → `uploadDriverAvatar`. Se muestra al pasajero en
  `/track/[id]` (reemplaza el círculo con la inicial cuando hay foto),
  incluyendo el caso de viaje farmed-in a un afiliado.
- **Presencia "en servicio" para el Dispatch Board**: tabla nueva
  `driver_presence` (migración 43, RLS: el conductor solo puede escribir su
  propia fila) — independiente de `trip_locations` (que es por-reserva).
  `lib/presenceReporter.ts` (`useDriverPresenceReporter`, montado en
  `App.tsx` solo tras login) reporta la posición cada ~20s SIEMPRE que
  `drivers.is_available = true`, tenga o no un viaje asignado. El Dispatch
  Board (`refreshDispatchMapAction` en `app/actions/dispatch-map.ts`) ahora
  pinta 3 tipos de punto: conductor en viaje (verde), recogida pendiente
  (ámbar), conductor en servicio sin viaje activo (azul, `kind: 'idle'`) —
  con leyenda i18n EN/ES/PT (`legendIdle`). Misma limitación de
  primer-plano que el reporte por-viaje.
- **Rechazar viaje asignado** y **reportar incidente en viaje activo**:
  `driverRejectTripAction`/`reportDriverIncidentAction` en
  `app/actions/driver.ts` refactorizadas al patrón núcleo+wrapper
  (`driverRejectTrip`/`reportDriverIncident`), rutas nuevas
  `/api/mobile/driver/reject-trip` y `/report-incident`. UI en
  `TripDetailScreen`: botones secundarios (rechazar solo si `assigned`,
  incidente solo en estados activos) que abren un formulario inline
  (motivo / categoría + descripción).
- **Calificar al pasajero**: `submitDriverRatingAction` refactorizada igual
  (`submitDriverRating`), ruta `/api/mobile/driver/rate-passenger`. UI en
  `EarningsScreen`: cada viaje completado sin calificar muestra "Calificar
  pasajero" → 5 estrellas + comentario opcional.
- **Fix de diseño pendiente encontrado en el camino**: `NEXT_ACTION_LABEL`
  (`lib/types.ts`) todavía tenía emojis incrustados en el texto de los
  botones, duplicando el ícono real ya agregado en el rediseño premium —
  limpiado.

### Ronda 3 (2026-07-09, mismo día) — push con sonido, chat, viajes de afiliados

A pedido del usuario: notificaciones push, chat con el pasajero y viajes de
afiliados, los tres con sonido cuando ocurren.

- **Push (Expo), simplificado a propósito**: NO pasa por el sistema de
  templates de `notification_templates` (ese es para email/SMS al
  pasajero, multi-idioma por empresa) — es un aviso operativo corto SOLO al
  conductor, mismo alcance ya aceptado de "la app es 100% español por
  ahora". Migración 44 (`device_tokens`, RLS: cada usuario gestiona solo
  sus propios tokens). `lib/notifications/push.ts` (`notifyDriverPush` /
  `notifyDriverPushInBackground`, vía Expo Push API directa, gratis, sin
  Firebase) — se dispara desde 3 puntos: viaje nuevo asignado (manual en
  `app/actions/bookings.ts` y automático en `lib/dispatch/auto-assign.ts`),
  nuevo mensaje de chat del pasajero (`sendClientMessageAction` en
  `app/actions/trip.ts`), y viaje de afiliado asignado
  (`assignAffiliateDriverAction` en `app/actions/affiliates.ts`). En la
  app: `lib/push.ts` (`registerForPushNotifications`, montado en `App.tsx`
  tras login) pide permiso y registra el token; el `setNotificationHandler`
  fuerza `shouldPlaySound: true` **incluso con la app abierta** — el
  "sonido cuando ocurran" pedido se resuelve solo con esto, sin necesitar
  un sistema de sonido local aparte para el chat. **Caveat real**: pedir el
  token de Expo requiere un `projectId` de EAS; como el usuario todavía no
  corrió su primer `eas build`, el registro puede fallar en silencio
  (try/catch) hasta que exista ese build — se resuelve solo, no rompe nada
  mientras tanto.
- **Chat con el pasajero dentro de la app**: `screens/ChatScreen.tsx`, leer/
  enviar mensajes van DIRECTO por Supabase (RLS `driver_reads_trip_messages`/
  `driver_writes_trip_messages`, migración 18 — ya existían, no fue
  necesario tocar nada del lado del servidor para eso) + Realtime
  (`postgres_changes` sobre `trip_messages`). Marcar como leído sí necesitó
  refactor núcleo+wrapper (`markDriverMessagesRead` en `app/actions/trip.ts`,
  ya no hay policy de UPDATE para el driver) + ruta nueva
  `/api/mobile/driver/mark-messages-read`. Botón "Chat con el pasajero" en
  `TripDetailScreen`.
- **Viajes de la Red de Afiliados visibles en la app**: `TripsListScreen`
  ahora también consulta `affiliate_trips` (RLS
  `affiliate_driver_reads_own_affiliate_trips`, ya existía) y los muestra en
  una sección aparte con borde punteado dorado. El detalle completo
  (pickup/dropoff exactos, nombre/teléfono del pasajero) NO se puede leer
  directo por RLS —vive en `bookings`, que pertenece a la empresa dueña, no
  a la afiliada— así que `screens/AffiliateTripDetailScreen.tsx` lo pide a
  una ruta nueva con service-role,
  `/api/mobile/driver/affiliate-trip-detail`, que valida primero que el
  viaje sea del conductor. Avanzar estado SÍ tiene RLS de UPDATE directa
  para el conductor (`affiliate_driver_updates_own_affiliate_trips`), pero
  se reusa `advanceAffiliateTripAction` vía
  `/api/mobile/driver/advance-affiliate-trip` para no duplicar la lógica de
  transición de estados/timestamps.
- **Hallazgo de seguridad fuera de alcance, NO arreglado en esta ronda**:
  `advanceAffiliateTripAction` y partes de `assignAffiliateDriverAction` en
  `app/actions/affiliates.ts` no llaman `requireRole(...)` ni validan
  pertenencia — alcanzables como RPC por cualquier sesión autenticada del
  sitio. Flaggeado como tarea aparte (spawn_task), no auditado a fondo
  todavía.

### Ronda 4 (2026-07-09, mismo día) — feedback de uso real sobre el viaje de prueba

A partir de probar un viaje real de punta a punta en el teléfono:

- **Pestañas "Hoy" / "Reservas"** en `TripsListScreen` — antes solo existía
  una lista sin filtrar por fecha (a pesar de llamarse "Hoy"). Ahora "Hoy"
  filtra por fecha local, "Reservas" muestra TODOS los viajes activos
  asignados al conductor sin importar la fecha (ordenados del más próximo
  al más lejano) — un solo fetch, filtro en cliente, sin pegarle dos veces
  al servidor.
- **Botones de contacto rediseñados**: "Chat con el pasajero" ahora es la
  opción principal (botón dorado de ancho completo, arriba), Llamar/
  WhatsApp pasan a ser secundarios (botones más grandes, mejor espaciados)
  debajo — antes los 3 competían al mismo nivel y se veían apretados.
- **Estado del viaje más prominente**: se reemplazó el badge chico por un
  "hero" de estado (ícono + texto grande, con color e ícono por estado,
  fondo tintado) justo debajo del número de reserva.
- **Mapa con la ubicación del pasajero**: nuevo, en `en_route`/`arrived`.
  Ruta nueva `/api/mobile/driver/trip-map` reusa `buildTripStaticMapUrl`
  (la misma función del fallback estático de `/track/[id]`) + 
  `getLiveTripPositionsAction` para la posición del pasajero (si compartió
  ubicación) — sin duplicar esa lógica. **Caveat real, sin confirmar**: usa
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (ya pública, sin riesgo nuevo de
  exponerla), pero si esa key tiene restricción por referrer HTTP al
  dominio web, una petición de imagen hecha desde la app (sin ese
  referrer) podría ser rechazada por Google — degrada con gracia (oculta
  el mapa) si la imagen falla, no rompe nada, pero hay que confirmar que
  cargue en el teléfono.
- **Firma del pasajero como Modal**: el bug real reportado ("el cuadro se
  mueve, no deja dibujar") era el lienzo de la firma compitiendo por el
  gesto con el ScrollView padre. `components/SignatureModal.tsx` abre la
  firma en un Modal de pantalla completa (jerarquía nativa aparte, sin
  scroll padre) — de paso separa visualmente el monto en efectivo (que se
  queda en la pantalla principal, solo para el conductor) de la firma
  (pantalla limpia, para entregarle el teléfono al pasajero) sin que se
  vean juntos.

### Ronda 5 (2026-07-10) — bug de fondo en PressableScale + más feedback de uso

Probando el viaje de prueba con el rediseño de la Ronda 4 puesto:

- **Bug real encontrado y arreglado en `components/PressableScale.tsx`**:
  el `style` del llamador (que casi siempre incluye `flex: 1` para
  estirarse en una fila) solo se aplicaba al `Pressable` interno — el
  `Animated.View` exterior, que es el que en realidad es hijo directo de la
  fila del padre, nunca recibía ese `flex: 1` y se encogía al tamaño de su
  contenido. Esto explicaba DOS reportes distintos a la vez: los botones
  Llamar/WhatsApp que "seguían igual" pese al rediseño, Y los botones de la
  firma (Borrar/Omitir/Guardar) que no se veían — mismo bug de fondo, dos
  síntomas. Fix: las propiedades de tamaño (`flex`, `width`, `alignSelf`,
  etc.) ahora también se copian al `Animated.View` exterior; el resto del
  estilo se queda igual en el `Pressable` interno. Afecta a TODA la app
  (cualquier botón con `flex: 1` en una fila), no solo esas dos pantallas.
- **Mapa: sin placeholder cuando falla** — antes, si el mapa no cargaba,
  se mostraba un cuadro con un ícono de mapa (se leía como "error de
  carga"). Ahora si `mapUrl` no está disponible o la imagen falla, no se
  muestra nada — ni la tarjeta.
- **Estado del viaje más compacto**: el "hero" de estado de la Ronda 4
  quedaba demasiado alto/ancho para una sola línea de texto. Se redujo
  ícono, padding y tamaño de fuente para que se vea como una píldora
  compacta de una sola línea, sin espacio sobrante.
- **Ganancias: rango de fechas (7/15/30 días) + cantidad de viajes**:
  `EarningsScreen` ahora trae hasta 30 días de viajes completados en un
  solo fetch (antes traía los últimos 30 REGISTROS sin importar la fecha)
  y filtra en cliente según el rango elegido — sin pegarle de nuevo al
  servidor al cambiar de rango. Se agregó una tarjeta con el total ganado
  + cantidad de viajes completados en el rango seleccionado, sin tocar la
  tarjeta de "ganancias totales" (histórico) que ya existía.
- **Notificaciones push con el teléfono bloqueado — sigue sin funcionar,
  por la misma razón de siempre**: Expo Go no soporta push remoto desde el
  SDK 53 (ver Ronda 3). No hay fix de código posible para esto mientras se
  pruebe en Expo Go — se necesita un development build
  (`eas build --profile development`, perfil ya listo en `eas.json`) o el
  APK final para validar esto de verdad.

### Funciones avanzadas que la web tiene y la app nativa todavía NO (candidatas para seguir, sin construir)

Comparadas contra `/driver/trips` en la web, que ya tiene años de iteración:

1. **Mapa embebido con posición en vivo propia** dentro de la app (en vez de
   solo botones a Waze/Google Maps) — usaría `react-native-maps`.
2. **Paradas adicionales (multi-stop)** y **vehículo asignado** — la web
   los muestra/soporta, la app no.
3. **Cola offline** para zonas sin señal (aeropuertos) — estaba en el plan
   original de Fase 2A, no construida aún ni en web ni en app.

Ninguna de estas está construida todavía — quedan como backlog explícito
para cuando el usuario decida priorizarlas, en vez de asumirse como "ya
cubierto" solo porque la app ya tiene las pantallas base.

## Sprint 0 — Fundaciones (1 semana)

1. **Tabla `device_tokens`** (user_id, expo_push_token, platform, last_seen)
   + migración RLS.
2. **Push notifications**: lib/notifications agrega canal `push` (Expo Push
   API — gratis, sin Firebase config compleja). Hooks ya existentes
   (driver_assigned, en_route, etc.) disparan push además de email/SMS.
3. **Monorepo**: `apps/mobile-driver` y `apps/mobile-passenger` (Expo +
   TypeScript + EAS Build), compartiendo `packages/database` y diccionarios.

## Sprint 1-2 — Driver App (la prioridad operativa)

Pantallas:
- **Hoy**: viajes asignados en timeline, próximo viaje destacado con cuenta
  regresiva, chip de vuelo (✈ AA1234 +45min) para pickups de aeropuerto.
- **Viaje activo**: botón gigante de avance (En ruta → Llegué → Iniciar →
  Completar — misma máquina de estados), navegación con 1 toque (Google
  Maps / Waze deep link), llamar o **WhatsApp** al pasajero.
- **Al completar**: registrar pago en efectivo recibido (recordManualPayment)
  + firma del pasajero en pantalla (e-signature ligera — gap competitivo).
- **Mis ganancias**: viajes completados, total del período (drivers.total_earnings).
- **Mis documentos**: subir licencia/seguro desde la cámara, alertas de
  vencimiento (cron ya existente alimenta el push).
- **Disponibilidad**: toggle disponible/ocupado (drivers.is_available — el
  dispatch board ya lo refleja).

Diferenciadores vs competencia: UI dark premium (no utilitaria), trilingüe,
modo offline (cola de acciones cuando no hay señal — crítico en aeropuertos
con mala recepción), 100% sin entrenamiento (4 botones).

## Sprint 3-4 — Passenger App (white-label)

> **Actualizado 2026-07-22 — Sprint 0-2 construidos.** El usuario compartió
> un mockup de referencia (17 pantallas) y decidió explícitamente: **cuenta
> real** (signup/login, no guest) y **mapa interactivo nativo**
> (`react-native-maps`, no imagen estática). Sprint 0+1 (fundaciones +
> vertical slice signup→login→cotizar→reservar) y Sprint 2 (mapa en vivo
> del conductor + autocomplete de direcciones con Google Places) ya están
> construidos y verificados — ver detalle en `docs/PENDING.md`. Pendiente
> del usuario: generar la API key nativa de Google Maps para Android
> (`.env.example` de `apps/passenger-mobile` tiene las instrucciones) — sin
> ella el mapa no renderiza, el resto de la app funciona igual. Lo de abajo
> es el plan original, mantenido como referencia de las pantallas
> restantes (Sprint 3-5), con dos correcciones importantes marcadas en
> negrita.

Modelo: **una app "LuxeRide"** en las stores donde el pasajero entra al
espacio de su empresa (`EXPO_PUBLIC_COMPANY_SLUG` fija la empresa del build
— ver Sprint 0). **Corrección**: el logo/nombre/color que se ven DENTRO de
la app ya son dinámicos en runtime desde el Sprint 0
(`/api/mobile/passenger/branding` + `lib/branding.tsx`), no hace falta un
build de EAS por operador para eso — un build de marca propia (nombre/ícono
en la store) SÍ sigue siendo upsell Enterprise, eso no cambió.

Pantallas:
- **Reservar**: ✅ wizard nativo construido (Sprint 1) + autocomplete real
  de direcciones con Google Places (Sprint 2, vía proxy server-side
  `/api/mobile/passenger/places-autocomplete`/`places-details`, sin exponer
  ninguna key de Places a la app) — fecha/hora por chips rápidos, selección
  de vehículo, confirmar.
- **Mi viaje / tracking en vivo**: ✅ construido (Sprint 2) —
  `TripTrackingScreen`, mapa interactivo (`react-native-maps`) con la
  posición del conductor en Realtime (RLS
  `customers_select_own_trip_locations`, migración 62) + ruta decodificada
  de `bookings.route_polyline`. Pendiente del usuario: generar la API key
  nativa de Google Maps Android (ver `.env.example`) — sin ella el mapa no
  renderiza. Fuera de alcance a propósito: el pasajero solo VE al
  conductor, no comparte su propia ubicación (no lo pide el mockup).
- **Pago (Sprint 3) — CORRECCIÓN: es vía Whop, NO Stripe.** El plan
  original decía "Apple/Google Pay vía Stripe checkout sheet" — eso no
  aplica a este proyecto. El pago aquí siempre ha sido Whop
  (`getSavedWhopCardAction`/`chargeWithSavedWhopCardAction`,
  `passenger_whop_members`, ya construidos en
  `apps/web/app/actions/payments.ts` para el checkout público). El Sprint 3
  debe adaptar ESE flujo (buscar member de Whop guardado por
  teléfono/empresa, cobrar sin checkout nuevo) a la app nativa, no construir
  un `PaymentIntent`/Payment Sheet de Stripe desde cero. La columna
  `user_profiles.stripe_customer_id` agregada en la migración 62 quedó mal
  nombrada por este motivo — replantear antes de usarla, o eliminarla y
  usar el mismo modelo de `passenger_whop_members`.
- **Historial + recibos**: RLS ya lista (`customers_select_own_bookings`,
  confirmada en Sprint 1) — solo falta la UI nativa (Sprint 4, hoy es un
  stub "Próximamente" en `MyTripsScreen`). Re-reservar en 1 toque queda
  pendiente.
- **Post-viaje**: calificación + propina post-pago (bookings.rating ya
  existe; cierra otro gap competitivo: reviews) — Sprint 4.
- **Corporativo**: si el usuario es corporate_user, reserva contra su cuenta
  con sus límites (lógica ya construida) — no contemplado todavía en la app
  nativa (el signup de Sprint 1 solo soporta rol `customer`).

## Sprint 5 — Pulido + lanzamiento

- EAS Build + TestFlight/Play Internal → producción.
- Página /apps en el landing con QR codes.
- Push de re-engagement ("¿Viajas pronto? Reserva tu traslado").

## Decisiones tomadas

- **Expo + React Native** (ya planificado) — un codebase, dos stores.
- **Sin API REST nueva**: las apps hablan directo con Supabase (anon key +
  RLS) y con las server actions vía fetch a route handlers ligeros solo
  donde haga falta (pagos).
- **Driver app primero**: es la que vende a los operadores (su dolor diario);
  la passenger app es el diferenciador de pricing vs Moovs/LA.

## Ronda 6 — Agente de revisión automática

Sin emulador/simulador disponible en este entorno, cada ronda de UX
dependía de que el usuario probara en su teléfono físico y reportara cada
detalle manualmente. Se creó `.claude/agents/mobile-ux-reviewer.md`: un
agente de revisión estática especializado en `apps/driver-mobile` que
corre DESPUÉS de cada tanda de cambios y ANTES de reportar "listo" al
usuario. Su checklist codifica las clases de bug ya encontradas en esta
app (propagación de estilos de tamaño en wrappers como `PressableScale`,
conflictos de gesto ScrollView vs. canvas de firma, placeholders que
parecen error, overflow de texto en labels largos en español, deriva del
design system, jerarquía de acción primaria/secundaria, ownership en
rutas API móviles) más un checklist general de RN/Expo.

Primera corrida (commit `7751889`) encontró 4 problemas reales, todos
corregidos: touch targets de <20px en los botones Waze/Google Maps
(`TripDetailScreen.tsx`, `AffiliateTripDetailScreen.tsx`) y en las
estrellas de calificación (`EarningsScreen.tsx`); el label de estado en
`AffiliateTripDetailScreen.tsx` sin `numberOfLines`/`flexShrink` (mismo
riesgo de overflow que ya se había corregido en el hero de estado de
`TripDetailScreen.tsx`, pero no se había replicado ahí); y un color
hardcodeado en `SignatureModal.tsx` que duplicaba `color.ink` de
`lib/theme.ts`. Confirmó también que el fix de `PressableScale`, las
nuevas rutas API móviles (auth + ownership) y el patrón mapa-sin-placeholder
quedaron correctos.

## Estado al pausar (2026-07-10) — para retomar después

Todo lo de abajo está deployado en `main` (commit `b58ad16`), typecheck
limpio. Nada bloqueado por decisiones pendientes del usuario salvo lo
marcado explícitamente.

**Hecho y verificado en producción:**
- 6 pantallas base + GPS en vivo (foreground) + presencia de flota +
  foto de perfil + rechazar/incidente/calificar.
- Push con sonido (Expo Push, migración 44) + chat con el pasajero +
  viajes de afiliados visibles.
- Rediseño completo de contacto/estado/mapa/firma tras prueba real del
  usuario (Rondas 4-5) + fix de fondo de `PressableScale`.
- Tabs Hoy/Reservas en la lista de viajes + rangos 7/15/30 días en
  Ganancias con conteo de viajes.
- Agente `mobile-ux-reviewer` (Ronda 6) corriendo y con su primera
  tanda de hallazgos ya corregida.

**Bloqueado en el usuario (acción suya, no de código):**
- Generar el primer `eas build --profile development` (o el APK de
  producción) para validar push real con sonido en pantalla bloqueada —
  **imposible de probar en Expo Go bajo ninguna circunstancia** (SDK 53+
  quitó push remoto ahí). Sin este build, no se puede confirmar que el
  registro de `device_tokens` y el push con teléfono bloqueado funcionan
  de verdad fuera de la app abierta.
- Confirmar si el mapa estático del pasajero (ruta `/trip-map`, reusa
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) realmente carga en el dispositivo
  físico — sigue sin confirmar si la key tiene restricción de referrer
  HTTP que bloquee pedidos desde la app nativa (se degrada bien si falla,
  pero no se ha visto el caso real).

**Backlog explícito, sin empezar (ver lista completa arriba, "Funciones
avanzadas que la web tiene y la app nativa todavía NO"):**
- Mapa embebido con posición en vivo propia (`react-native-maps`) en vez
  de solo botones a Waze/Maps.
- Multi-stop (paradas adicionales) + mostrar vehículo asignado.
- Cola offline para zonas sin señal.
- i18n de la app (deferido a propósito por decisión explícita del
  usuario: "primero terminar/probar la app, traducir después" — no
  arrancar esto sin que él lo pida).

**Hallazgo de seguridad — ✅ corregido 2026-07-10 (commit `fe4bf37`):**
`advanceAffiliateTripAction` no llamaba `requireRole()`/`getCurrentUser()`
en absoluto — cualquier sesión (o directamente sin sesión, vía RPC directo
a la Server Action) podía avanzar el estado de un viaje de afiliado ajeno
solo con su UUID. Se separó en core `advanceAffiliateTrip(user, affiliateTripId)`
(valida que sea el conductor asignado — `trip.driver_id === user.id` — o
staff de la empresa afiliada — rol en `MANAGER_ROLES` + `trip.affiliate_company_id === user.company_id`)
más un wrapper web que resuelve el usuario por cookie. La ruta móvil
(`/api/mobile/driver/advance-affiliate-trip`) ahora llama al core directo
con el usuario ya resuelto por bearer token, en vez de la Server Action
dependiente de cookie (que le habría devuelto "No autorizado" a un
conductor legítimo). `assignAffiliateDriverAction` se revisó de nuevo y
ya tenía `requireRole` + validación de pertenencia correctos — el hallazgo
original sobre esa función era una falsa alarma.

**Hallazgo de seguridad sin arreglar (flaggeado, no bloqueante):**
algunas funciones en `apps/web/app/actions/affiliates.ts`
(`advanceAffiliateTripAction`, partes de `assignAffiliateDriverAction`)
no llaman `requireRole()` ni validan pertenencia antes de mutar — task
spawneada aparte para seguimiento independiente.
