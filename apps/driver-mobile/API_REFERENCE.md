# API de LuxeRide para la app del conductor

Referencia técnica del backend que consume esta app. No necesitas acceso al
código del servidor (`apps/web`) para desarrollar aquí — todo lo que la app
necesita está documentado en este archivo, extraído directamente del código
real de cada endpoint (nada inventado).

## Arquitectura: qué hace la app vs. qué hace el servidor

- **La mayoría de las LECTURAS van directo a Supabase** desde la app
  (`lib/supabase.ts`), protegidas por Row-Level Security — no pasan por
  estos endpoints.
- **Estos 14 endpoints existen solo para las ESCRITURAS que necesitan
  privilegios elevados** (`service_role`), porque no hay policy RLS de
  `UPDATE` para el rol `driver` sobre `bookings`/`payments`/`drivers`. El
  servidor valida ownership (que el viaje sea del conductor autenticado)
  antes de escribir, así que sigue siendo seguro aunque use service-role.
- Todas las llamadas pasan por `lib/api.ts` → `callDriverApi(path, body)`,
  que arma la URL, el header `Authorization: Bearer <token>` (de la sesión
  de Supabase Auth) y el body en JSON.

## Base URL

`${EXPO_PUBLIC_API_BASE_URL}/api/mobile/driver/{ruta}` — la env var ya está
en tu `.env`.

## Autenticación

Las 14 rutas, sin excepción, requieren `Authorization: Bearer <access_token>`
de una sesión de Supabase Auth con rol `driver`. El servidor valida el token
(`getUserFromBearerToken`, `lib/auth/mobile.ts`) — si el rol no es `driver`,
responde `403 "Solo conductores"`. Sin token válido, `401 "No autorizado"`.

## Formato de respuesta

Todas las rutas responden JSON con al menos:
```json
{ "success": true | false, "error": "mensaje si success es false" }
```
La mayoría devuelve el resultado de la función del servidor "tal cual"
(spread en la raíz), sin envolverlo — el status HTTP es `200` si
`result.success` es `true`, `400` si es `false`. Cuando dice **"shape no
detallado en route.ts"**, ese campo específico no se puede ver completo sin
leer el archivo del servidor que lo genera (indicado en cada caso) — pídelo
a quien mantiene el backend en vez de adivinar.

Todos corren en Next.js App Router (`runtime = 'nodejs'`,
`dynamic = 'force-dynamic'`) — sin caché, cada llamada es fresca.

---

## Endpoints

