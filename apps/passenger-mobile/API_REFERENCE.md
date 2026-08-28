# API de LuxeRide para la app del pasajero

Referencia técnica del backend que consume esta app. No necesitas acceso al
código del servidor (`apps/web`) para desarrollar aquí — todo lo que la app
necesita está documentado en este archivo, extraído directamente del código
real de cada endpoint (nada inventado).

## Arquitectura: qué hace la app vs. qué hace el servidor

- **La app NUNCA calcula precios, ni escribe directo en la base de datos
  para las operaciones sensibles** (reservar, cobrar, calificar). Llama a un
  endpoint HTTP, el servidor valida todo y hace el trabajo real.
- **Algunas pantallas SÍ leen datos directo de Supabase** (con Row-Level
  Security aplicando automáticamente) sin pasar por estos endpoints — hoy
  eso ocurre en `ChatScreen` y `ProfileScreen`. Si necesitas otra lectura
  directa, usa el mismo patrón: `supabase.from('tabla').select(...)`, nunca
  la `service_role key` (esa no la tienes ni la necesitas).
- Todas las llamadas pasan por `lib/api.ts` → `callPassengerApi(path, body)`,
  que ya arma la URL, el header `Authorization: Bearer <token>` (tomado de
  la sesión de Supabase Auth) y el body en JSON.

## Base URL

`${EXPO_PUBLIC_API_BASE_URL}/api/mobile/passenger/{ruta}` — la env var ya
está en tu `.env`.

## Autenticación

- Todas las rutas salvo `signup`, `branding`, `places-autocomplete` y
  `places-details` requieren `Authorization: Bearer <access_token>` de una
  sesión de Supabase Auth con rol `customer`.
- El servidor valida el token contra Supabase (`getUserFromBearerToken`,
  `lib/auth/mobile.ts`) y resuelve el perfil del usuario — si el rol no es
  `customer`, responde `403`.
- `signup` es la única ruta que NO requiere sesión previa (la crea).

## Formato de respuesta

Todas las rutas responden JSON con al menos:
```json
{ "success": true | false, "error": "mensaje si success es false" }
```
Cuando `success` es `false`, el status HTTP normalmente también es 400/401/403/404.
Muchas rutas devuelven el resultado de una función del servidor "tal cual"
(spread en la raíz) en vez de envolverlo en un campo aparte — se indica en
cada endpoint. Cuando dice **"shape no detallado en route.ts"**, significa
que ese campo específico no se puede ver completo sin leer el archivo del
servidor que lo genera (indicado en cada caso) — si necesitas ese detalle,
pídeselo a quien mantiene el backend en vez de adivinar el shape.

---

## Endpoints sin sesión

### POST /branding
**Descripción**: Devuelve el branding white-label (logo, nombre, color, contacto) de la empresa dueña del build de la app, identificada por `companySlug`.
**Body**: `companySlug` (string, requerido).
**Response**: `{ success: true, name, slug, logoUrl, primaryColor, supportPhone, supportEmail }`.
**Errores**: 400 si falta `companySlug`; 404 si la empresa no existe o no está activa.

### POST /quote
**Descripción**: Cotiza el precio por tipo de vehículo disponible para un viaje. Usa el mismo motor de precios que el wizard público de la web.
**Body**: `companySlug` (string, requerido), `pickupLat`/`pickupLng`/`dropoffLat`/`dropoffLng` (number, requeridos), `scheduledAt` (string, requerido), `pickupAddress`/`dropoffAddress` (string, opcionales, default `''`), `pickupPostalCode`/`dropoffPostalCode` (string, opcionales), `bookingType` (string, opcional), `stops` (array, opcional).
**Response**: resultado de `getPublicVehicleQuotesAction` tal cual — shape no detallado en route.ts, revisar `app/actions/bookings.ts` en el backend.
**Errores**: 400 si faltan campos requeridos o `success` es false.

### POST /places-autocomplete
**Descripción**: Proxy de autocomplete de direcciones (Google Places) — la API key vive en el servidor, nunca se expone a la app. Rate-limited (30/ventana).
**Body**: `input` (string, requerido), `sessionToken` (string, requerido).
**Response**: `{ success: true, predictions }` (shape de Google Places, no detallado en route.ts).
**Errores**: 429 si excede el límite; 400 si faltan campos.

