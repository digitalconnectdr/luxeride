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
  sin decidir todavía si se le agrega i18n completo.

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

Modelo: **una app "LuxeRide"** en las stores donde el pasajero entra al
espacio de su empresa (deep link /book/[slug] → marca, colores y flota de
esa empresa). Build dedicado con marca propia = upsell Enterprise (EAS lo
permite por config).

Pantallas:
- **Reservar**: el wizard actual nativo (4 pasos, propina, Apple/Google Pay
  vía Stripe checkout sheet).
- **Mi viaje**: tracking en vivo en mapa (posición del driver — requiere
  agregar update de ubicación del driver app cada 30s a una tabla
  `driver_positions` con Realtime).
- **Historial + recibos** (datos ya existen) y re-reservar en 1 toque.
- **Post-viaje**: calificación + propina post-pago (bookings.rating ya
  existe; cierra otro gap competitivo: reviews).
- **Corporativo**: si el usuario es corporate_user, reserva contra su cuenta
  con sus límites (lógica ya construida).

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