### POST /advance-trip
**Descripción**: Avanza el estado de un viaje normal (no de afiliado) asignado al conductor — el flujo principal de "siguiente paso" del viaje.
**Body**: `bookingId` (string, requerido).
**Response**: resultado de `advanceDriverTrip` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /advance-affiliate-trip
**Descripción**: Igual que `/advance-trip` pero para un viaje de una empresa afiliada.
**Body**: `affiliateTripId` (string, requerido).
**Response**: resultado de `advanceAffiliateTrip` (`app/actions/affiliates.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `affiliateTripId` o `success` es false.

### POST /affiliate-trip-detail
**Descripción**: Detalle completo de un viaje de afiliado — combina la fila de `affiliate_trips` con los datos del pasajero/pickup/dropoff que viven en `bookings` (tabla de la empresa principal, sin acceso directo por RLS para el conductor del afiliado).
**Body**: `affiliateTripId` (string, requerido).
**Response**: `{ success: true, trip: { ...trip, ...(booking ?? {}) } }`.
- `trip` (de `affiliate_trips`): `id, status, driver_id, booking_id, branding_mode, en_route_at, arrived_at, started_at, completed_at`.
- Si existe `booking`, se mezclan también: `booking_number, passenger_name, passenger_phone, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes`.
**Errores**: 400 si falta `affiliateTripId`; 404 si el viaje no existe o no está asignado a ti.

### POST /complete-trip
**Descripción**: Completa un viaje, registrando pago en efectivo y/o firma del pasajero.
**Body**: `bookingId` (string, requerido), `cashAmount` (number, opcional), `signaturePath` (string, opcional).
**Response**: resultado de `completeDriverTripWithExtras` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /no-show
**Descripción**: Marca un viaje como no-show (el pasajero no se presentó).
**Body**: `bookingId` (string, requerido).
**Response**: resultado de `markDriverNoShow` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /reject-trip
**Descripción**: El conductor rechaza un viaje que le fue asignado.
**Body**: `bookingId` (string, requerido), `reason` (string, opcional, default `''`).
**Response**: resultado de `driverRejectTrip` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /add-charge
**Descripción**: Agrega un cargo extra a un viaje en curso (equipaje, peaje/parking, o monto personalizado).
**Body**: `bookingId` (string, requerido), `type` (string — `ExtraChargeType`, requerido), `qty` (number — requerido salvo que `type === 'toll_parking'`, default `1`), `customAmount` (number, opcional).
**Response**: resultado de `addDriverExtraCharge` (`app/actions/trip.ts`) tal cual — shape no detallado.
**Errores**: 400 si faltan `bookingId`/`type`/`qty` o `success` es false.

### POST /trip-fees
**Descripción**: Devuelve los montos de cargo extra configurados por el operador para un viaje (0 = desactivado), para el panel de "Agregar cargo" antes de cobrar.
**Body**: `bookingId` (string, requerido).
**Response**: resultado de `resolveDriverTripFees` (`app/actions/trip.ts`) tal cual — shape no detallado (presumiblemente los montos configurados por tipo).
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /rate-passenger
**Descripción**: Envía la calificación del conductor hacia el pasajero al finalizar un viaje.
**Body**: `bookingId` (string, requerido), `rating` (number, requerido), `comment` (string, opcional, default `''`).
**Response**: resultado de `submitDriverRating` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si faltan `bookingId`/`rating` o `success` es false.

### POST /report-incident
**Descripción**: Reporta un incidente ocurrido durante un viaje activo.
**Body**: `bookingId` (string, requerido), `category` (string, requerido), `reason` (string, opcional, default `''`).
**Response**: resultado de `reportDriverIncident` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si faltan `bookingId`/`category` o `success` es false.

### POST /report-location
**Descripción**: Reporta la posición GPS del conductor durante un viaje activo. El cliente (Expo Location) llama esto aproximadamente cada 8-10 segundos.
**Body**: `bookingId` (string, requerido), `latitude` (number, requerido), `longitude` (number, requerido).
**Response**: resultado de `reportDriverLocation` (`app/actions/live-tracking.ts`) tal cual — shape no detallado.
**Errores**: 400 si faltan datos o `success` es false.

### POST /set-availability
**Descripción**: Marca al conductor como disponible o no disponible ("en servicio / fuera").
**Body**: `isAvailable` (boolean, requerido).
**Response**: resultado de `setDriverAvailability` (`app/actions/driver.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `isAvailable` o `success` es false.

### POST /mark-messages-read
**Descripción**: Marca como leídos los mensajes del chat de un viaje (leer/enviar mensajes va directo por Supabase con RLS; marcar como leído es un UPDATE sin policy para `driver`, por eso pasa por acá).
**Body**: `bookingId` (string, requerido).
**Response**: resultado de `markDriverMessagesRead` (`app/actions/trip.ts`) tal cual — shape no detallado.
**Errores**: 400 si falta `bookingId` o `success` es false.

### POST /trip-map
**Descripción**: Genera la URL de una imagen de mapa estático (Google Static Maps) del viaje — pickup, destino, posición del conductor y del pasajero. Misma lógica que el mapa de respaldo de `/track/[id]` en la web.
**Body**: `bookingId` (string, requerido).
**Response**: `{ success: true, mapUrl: string | null, hasPassengerPos: boolean }`. `mapUrl` es `null` si falta la API key de Maps en el servidor o el booking no tiene coordenadas válidas de pickup/dropoff.
**Errores**: 400 si falta `bookingId`; 404 si el viaje no existe o no está asignado a ti.
**Nota**: la API key de Google Maps usada aquí es pública (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), ya se expone en el navegador web — no hay nada adicional que proteger en este endpoint.

---

## Notas para el desarrollo

- El shape exacto de la mayoría de los resultados ("tal cual, no detallado
  en route.ts") vive en `app/actions/driver.ts`, `app/actions/trip.ts`,
  `app/actions/affiliates.ts` y `app/actions/live-tracking.ts` del backend —
  si lo necesitas para tipar algo en TypeScript, pídele a quien mantiene
  `apps/web` que te confirme los campos en vez de adivinar por el nombre.
- Para las lecturas que SÍ van directo a Supabase (no cubiertas por este
  documento porque no son endpoints HTTP), revisa `lib/supabase.ts` y las
  pantallas que ya hacen `supabase.from(...)` como referencia del patrón.
- Referencia generada el 2026-08-21 leyendo el código real de cada endpoint.
  Si el backend cambia después de esta fecha, este documento puede quedar
  desactualizado — no es una fuente autogenerada, hay que regenerarla a mano
  si el contrato cambia.