### POST /places-details
**Descripción**: Resuelve un `place_id` de Google Places a coordenadas y datos de dirección. Rate-limited (30/ventana).
**Body**: `placeId` (string, requerido), `sessionToken` (string, requerido).
**Response**: `{ success: true, ...details }` (shape de Google Places, no detallado en route.ts).
**Errores**: 429 rate limit; 400 si faltan campos; 404 si no se pudo resolver la dirección.

### POST /signup
**Descripción**: Crea una cuenta de pasajero nueva. Guarda la sesión resultante (access_token/refresh_token) en tu AsyncStorage.
**Body**: `companySlug`, `email`, `password`, `firstName`, `lastName`, `dateOfBirth` (string, requeridos), `phone` (string, opcional).
**Response**: resultado de `signupPassengerCore` tal cual — incluye `{ success, session }`, shape completo de `session` no detallado en route.ts (revisar `app/actions/passenger-auth.ts`).
**Errores**: 400 si faltan campos o `success` es false.

---

## Endpoints con sesión (Bearer token, rol `customer`)

### POST /book
**Descripción**: Crea la reserva. Usa el mismo núcleo del checkout público de la web, asociando la reserva a la cuenta (`customerId: user.id`) para que aparezca en Historial.
**Body**: `quoteId`, `companySlug`, `passengerName`, `passengerPhone`, `scheduledAt`, `pickupAddress` (string, requeridos), `pickupLat`/`pickupLng`/`dropoffLat`/`dropoffLng` (number, requeridos), `dropoffAddress` (string, requerido). Opcionales: `bookingType` (default `'one_way'`), `passengerEmail`, `passengerCount` (default `1`), `specialInstructions`, `flightNumber`, `meetAndGreet` (boolean), `signName`, `stops` (array), `paymentMethodIntent` (`'card'|'cash'`), `luggageCarryOn`/`luggageChecked`/`luggageExtraLarge` (number).
**Response**: resultado de `createPublicBookingAction` tal cual — shape no detallado en route.ts, revisar `app/actions/bookings.ts`.
**Errores**: 401/403 auth; 400 si faltan datos o `success` es false.

### POST /checkout
**Descripción**: "Pagar ahora" justo después de reservar. Envuelve `createPublicCheckoutAction` con verificación de que el booking pertenezca al usuario.
**Body**: `companySlug`, `bookingId` (string, requeridos).
**Response**: resultado de `createPublicCheckoutAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si faltan datos o `success` es false; 404 si el booking no existe o no es del usuario.

### POST /setup-card
**Descripción**: Inicia el guardado de una tarjeta Whop SIN cobrar ("setup mode"), para cuando el pasajero elige "tarjeta al finalizar" y no tiene ninguna en archivo. La app abre la URL devuelta en un WebBrowser; el guardado se confirma por webhook del lado del servidor.
**Body**: `companySlug`, `phone` (string, requeridos).
**Response**: resultado de `createCardSetupCheckoutAction` tal cual (probablemente incluye una URL de checkout).
**Errores**: 401/403 auth; 400 si faltan datos o `success` es false.

### POST /card-setup-status
**Descripción**: Consulta el resultado real del guardado de tarjeta después de que la app cierra el WebBrowser del setup.
**Body**: `companySlug`, `phone` (string, requeridos).
**Response**: resultado de `getCardSetupStatusAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si faltan datos.

### POST /saved-card-by-phone
**Descripción**: Verifica si ya existe una tarjeta Whop guardada para un teléfono, ANTES de reservar — decide si mostrar "tarjeta terminada en ####" o el flujo de guardar tarjeta.
**Body**: `companySlug`, `phone` (string, requeridos).
**Response**: resultado de `getSavedWhopCardByPhoneAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si faltan datos.

### POST /saved-card
**Descripción**: Consulta la tarjeta Whop guardada asociada a un booking existente.
**Body**: `bookingId` (string, requerido).
**Response**: resultado de `getSavedWhopCardAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si falta `bookingId`; 404 si el booking no existe o no es del usuario.

### POST /charge-saved-card
**Descripción**: Cobra el viaje (con propina opcional) usando la tarjeta Whop ya guardada, sin nuevo checkout.
**Body**: `bookingId` (string, requerido), `gratuityPct` (number, opcional).
**Response**: resultado de `chargeWithSavedWhopCardAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si falta `bookingId` o `success` es false; 404 si el booking no existe o no es del usuario.

### POST /receipt
**Descripción**: Desglose/recibo de un viaje (tarifa, descuento, propina, cargos, pagos, total) — mismo desglose que ve el admin en el panel web.
**Body**: `bookingId` (string, requerido).
**Response**: `{ success: true, receipt: { bookingNumber, currency, baseAmount, gratuityAmount, gratuityPct, promoDiscountAmount, totalAmount, completedAt, fees, payments } }`. `fees`: array de `{ id, type, description, amount, created_at }`. `payments`: array de `{ id, amount, status, payment_method, captured_at, created_at }`.
**Errores**: 401/403 auth; 400 si falta `bookingId`; 404 si el booking no existe o no es del usuario.

### POST /trip-detail
**Descripción**: Conductor y vehículo asignados a un viaje (foto, nombre, calificación, marca/modelo/color/placa), para la pantalla de seguimiento en vivo.
**Body**: `bookingId` (string, requerido).
**Response**: `{ success: true, detail: { driver, vehicle, durationMinutes, distanceMiles, scheduledAt, enRouteAt } }`.
- `driver`: `null` o `{ name, phone, photoUrl, rating, totalTrips }`.
- `vehicle`: `null`, o `{ label, year, color, plate, typeName, imageUrl }` (si hay auto físico asignado), o `{ label: typeName, year: null, color: null, plate: null, typeName, imageUrl }` (si solo se conoce la clase de vehículo).
**Errores**: 401/403 auth; 400 si falta `bookingId`; 404 si el booking no existe o no es del usuario.

### POST /submit-review
**Descripción**: Envía la calificación de un viaje completado. Mismo núcleo que la página pública `/review/[id]` de la web.
**Body**: `bookingId` (string, requerido), `rating` (number, requerido), `comment` (string, opcional, default `''`).
**Response**: resultado de `submitReviewAction` tal cual — shape no detallado.
**Errores**: 401/403 auth; 400 si faltan datos o `success` es false; 404 si el booking no existe o no es del usuario.

### POST /preferences
**Descripción**: Lee y/o guarda las preferencias de viaje del pasajero. Sin body o sin `save: true` = solo lectura; con `save: true` = guarda y devuelve el estado actualizado.
**Body** (todos opcionales salvo cuando `save: true`): `save` (boolean), `conversation` (`no_preference|quiet|chatty`), `temperature` (`no_preference|cool|mild|warm`), `music` (`no_preference|none|soft|driver_choice`), `luggageHelp` (boolean), `standingNotes` (string, máx 500 chars), `preferredVehicleTypeId` (string), `preferredDriverGender` (`no_preference|female|male`), `favoriteDriverId` (string — solo válido si hay un viaje `completed` con ese conductor), `companySlug` (string, solo para resolver `vehicleTypes` en la respuesta).
**Response**: `{ success: true, preferences, vehicleTypes, favoriteDriverName }`. `vehicleTypes`: `{ id, name }[]`.
**Errores**: 401/403 auth; 400 si una preferencia no está en su lista permitida, o `favoriteDriverId` no corresponde a un viaje completado juntos.

### POST /notifications
**Descripción**: Lista las notificaciones del pasajero de los últimos 30 días (máx. 50) y cuántas son nuevas; opcionalmente marca todo como visto.
**Body** (opcional): `markSeen` (boolean — si es `true`, marca como leído).
**Response**: `{ success: true, items, unreadCount }`. Cada item: `{ id, type, title, body, bookingId, createdAt, isNew }`.
**Errores**: 401/403 auth. (Sin body no da error, se trata como "solo listar".)

### POST /feedback
**Descripción**: Reporta un problema o sugerencia sobre la APP a LuxeRide (no es "contactar a la empresa operadora").
**Body**: `type` (`'bug'|'feature'`, opcional, default `'bug'`), `title` (string, requerido, máx 200 chars), `description` (string, requerido, máx 2000 chars).
**Response**: `{ success: true }`.
**Errores**: 401/403 auth; 400 si falta título/descripción o la cuenta no tiene empresa asignada.

---

## Notas para el desarrollo

- El shape exacto de varios resultados ("tal cual, no detallado en route.ts")
  vive en `app/actions/*.ts` del backend — si lo necesitas para tipar algo en
  TypeScript, pídele a quien mantiene `apps/web` que te confirme los campos
  en vez de adivinar por el nombre.
- Todos los endpoints corren en Next.js App Router (`runtime = 'nodejs'`,
  `dynamic = 'force-dynamic'`) — no hay caché de por medio, cada llamada es
  fresca.
- Referencia generada el 2026-08-21 leyendo el código real de cada endpoint.
  Si el backend cambia después de esta fecha, este documento puede quedar
  desactualizado — no es una fuente autogenerada, hay que regenerarla a mano
  si el contrato cambia.
