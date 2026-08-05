# LuxeRide — Estado y pendientes

> Actualizado: 2026-08-05. Para retomar el trabajo, leer este archivo +
> docs/COMPETITIVE-ANALYSIS.md + docs/PHASE-2-MOBILE.md.

## ✅ Verificación directa en Supabase: migraciones 63, 81 y 85 SÍ están aplicadas (2026-08-05)

El usuario pidió confirmar si las migraciones que el archivo marcaba como
"pendiente de pegar" ya se habían corrido (el texto de este documento no
siempre se actualiza después de que el usuario aplica una migración a mano).
Se verificó con una consulta directa de solo lectura a Supabase (service
role, sin tocar datos) en vez de confiar en el texto de este archivo:

- **Migración 63** (`20260723000063_route_insights.sql`, pickup/dropoff
  city+country): columnas `pickup_city`/`pickup_country`/`dropoff_city`/
  `dropoff_country`/`booking_source` **existen en `bookings`** → aplicada.
- **Migración 81** (`20260801000081_dispatch_risk_reassign.sql`, protocolo
  de respaldo): se encontraron las 6 filas de plantillas
  `driver_reassigned_reassurance` (email+sms) en `notification_templates`
  → aplicada (el `INSERT` y el `cron.schedule` van en el mismo bloque SQL,
  así que si las plantillas están, el pg_cron también se programó).
- **Migración 85** (`20260804000085_driver_gender_favorite.sql`): columna
  `drivers.gender` existe → aplicada (ya sabíamos esta por memoria de sesión).

**Conclusión: no hay ninguna migración pendiente de aplicar ahora mismo.**
Todo el trabajo con pieza de Supabase pendiente de esta lista ya está al
día. Los textos "pendiente de pegar en Supabase" en las secciones de abajo
quedan como historial de cuándo se escribió la migración, no como estado
actual — para dudas futuras sobre si algo se aplicó, preferir una consulta
directa a la base (como se hizo aquí) sobre el texto de este archivo.

## ✅ Polish: header del portal del conductor (2026-08-02)

El usuario pidió (skill `impeccable`, comando `polish`) que el header de
`/driver/trips` se viera "realmente profesional". Antes: nombre/vehículo,
toggle en/fuera de servicio, compartir link, idioma, feedback y cerrar
sesión flotaban sueltos en una sola fila sin agrupación ni jerarquía.

- Avatar circular con la inicial del conductor (mismo patrón ya usado para
  el pasajero en otras partes del sistema).
- Nombre + toggle de servicio en una línea, vehículo asignado debajo — todo
  agrupado como una sola unidad con el avatar (antes: 3 elementos sueltos).
- "Compartir link de reservas" pasó de texto siempre visible a tooltip
  nativo (`title`) sobre el ícono — menos ruido visual.
- Divisores sutiles entre marca | identidad del conductor | utilidades |
  cerrar sesión, para que la fila se lea en grupos en vez de una lista plana.
- **Investigado y descartado**: unificar la forma del botón de feedback
  (`FeatureRequestButton`, ícono plano `rounded-lg`) con la píldora
  `rounded-full` de Compartir/Idioma. Se probó y revirtió porque ese mismo
  componente se usa en el topbar de `/admin`, donde YA es consistente con
  otros 3 íconos planos (Mensajes, Cumplimiento, Ayuda) — cambiarlo ahí
  habría roto esa consistencia para "arreglar" una inconsistencia distinta
  en el portal del conductor. Ver memoria para el detalle.

## ✅ Fix: conductor podía iniciar 2 viajes a la vez + countdown en cola (2026-08-02)

Tras el fix anterior de la vista en cola, el usuario preguntó si un conductor
podía darle "Iniciar ruta" a dos viajes asignados a la vez — sí podía: nada en
el código lo impedía. También pidió un reloj de cuenta regresiva para los
viajes en cola, y que la fecha/hora programada se viera más grande (se veía
en texto de 11px, casi ilegible).

- **`app/actions/driver.ts` — `advanceDriverTrip`**: se agregó un guard antes
  de la transición `assigned → en_route` (el paso de "iniciar" un viaje) que
  verifica si el conductor ya tiene OTRO booking en `en_route`/`arrived`/
  `in_progress`. Si es así, rechaza con "Ya tienes un viaje en curso.
  Complétalo antes de iniciar otro." Esta función es compartida entre el
  server action web y `/api/mobile/driver/advance-trip` (la app nativa
  Android) — el guard cubre ambas superficies con un solo cambio. Los demás
  pasos (en_route→arrived→in_progress→completed) NO se validan porque avanzan
  el mismo viaje que ya está activo, no crean uno nuevo concurrente.
- **`components/driver/trip-countdown.tsx`** (nuevo): client component con
  cuenta regresiva ("Inicia en 2h 15min" / en rojo "Debía iniciar hace
  10min" si ya se pasó la hora), actualizado cada 30s. `now` arranca en
  `null` y se fija en `useEffect` para evitar mismatch de hidratación (el
  servidor no puede saber "ahora" en el instante exacto del cliente).
- **`app/driver/trips/page.tsx`**: la fecha/hora programada de cada viaje en
  cola pasó de `text-[11px]` a `font-playfair text-lg font-semibold` (mismo
  tratamiento tipográfico que usa la tarjeta del viaje activo), y se agregó
  el `<TripCountdown>` al lado.
- i18n: `dict.driver.queue.startsIn`/`overdue` (en/es/pt).

## ✅ Fix: /driver/trips repetía el detalle completo por cada viaje asignado (2026-08-02)

El usuario probó con el conductor Jean Carlos (empresa "LuxeRide Platform")
tener varios viajes asignados a la vez y notó que TODOS se mostraban con el
mismo bloque completo (mapa, progreso, chat, pasajero) apilados uno tras
otro, y que al iniciar uno, los demás seguían mostrando el mismo detalle
completo en vez de reducirse a algo simple.

- **`app/driver/trips/page.tsx`**: se separan los viajes en `activeTrips`
  (status `en_route`/`arrived`/`in_progress` — ya iniciados) y `queuedTrips`
  (status `assigned` — todavía no iniciados). Solo `activeTrips` renderiza el
  bloque completo (mapa interactivo, progreso, chat, `LiveLocationReporter`);
  `queuedTrips` se muestra como una lista compacta nueva ("Otros viajes
  asignados") con booking number, hora programada, pasajero, ruta resumida y
  su propio botón de iniciar/rechazar (`DriverTripActions`, reusado tal
  cual — sin cambios de lógica de negocio).
- **No se agregó ningún bloqueo** para impedir iniciar un viaje en cola
  mientras otro está activo — eso sigue funcionando como antes (decisión
  deliberada para no meter una regla de negocio nueva en un fix visual; si el
  operador quiere restringir eso, es una decisión aparte a tomar con el
  usuario).
- Efecto colateral bueno: antes `LiveLocationReporter` se montaba una vez por
  CADA viaje asignado (incluidos los no iniciados), reportando la ubicación
  del conductor contra varios `booking_id` a la vez innecesariamente. Ahora
  solo se monta para el/los viaje(s) realmente activos.
- i18n: nueva clave `dict.driver.queue` (en/es/pt).

**Nota**: no se pudo verificar visualmente en navegador (el portal del
conductor corre dentro de la app de escritorio del usuario, con datos reales
de producción, sin credenciales demo disponibles en este entorno) — se
verificó con lectura de código + `tsc`/`eslint`/`vitest`/`build` en verde.

## ✅ Fix: cargo de cancelación no reflejado en Total + timezone en bitácora (2026-08-02)

El usuario reportó, sobre una reserva de prueba real (LXR-2026-00022) cancelada
por el cliente citando "conductor nunca llegó", que el "Desglose de cargos" no
cuadraba (Total no incluía el cargo de cancelación) y que la hora en "Bitácora
de eventos" tenía 4 horas de más (repetición del bug UTC-vs-timezone-de-empresa
ya visto varias veces esta semana).

- **`app/actions/trip.ts` — `cancelTripByClientAction`**: al insertar el fee de
  cancelación, ahora también actualiza `bookings.total_amount = fee.feeAmount`
  — el mismo fix que ya existía en `bookings.ts:759` (con el comentario "bug
  real encontrado en producción") pero que nunca se replicó al flujo de
  cancelación pública del cliente. Antes, el Total mostrado en
  `/admin/bookings/[id]` ignoraba por completo el cargo recién cobrado.
- **`app/admin/bookings/[id]/page.tsx` — timezone**: se agregó `companies.timezone`
  al query y se extendió `fmt()` para aceptar un `timeZone` de Intl — todos los
  timestamps de esta página (timeline + bitácora de eventos) ahora se muestran
  en la zona horaria de la empresa, no en UTC (hora del servidor de Vercel).
- **Aviso de revisión (decisión del usuario)**: se decidió mantener el cobro
  automático del cargo de cancelación aunque el motivo sea "conductor no se
  presentó" (para no abrir la puerta a que cualquier cliente evite un cargo
  legítimo alegando esto en texto libre), pero se agregó un banner de
  advertencia en `/admin/bookings/[id]` cuando coexisten un evento
  `customer_rejected` (cliente rechazó a un conductor ya asignado) y un cargo
  `cancellation_fee`/`no_show_fee` — invita al staff a revisar el motivo en la
  bitácora y reembolsar manualmente si fue culpa del conductor.
- **No se tocó** `lib/policy/engine.ts` — `computeCancellationFee` sigue sin
  distinguir el motivo del texto libre, a propósito, por la decisión anterior.
- Datos de la reserva de prueba LXR-2026-00022 limpiados manualmente en
  Supabase (cargo de $82.83 erróneo eliminado) — no afecta reservas reales.

**Nota para el futuro**: si se agrega un flujo nuevo de cancelación/no-show
(fuera de `trip.ts` y `bookings.ts`), recordar aplicar el mismo patrón de
actualizar `total_amount` al insertar el fee — no hay una función compartida
que lo haga automáticamente, cada call site lo repite.

## ✅ Auditoría de comunicación de add-ons: landing + llms.txt + JSON-LD (2026-08-02)

El usuario notó que "Rutas frecuentes" (AI Growth Assistant) no se comunicaba
como beneficio en la tarjeta de `/admin/marketplace`, y pidió revisar si TODOS
los add-ons se comunican bien en landing/SEO/GEO/AEO/LLM. Investigación
(agente Explore) confirmó que el JSON-LD del landing (`lib/seo/structured-data.ts`)
literalmente hereda texto por texto los mismos `features` de
`dict.landing.plans` — así que arreglar la landing arregla las 3 superficies
(A: landing, B: llms.txt, C: JSON-LD) a la vez para casi todo, excepto
`llms.txt` que es un archivo estático separado.

- **`ai_growth` (marketplace + landing + llms.txt)**: agregado el bullet de
  "Rutas frecuentes" (`dict.admin.marketplace.items.ai_growth.features`,
  `dict.landing.plans[].features` en Starter/Professional/Elite, y
  `public/llms.txt`) — aclarando explícitamente que el reporte de rutas NO
  consume la cuota de generaciones de IA (confirmado en el comentario de
  `app/actions/route-insights.ts`).
- **`affiliate_network` — desactualizado, no solo "sin detalle"**: landing y
  `llms.txt` afirmaban **"$29/mes"** fijo, un precio que nunca existió (el
  modelo real es comisión variable por viaje, `hasFixedPrice: false` en
  `lib/billing/catalog.ts` con comentario explícito: "la UI nunca debe
  mostrar un '$X/mes' inventado"). Corregido en las 3 superficies (en/es/pt +
  llms.txt) a "comisión variable por viaje, tú defines el margen".
- **`custom_domain_byod` — ausente en las 3 superficies**: no aparecía ni en
  landing, ni en llms.txt, ni por lo tanto en el JSON-LD, pese a ser un
  add-on activo y vendido desde julio. Agregado como bullet en los 4 planes
  (add-on $29 pago único en Starter/Professional, incluido en Elite/
  Enterprise) + llms.txt. `custom_domain_request` (la opción gratuita
  "consíganme uno") se mencionó dentro del mismo bullet en vez de crear uno
  aparte, ya que no tiene precio fijo propio.
- **`ai_chat`/`ai_growth` en landing — no desactualizados, pero mínimos**:
  antes solo mostraban el precio ("desde $X/mes") sin explicar qué hacen.
  Se enriqueció cada bullet con el beneficio real en una frase corta.
- `driver_payroll`, `esignature`, `promo_codes` ya estaban bien comunicados
  en las 3 superficies — sin cambios.
- Verificado en navegador (dev local) que los bullets más largos no rompen
  el layout de las tarjetas de precio (mismo patrón ya usado por bullets
  igual de largos preexistentes).

## ✅ Preferencias al conductor + chat Dispatch en la app nativa + fixes de overflow móvil (2026-08-02)

Tercera ronda del día, a partir de capturas de pantalla móviles que mostró el
usuario. Tres frentes:

**1. Preferencias del pasajero — cerrar el hueco también del lado conductor.**
La ronda anterior arregló `/admin/bookings/[id]`; esta corrigió las dos
superficies que ve el CONDUCTOR:
- Web `/driver/trips`: la consulta de `bookings` no traía `special_instructions`
  ni `passenger_preferences` — se agregaron ambas columnas + una tarjeta
  "Preferencias del pasajero" (reutiliza `summarizePreferences()`) y un bloque
  "Instrucciones" para `special_instructions`, entre la tarjeta de Pasajero y
  el chat. i18n en/es/pt (`dict.driver.specialInstructions`/`.preferencesTitle`).
- App nativa (`apps/driver-mobile/screens/TripDetailScreen.tsx`): el tipo
  local `TripPreferences` y `preferenceLines()` solo conocían conversación/
  temperatura/música/equipaje — se agregó `preferredDriverGender`. Se dejó
  fuera a propósito `preferredVehicleTypeId`/`favoriteDriverId`: no aportan
  nada accionable al conductor YA asignado a ese viaje.

**2. Chat Dispatch ↔ Conductor: faltaba por completo en la app nativa.**
Existía en la web (`DriverChannelChat`, tabla `driver_messages`) desde julio,
pero `apps/driver-mobile` nunca tuvo pantalla ni acceso a esa tabla — el
conductor solo podía ver esos mensajes abriendo la PWA en el navegador.
Construido:
- `apps/driver-mobile/screens/DispatchChatScreen.tsx` (nueva) — espejo de
  `ChatScreen.tsx` (chat por viaje) pero sobre `driver_messages`, sin route
  params (usa la sesión propia). Confirmado con `mobile-ux-reviewer`
  (agente proactivo) que las policies RLS existentes (migración 24, julio)
  ya dejaban al conductor leer/escribir su propio canal directo — solo faltó
  la UI.
- 5ª pestaña "Dispatch" en `App.tsx` (ícono chatbubbles), entre "Hoy" y
  "Ganancias".
- **Migración 86** (`20260805000086_driver_marks_dispatch_read.sql`): faltaba
  una policy UPDATE — el conductor no podía marcar como leídos los mensajes
  de Dispatch desde la app (solo tenía SELECT/INSERT).
- **Migración 87** (`20260805000087_driver_messages_rls_harden.sql`): la
  revisión del agente encontró 2 huecos reales en RLS que hasta ahora eran
  solo teóricos (nadie escribía en `driver_messages` desde fuera del
  servidor) y esta pantalla nueva los vuelve explotables de verdad: (a) la
  policy INSERT del conductor nunca validaba que `company_id` fuera el suyo
  — corregido comparando contra `user_profiles.company_id`; (b) la policy
  UPDATE nueva de la migración 86 solo exigía `sender='dispatch'`, sin
  impedir que el conductor cambiara `body`/`sender_name`/`company_id` en la
  misma sentencia — se agregó un trigger `BEFORE UPDATE` que congela todos
  los campos salvo `read_at` cuando quien actualiza es el propio conductor
  (`auth.uid() = driver_id`); las actualizaciones de staff vía admin client
  no pasan por `auth.uid()` y no se ven afectadas.
- El agente también encontró y se corrigió: fuga del canal Realtime si la
  pantalla se desmonta antes de que resuelva `supabase.auth.getUser()`
  (bandera `cancelled`), y error silencioso al enviar un mensaje si el
  `insert()` falla (ahora se restaura el texto para reintentar) — este último
  también se corrigió en `ChatScreen.tsx` existente, mismo patrón.

**3. Fixes de overflow horizontal en móvil** (capturas del usuario):
- `/admin/reports` y `/admin/payroll`: el formulario de filtro de fechas
  (`Desde`/`Hasta` + botón "Aplicar"/"Período") no tenía `flex-wrap` — dos
  `<input type="date">` más un botón en una sola fila sin envolver siempre
  iba a desbordar en una pantalla angosta. Se agregó `flex-wrap` + ancho
  máximo a los inputs.
- `/admin/bookings/[id]`: el email del pasajero (una cadena sin espacios)
  podía desbordar su celda del grid porque ni el `<div>` ni el `<p>` tenían
  `min-w-0`/`break-words` — el gotcha clásico de CSS Grid donde el ancho
  mínimo por defecto de un ítem es su contenido. Se agregó `min-w-0` a las 4
  celdas de esa tarjeta y `break-all`/`break-words` a nombre/teléfono/email.
- `/dispatcher/layout.tsx`: el header (logo + nav + usuario + Sign out) nunca
  tuvo tratamiento móvil — una sola fila sin `flex-wrap` con ~6 elementos.
  Se agregó `flex-wrap`, se ocultó el nombre del usuario en pantallas chicas
  (`hidden sm:inline`) y se redujo el padding lateral.
- `/track/[id]`: la fila conductor+vehículo (nombre/rol/vehículo a la
  izquierda, placa fija a la derecha con `ml-auto shrink-0`) se cambió a
  `flex-wrap` para que la placa baje de línea en vez de desbordar si el
  contenido de la izquierda no cabe — no se confirmó con certeza que esta
  fuera la causa exacta del desborde visto en las capturas (podría ser un
  overlay del navegador/teléfono del usuario, ver más abajo), pero es un
  endurecimiento seguro sin efectos secundarios.
- **Nota de verificación**: los fixes de `/admin/*` y `/dispatcher/*` no se
  pudieron probar visualmente en navegador (sin credenciales de demo en este
  entorno) — se confirmó con `tsc`/`vitest`/`build` limpios y lectura de
  código, no con captura real post-fix. Se verificó con el navegador que la
  landing pública NO tiene overflow horizontal a 375px de ancho (sin bug
  global de CSS), lo que sugiere que la tira color crema + ícono de lápiz
  flotante visible en TODAS las capturas del usuario (incluso en `/track/[id]`,
  que es una página oscura) es probablemente un overlay del navegador/teléfono
  (ej. el asistente "Leo" de Brave u otro widget), no necesariamente parte del
  bug — los 3 desbordamientos de texto/botón puntuales sí se confirmaron
  leyendo el código y sí son bugs reales, ya corregidos.

Migraciones 86 y 87 ✅ aplicadas por el usuario en el SQL Editor de Supabase
(2026-08-02) — el chat Dispatch↔Conductor ya funciona en la app nativa.
Sin build de EAS en esta ronda (regla: máximo 2/semana, el usuario avisa
cuándo).

## ✅ Fix: preferencias del pasajero visibles en /admin/bookings/[id] + análisis de 3 ideas más de Empower (2026-08-02)

Segunda parte de la ronda de driveempower.com. Dos pedidos del usuario:

**1. Fix del hueco detectado en la ronda anterior**: `/admin/bookings/[id]`
no mostraba NINGUNA preferencia del pasajero al despachador, ni siquiera las
que existían desde julio (conversación, temperatura, música, ayuda con
equipaje). La causa: `booking.passenger_preferences` (el snapshot JSONB
congelado en cada reserva desde la migración 76) se guardaba pero nadie lo
leía en esta página — ni `lib/passenger/preferences.ts` ni `summarizePreferences()`
se usaban ahí pese a que el comentario del archivo ya decía que debían serlo.
Fix: nueva tarjeta "Preferencias del pasajero" entre "Pasajero" y "Vehículo +
conductor", que solo aparece si `hasAnyPreference()` es cierto (evita ruido
para reservas sin nada configurado). Muestra conversación/temperatura/música/
género preferido/tipo de vehículo preferido/conductor favorito (con nombre
resuelto), y un badge si necesita ayuda con equipaje. Las notas fijas
(`standingNotes`) NO se repiten aquí a propósito — ya se fusionan dentro de
"Instrucciones especiales" al crear la reserva. i18n completo en/es/pt
(`dict.admin.bookingDetail.preferences`). Verificado con `tsc`/`vitest`; no
se verificó visualmente en navegador por falta de credenciales de demo en
este entorno.

**2. Análisis de 3 sugerencias adicionales** (para no copiar literal el
modelo de Empower), verificadas contra el código real antes de opinar:

- **Favoritos (chofer/vehículo/operador + preferencias)**: chofer favorito y
  las preferencias de conversación/temperatura/música/equipaje YA estaban
  construidas (esta ronda + antes). "Vehículo favorito" es redundante con
  `preferredVehicleTypeId` que ya existe (preferencia por TIPO de vehículo,
  no por unidad física — las empresas reasignan vehículos a choferes, así
  que fijar una placa específica no aporta valor real). "Operador favorito"
  **no aplica al modelo de LuxeRide**: el pasajero reserva a través del
  micrositio/app de UNA sola empresa (white-label), no elige entre varios
  operadores en una interfaz compartida tipo marketplace — eso es
  exactamente el modelo de Empower que ya se descartó en la ronda anterior.
- **Programa de referidos de pasajero (6 canales sugeridos)**: 3 de los 6 YA
  EXISTEN bajo otro nombre — "operador refiere operador" es literalmente el
  programa de referidos entre empresas ya construido (`company_referrals`);
  "hotel refiere pasajero" e "influencer refiere pasajero" ya están cubiertos
  por Partner Portals (`partners`/`partner_payments`, portal co-brandeado por
  partner con comisión y reporte) — un influencer o un hotel son, en la
  práctica, el mismo tipo de socio no-operador que ya modela ese sistema, sin
  código nuevo, solo dar de alta el partner. Los 2 genuinamente nuevos
  ("pasajero refiere pasajero", "conductor refiere pasajero") y el ambiguo
  ("asistente corporativo refiere empresa") se presentaron al usuario, que
  decidió **no construir ninguno por ahora** — queda como oportunidad
  registrada, no como pendiente activo.
- **Lanzamiento por ciudad (South Florida, NY/NJ, Orlando/Tampa, Atlanta,
  Houston/Dallas)**: es una decisión de estrategia de mercado/marketing del
  negocio de JPRS Digital Connect, no una funcionalidad de software — no se
  tradujo en ninguna tarea de código. Lo único con solapamiento real de
  producto es el "Growth Engine" (páginas programáticas por ciudad/ruta/
  aeropuerto) ya registrado como pendiente de mayor alcance más abajo.
- **Modelo dual de comisión (Direct Booking 0% vs Marketplace Booking
  10%-15%)**: confirmado en el código que HOY todos los operadores pagan
  suscripción + platform fee (0.5%-3%) sin distinguir el origen del
  pasajero — el copy "No middleman commission on your direct bookings" del
  landing/ToS es, en efecto, más una promesa de marketing que un modelo de
  precio real diferenciado. Es un cambio de modelo de negocio/facturación
  real (afecta planes de Whop y la comunicación a operadores ya activos), no
  un ajuste de UI. Se presentó al usuario, que decidió **no construirlo por
  ahora** sin antes definir los números exactos — queda registrado como
  oportunidad, no como pendiente activo.

## ✅ Análisis driveempower.com + 2 preferencias de pasajero: conductor del mismo género y conductor favorito (2026-08-02)

El usuario pidió comparar https://driveempower.com/ contra LuxeRide.
Investigación en vivo (home, /drivers/, /riders/): Empower es un marketplace
B2C de rideshare "propiedad del conductor" (0% comisión, el conductor paga
suscripción, referidos en efectivo, garantía de lanzamiento por ciudad) — un
modelo que no aplica a LuxeRide, cuyo software es B2B para flotas ya
establecidas con choferes empleados/contratados, no gig workers que se
inscriben directo a una plataforma. De todo Empower, solo 2 ideas eran
transferibles de verdad: preferencia de género del conductor y "conductor
favorito" (pedir de nuevo al mismo chofer). El usuario confirmó construir
ambas.

- **Migración 85** (`20260804000085_driver_gender_favorite.sql`, pendiente
  de pegar en Supabase): `drivers.gender` ('female'/'male'/NULL, lo declara
  el operador desde `/admin/drivers/[id]`, no autoservicio del conductor) +
  `passenger_preferences.preferred_driver_gender` /
  `.favorite_driver_id`. No hace falta tocar `bookings.passenger_preferences`
  (JSONB) — ya copia el objeto completo de preferencias al reservar
  (migración 76), así que ambos campos nuevos quedan incluidos solos.
- **Diseño asimétrico a propósito**: la preferencia de género es un filtro
  DURO en `lib/dispatch/auto-assign.ts` — si nadie califica, la reserva
  queda `pending` para asignación manual (mismo comportamiento que ya existe
  cuando ningún candidato califica por tipo de vehículo). El conductor
  favorito es best-effort — si no está disponible, la reserva sigue el flujo
  normal de auto-asignación en vez de bloquear el viaje. Un conductor sin
  género declarado (`NULL`) nunca satisface una preferencia explícita del
  pasajero (no se asume, se excluye). Ninguno de los dos cambios toca
  `reassignForRisk` (reasignación de emergencia del protocolo de respaldo) —
  ahí importa más conseguir CUALQUIER conductor calificado que respetar la
  preferencia.
- IDOR: `favoriteDriverId` solo se acepta si existe una reserva `completed`
  real entre ese pasajero y ese conductor — no se puede marcar como favorito
  a un conductor con el que nunca se viajó.
- Web: selector de género en `/admin/drivers/[id]` (i18n en/es/pt). App
  nativa del pasajero: chips de preferencia de género + bloque de conductor
  favorito (con nombre y opción de quitar) en Perfil → Preferencias de
  viaje; botón "Marcar conductor como favorito" en cada viaje completado de
  Mis viajes.
- **Pendiente conocido, no corregido en esta ronda**: `/admin/bookings/[id]`
  no muestra NINGUNA preferencia del pasajero al despachador (ni las que ya
  existían: conversación, temperatura, música, ayuda con equipaje). Es un
  hueco preexistente, no algo que se rompió aquí — anotado para una ronda
  futura de UI de dispatch.

## ✅ Reportes: conectar la atribución de marketing (UTM/gclid) ya capturada (2026-08-01)

Primer paso del "Growth Engine" que propuso una auditoría externa (ver
sección de arriba). Investigado el estado real: `bookings.attribution`
(UTM/gclid) se captura desde hace tiempo en `booking-wizard.tsx` y se
persiste en cada reserva, pero **ningún reporte lo leía** — era un dato
huérfano, guardado y nunca mostrado. El "canal" que sí existía en
`/admin/reports` (Directo/Corporativo/Afiliado/Partner) es un concepto
interno distinto (viene de relaciones de la reserva), no de parámetros de
marketing.

- Nueva sección "Atribución de marketing" en `/admin/reports`: ingresos y
  reservas agrupados por `utm_source` (con "Directo / sin UTM" como bucket
  por defecto), badge de cuántas vinieron de un clic real de Google Ads
  (`gclid` presente), y tabla de top 10 campañas (`utm_campaign`) con
  fuente/medio.
- CSV de reservas (`/api/reports/bookings`) ahora incluye columnas
  `utm_source`, `utm_medium`, `utm_campaign`, `gclid` por reserva.
- i18n completo (en/es/pt).

Con esto un operador puede ver por primera vez si su inversión en Google Ads
o campañas de redes está generando reservas reales, no solo intuirlo. El
resto del "Growth Engine" (páginas por ciudad/ruta/aeropuerto, llms.txt por
empresa, Google Ads Conversion API server-side, gestión de Google Business
Profile) sigue pendiente como iniciativa aparte, de mayor alcance — ver
auditoría del micrositio arriba para el inventario completo de qué existe y
qué no.

## ✅ Fix: auditoría externa del micrositio (ChatGPT) — 5 bugs reales en las 4 plantillas (2026-08-01)

El usuario pidió revisar una auditoría hecha por ChatGPT sobre el micrositio
público (`/book/[slug]`) que se le entrega a cada empresa. Se verificó cada
afirmación contra el código real antes de tocar nada — varias eran ciertas,
varias estaban mal diagnosticadas (analizaron el HTML renderizado sin ver la
lógica), y una (páginas programáticas por ciudad/ruta/aeropuerto tipo
`/airport-car-service/mia`) es una iniciativa nueva de meses, no un fix, así
que queda fuera de esta ronda.

**Refutado / ya resuelto** (no se tocó nada): mezcla de idiomas (el chrome/UI
respeta el locale en las 4 plantillas; solo el copy editorial del operador
puede caer a ES si no lo tradujo, por diseño), "métodos de pago duplicados"
(es un carrusel infinito a propósito), amenidades inconsistentes (texto libre
del operador, no un bug), email genérico de LuxeRide (usa `company.email`
real), "LuxeRide Platform domina la marca" (no existe ese fallback, es el
slug de una cuenta demo interna ya excluida de SEO), dominio propio (ya existe
vía BYOD/"consíganme uno").

**5 bugs reales confirmados y corregidos, en los 4 templates (noir/ivory/
bold/corporate) donde aplica**:

1. **"Coupes" aparecía aunque la empresa no tuviera cupés** — la sección
   "Explora por categoría" es una lista fija de marketing sin filtrar contra
   la flota real. Peor aún: "Coupes" ni siquiera es un `vehicle_class` válido
   en el schema (`sedan/suv/van/limousine/sprinter/bus/exotic`), nunca podía
   ser cierto. Fix: `lib/booking/vehicle-categories.ts` filtra las categorías
   contra las clases reales de la flota activa; "Coupes" se reemplazó por
   "Exotic" (que sí es una clase real) en los 3 diccionarios.
2. **El micrositio no mostraba tarjeta como método de pago si la empresa solo
   tenía Stripe Connect (sin Whop)** — `acceptsCardOnline` en `page.tsx` solo
   miraba Whop, mientras que `/reservar` sí acepta Stripe O Whop. Ahora ambos
   sitios usan el mismo criterio.
3. **3 `<h1>` simultáneos en `/reservar` y `/partners/[partnerSlug]`** (aside
   desktop + bloque móvil + uno más dentro del wizard) — visualmente solo se
   veía uno por breakpoint, pero los 3 estaban en el árbol de accesibilidad.
   Fix: un único `<h1 className="sr-only">` fijo, los otros 2 bajados a `<p>`,
   y el `<h1>` interno del wizard bajado a `<h2>`.
4. **El logo del operador nunca se pintaba en `/reservar` ni en
   `/partners/[partnerSlug]`** aunque la página ya lo traía de la base de
   datos — agregado junto al link "← {empresa}" del header.
5. **La imagen de portada por defecto** (cuando el operador no sube la suya)
   apuntaba al endpoint de *descarga* de Unsplash
   (`unsplash.com/photos/.../download?force=true`), un redirect de terceros
   fuera de control que puede devolver 502 (coincide con el reporte de la
   auditoría). Fix: se descargó una vez y se auto-hospeda en
   `public/microsite/default-hero.jpg`, usado en las 3 páginas del
   micrositio (`page.tsx`, `/reservar`, `/partners/[partnerSlug]`).

**Decisión pendiente del usuario** (no bug, decisión de producto): el link
"Sign in" del nav público (lleva al login administrativo, confunde a
pasajeros que no tienen cuenta web) — el usuario prefirió dejarlo como está
por ahora.

## ✅ Fix: auditoría de Configuración (2026-08-01)

Revisadas las 4 sub-pestañas (Empresa, Marca, Operación, Integraciones) y sus
server actions (`app/actions/settings.ts`, `dispatch-settings.ts`,
`payments.ts`, `whop-connect.ts`, `quickbooks.ts`, `microsite.ts`). Horario de
operación / fechas bloqueadas ya estaba bien hecho desde antes
(`lib/policy/engine.ts` usa `Intl.DateTimeFormat` con la zona horaria de la
empresa) — no es el bug de siempre.

Un bug real encontrado, de la misma familia pero en un lugar nuevo:
**sincronización con QuickBooks** (`lib/quickbooks/sync.ts`,
`syncCompletedBookingsForCompany`) construía el `TxnDate` del Sales Receipt
con `booking.completed_at.slice(0, 10)` — la fecha UTC del timestamp, no la
fecha local de la empresa. Un viaje completado a las 11pm en Santo Domingo
(UTC-4) ya es medianoche+ en UTC, así que quedaba registrado en QuickBooks
un día después de como el operador lo ve en su propio panel. Fix: usa
`getZonedIsoDate` con `companies.timezone`.

Resto de la página (branding, portada del micrositio, servicios, Stripe
Connect, Whop Connect, pesos de dispatch) sin cambios — bien scopeado por
`company_id` en todas las acciones revisadas.

## ✅ Fix: auditoría de Equipo, Servicios adicionales, Firma electrónica, Asistente IA, AI Growth Assistant, Dominio personalizado, Partner Portals y Programa de referidos (2026-08-01)

Servicios adicionales (marketplace), Dominio personalizado y Programa de
referidos: código limpio, bien blindado (`company_referrals.expires_at` es
TIMESTAMPTZ real, no el bug de fecha-vs-zona-horaria), sin cambios.

Cuarta vez en el mismo día que aparece el patrón de zona horaria UTC del
servidor vs `companies.timezone` (ver `luxeride-reportes-payroll-compliance-timezone-2026-08-01.md`
y `luxeride-messages-promo-timezone-2026-08-01.md`), esta vez en las cuotas
mensuales de los add-ons de IA y en el reporte de comisión de partners:

1. **`/admin/team`** (pestaña Clientes) — el filtro de fecha de alta
   ("Desde"/"Hasta") comparaba en UTC del servidor. Ahora usa
   `zonedMidnightUtc`/`addIsoDays` con la zona horaria de la empresa.
2. **Asistente IA / AI Growth Assistant** — las 3 lecturas de "usado este
   mes" (`app/admin/assistant/page.tsx`, `app/admin/growth-assistant/page.tsx`
   y `app/actions/ai-growth.ts` `getAiGrowthUsageAction`) calculaban "primer
   día del mes" con `new Date().getFullYear()/.getMonth()` — el reseteo
   mensual de la cuota de conversaciones/generaciones ocurría a la
   medianoche UTC, no a la medianoche real del operador. Relevante porque
   esa cuota determina cuándo empieza a cobrarse el overage.
3. **Partner Portals — el más grave de esta ronda**: el reporte de comisión
   en `/admin/partners/[id]` usaba `completed_at <= 'YYYY-MM-DD'` (sin hora)
   como límite superior. Peor: `markPartnerPeriodPaidAction` (botón
   "Marcar pagado", congela el monto) tenía su PROPIO cálculo, aún más roto
   — comparaba `completed_at <= periodEnd` sin ningún sufijo de hora, lo que
   en la práctica excluía casi todo el último día del período. El monto que
   el operador veía en pantalla podía no coincidir con el que se congelaba.
   Ambos ahora comparten el mismo cálculo timezone-aware con límite superior
   exclusivo.
4. **Firma electrónica** — `signDriverAgreementAction`/`signCorporateAgreementAction`
   no verificaban que el `driverId`/`corporateAccountId` recibido perteneciera
   a la empresa del operador antes de insertar la firma (IDOR menor: no
   filtraba datos, pero permitía registrar una firma con `subject_id` de otra
   empresa). Ahora ambas verifican pertenencia antes de firmar.

## ✅ Fix: auditoría de Reportes, Nómina, Corporativo y Cumplimiento (2026-08-01)

Corporativo: código limpio, muy bien blindado contra IDOR (revisado a fondo,
sin cambios). El resto de esta ronda fue, otra vez, el mismo patrón de zona
horaria UTC-vs-empresa que ya venía apareciendo — pero esta vez en 3 lugares
con consecuencias reales (dinero y bloqueo operativo, no solo un filtro):

1. **`/admin/reports`** — el rango "este mes" y el filtro Desde/Hasta se
   calculaban en UTC del servidor. Además el CSV export
   (`/api/reports/bookings`) tenía el mismo bug de forma independiente.
   Ambos ahora usan `zonedMidnightUtc`/`addIsoDays` con límite superior
   exclusivo.
2. **`/admin/payroll` — el más grave**: el período de nómina que se le
   muestra al operador para calcular ganancias usaba un límite mal armado
   (`completed_at <= 'YYYY-MM-DD'`, sin hora, tratado como medianoche) que
   directamente EXCLUÍA cualquier viaje completado después de medianoche del
   último día del período. Peor: `markPayrollPeriodPaidAction` (el botón
   "Marcar pagado", que congela el monto) usaba ESE MISMO cálculo roto de
   forma independiente al de la página — un viaje que sí aparecía en pantalla
   podía quedar fuera del monto congelado, o viceversa. Ambos ahora comparten
   el mismo cálculo timezone-aware.
3. **Cumplimiento — el de mayor consecuencia operativa**: `isPast()` en
   `lib/compliance/engine.ts` (vencimiento de licencia, permiso, seguro,
   inspección) interpretaba una fecha `DATE` como medianoche UTC. Para una
   empresa en Santo Domingo (UTC-4), un conductor o vehículo con un
   documento "vence el 15" quedaba BLOQUEADO operativamente (no podía
   recibir viajes) desde las 8pm del día 14 — 4 horas antes de lo que
   realmente marca el documento, y por el resto de ese día completo. Fix:
   `isPast` distingue columnas `DATE` (limite exclusivo del día siguiente,
   zona de la empresa) de la única columna `TIMESTAMPTZ` heredada
   (`vehicles.insurance_expires_at`, que ya es un instante sin ambigüedad).
   `lib/compliance/recompute.ts` ahora pasa `companies.timezone` a las 3
   funciones puras. 2 tests nuevos fijan el comportamiento de frontera.

Ver también `luxeride-messages-promo-timezone-2026-08-01.md` y
`luxeride-pricing-tab-audit-2026-08-01.md` en la memoria — mismo patrón,
encontrado por tercera vez esta sesión en tabs distintas.

## ✅ Fix: auditoría de Cotizaciones, Mensajes, Reportes de conductor y Códigos promocionales (2026-08-01)

Cotizaciones y Reportes de conductor: código limpio, sin cambios.

Dos bugs reales de límite de fecha en zona horaria (mismo patrón ya corregido
antes para dashboard/precios/feriados — `new Date('YYYY-MM-DD...')` se
interpreta en UTC, no en la zona horaria de la empresa):

1. **`/admin/messages`** — el filtro de fecha "Desde"/"Hasta" comparaba contra
   límites en UTC del servidor. Un operador en Santo Domingo (UTC-4) perdía
   los mensajes de las 8pm-12am al filtrar "hoy". Ahora usa
   `zonedMidnightUtc`/`addIsoDays` (`lib/time/zoned-bounds.ts`) con la zona
   horaria de la empresa.
2. **Códigos promocionales — "Válido desde"/"Válido hasta"** — mismo bug pero
   en la base de datos: los inputs `<input type="date">` se guardaban tal
   cual en columnas `TIMESTAMPTZ`, por lo que un código "vigente hasta el 15"
   expiraba a las 8pm del 14 en Santo Domingo (4h antes de lo esperado), y
   uno "vigente desde el 15" se activaba 4h antes de lo esperado. Fix en
   `createPromoCodeAction`: `valid_from` se guarda como medianoche del día en
   la zona de la empresa, `valid_until` como el INICIO del día siguiente
   (límite exclusivo, cubre el día completo). `lib/promo/engine.ts` ajustado
   a `>=` para ese límite exclusivo + 2 tests nuevos de frontera.

Extra: confirm de eliminar una regla de recompensa automática estaba
hardcodeado en español pese a que el componente ya recibe el diccionario
i18n — corregido para usar el diccionario en los 3 idiomas.

## ✅ Fix: auditoría de Tarifas y cargos (/admin/pricing) (2026-08-01)

Tres hallazgos reales:

1. **`pricing_rules.airport_pickup_fee`/`airport_dropoff_fee` (fee plano por
   regla, activado por `booking_type` manual) nunca eran configurables desde
   la UI** — ni el formulario de "Agregar regla" ni la fila en edición tenían
   un input para esos campos (la edición solo los preservaba con inputs
   ocultos en 0). El motor de precios sí los aplicaba correctamente, pero
   como nunca se podían fijar a un valor > 0, el mecanismo estaba muerto en
   la práctica para toda regla creada desde que existe la UI. Fix: 2 inputs
   nuevos en `PricingAdvancedFields` (compartido entre alta y edición) +
   badge de aviso en la fila cuando el fee es distinto de cero, igual que ya
   se hacía con tarifa dinámica/vigencia.
2. **`company_admin` puede ver pero no guardar "Propinas y cargos" ni
   "Depósito y cancelación"** — las 4 server actions detrás de esos
   formularios exigían `requireRole('company_owner')` mientras la página
   permite entrar con `company_owner` O `company_admin`; al enviar el
   formulario, `company_admin` era expulsado sin aviso (redirect silencioso)
   perdiendo lo escrito. Decisión del usuario: relajar el permiso — las 4
   acciones (`updateGratuitySettingsAction`, `updateExtraFeesAction`,
   `updatePolicySettingsAction`, `updateDepositSettingsAction`) ahora
   aceptan también `company_admin`, igual que ya aceptaban las reglas de
   precio.
3. Textos de confirmación/estado hardcodeados en español dentro de
   componentes que ya reciben `t`/`actions` i18n (`PricingRuleActiveToggle`,
   `PricingRuleDeleteButton`, confirm de eliminar feriado) — corregidos para
   usar el diccionario existente en los 3 idiomas.

Zonas de servicio y Reservaciones (rondas previas) y el resto de Tarifas y
cargos (motor de precios, feriados, FAQ) quedaron limpios sin cambios.

## ✅ Fix: cargo por aeropuerto configurado en /admin/airports nunca se cobraba (2026-08-01)

Auditoría de las pestañas Zonas de servicio, Reservaciones y Aeropuertos.
Zonas de servicio y Reservaciones: código limpio, sin bugs. Aeropuertos: se
encontró que `company_airports.pickup_fee`/`dropoff_fee` (configurado por
aeropuerto específico en `/admin/airports`) nunca se leía en ningún flujo de
cotización/reserva — solo existía el mecanismo distinto y ya funcional de
`pricing_rules.airport_pickup_fee`/`airport_dropoff_fee` (fee plano por regla,
disparado por `booking_type` manual). Un operador podía configurar $25 de
recogida en JFK y esa reserva jamás cobraba el cargo.

Fix (decisión del usuario: detección automática por cercanía, sin fricción
para el pasajero): nuevo `lib/pricing/airports.ts` (puro, testeado en
`airports.test.ts`) que compara pickup/dropoff contra la lat/lng de cada
aeropuerto configurado y activo de la empresa; si cae dentro de 1 milla,
aplica el fee de ESE aeropuerto (pickup y dropoff se evalúan independiente,
pueden ser aeropuertos distintos). Cableado en `createBookingAction` y
`createPublicBookingAction` (`app/actions/bookings.ts`) siguiendo el mismo
patrón que `luggageOverageFee`: se suma a `total_amount` y se agrega como
fila(s) `booking_fees` (`airport_pickup_fee`/`airport_dropoff_fee`) para
desglose en el detalle de la reserva. No se tocó `calculateQuoteAction` ni
`getPublicVehicleQuotesAction` (el aviso de cargo en el preview de cotización
queda fuera de este alcance, igual que se hizo con equipaje).

## ✅ Capacidad de equipaje por tipo de vehículo + cargo automático por exceso (2026-07-31)

El pasajero podía declarar cuántas personas viajaban pero nunca cuánto
equipaje llevaba — un tipo de vehículo con capacidad de 4 pasajeros podía
recibir una reserva con 6 maletas facturadas sin que el sistema lo supiera ni
lo comunicara. Inspirado en cómo Blacklane lo resuelve (ícono de maletas +
cantidad junto al de pasajeros al elegir vehículo).

- **Migración** `supabase/migrations/20260804000084_vehicle_luggage_capacity.sql`
  (pendiente de aplicar — pegar en el SQL Editor de Supabase): agrega 3
  columnas de capacidad a `vehicle_types` (equipaje de mano / maleta
  facturada / maleta facturada extragrande, defaults 2/2/0) y 3 columnas de
  declaración a `bookings` (nullable).
- **Admin → Flota**: los 3 campos de capacidad en crear/editar tipo de
  vehículo, y se muestran en la lista (`X pax · Y/Z/W maletas`).
- **Cargo automático por exceso**: reutiliza el fee plano `extra_luggage_fee`
  que YA existe (el mismo que usa el conductor manualmente vía "Agregar
  cargo" en `driverAddExtraChargeAction`) — si lo declarado excede la
  capacidad del vehículo elegido, se agrega automáticamente una fila a
  `booking_fees` (`type: 'luggage_overage_fee'`) y se suma al `total_amount`,
  tanto en el guest checkout web como en reservas creadas por staff y desde
  la app nativa. Nunca bloquea la reserva — solo informa el cargo antes de
  confirmar.
- **Web** (`booking-wizard.tsx`): 3 inputs de equipaje en el paso de
  pasajero, capacidad de equipaje visible en la tarjeta de cada vehículo, y
  aviso de cargo por exceso antes de confirmar (preview cliente; el monto
  real y autoritativo lo calcula el server).
- **App nativa del pasajero**: mismos 3 campos en `NewBookingScreen`
  (steppers), capacidad visible en `VehicleSelectScreen` (chip con ícono de
  maleta), y resumen + aviso de cargo en `BookingConfirmScreen`.
- **i18n**: claves nuevas en `dict.admin.fleet.typeForm` y `dict.wizard`
  (en/es/pt). La app nativa no tiene sistema de i18n — textos hardcodeados en
  español, igual que el resto de esa app.

Verificado: `tsc --noEmit` limpio en `apps/web` y `apps/passenger-mobile`,
`vitest run` 256/256, `npm run build` exitoso en `apps/web`. El flujo manual
del conductor (`driverAddExtraChargeAction`) queda intacto, sin cambios.

## ✅ Fix: foto real del vehículo en el paso "Vehículo" del wizard web (2026-07-31)

`apps/web/app/(booking)/book/[slug]/booking-wizard.tsx` mostraba siempre un
icono por clase de vehículo (`CLASS_ICONS`) en el paso 2 (lista de vehículos)
y en el resumen del paso 3, **ignorando** `vehicleType.imageUrl` — el campo
ya llegaba correcto desde `getPublicVehicleQuotesAction` (mapea
`vehicle_types.base_image_url`), solo faltaba usarlo en el render. Se agregó
`<img>` con fallback al icono cuando no hay foto, mismo patrón ya usado y
funcionando en `apps/passenger-mobile/screens/VehicleSelectScreen.tsx`.

Cubre también la PWA instalable (`/book/[slug]` es el `start_url` del
manifest, mismo componente) — un solo fix arregla web + PWA. La app nativa de
Android (passenger-mobile) YA mostraba la foto correctamente, no tenía el bug.

Verificado: `tsc --noEmit` limpio, `vitest run` 256/256, `npm run build`
exitoso, y confirmado en navegador que la URL real de Supabase Storage del
vehículo carga sin problemas de CORS.

## ✅ Reportes ampliados + Google Ads conversion tracking (2026-07-30)

El usuario pidió (1) revisar `/admin/reports` para agregar mejoras y (2) evaluar
cómo integrar Google Ads. Investigación previa confirmó que GA4 ya existía en
`app/layout.tsx` pero es analítica **propia de LuxeRide** (una sola cuenta,
toda la plataforma) — no sirve para que cada operador mida sus propias
campañas. El 2026-07-22 el usuario ya había descartado explícitamente
construir gestión de campañas de Ads (fuera de alcance); esta iniciativa
confirma ese alcance: **solo conversion tracking + UTM/gclid**, nada de
creación/gestión de campañas desde LuxeRide.

**Reportes — todo lo pedido, reusando lo existente (sin motores nuevos):**
- Ingresos por canal (directo/corporativo/afiliado/partner) — clasificado sin
  tabla nueva: `corporate_account_id`/`partner_id` ya en `bookings`, afiliado
  se detecta por presencia en `affiliate_trips.booking_id`.
- Comparación de ingresos vs. período anterior (cálculo directo, NO reusa
  `scoreRevenueHealth` de `lib/operator-score/engine.ts` — esa función da un
  score 0-100 normalizado, no un delta real).
- Gráfico de tendencia: se reusa `BookingsTrendChart` tal cual (el mismo del
  dashboard), con sus propios rangos, independiente del filtro Desde/Hasta.
- Desglose por tipo de reserva (`bookings.type`, reusando las etiquetas ya
  existentes en `dict.admin.bookingDetail.types`).
- Puntualidad de flota agregada: reusa `computeAccountSla()` de
  `lib/corporate/sla.ts` sin ninguna cuenta corporativa de por medio (la
  función solo pide `status/scheduled_at/arrived_at`).
- Facturación corporativa pendiente/vencida: nueva query agrupada sobre
  `invoices` (la tabla ya tenía todo lo necesario).
- CSV (`/api/reports/bookings`): 2 columnas nuevas, conductor y vehículo.

**Google Ads — conversion tracking + UTM/gclid:**
- Migración `20260803000083_bookings_attribution.sql`: `bookings.attribution
  JSONB DEFAULT '{}'`.
- Cada operador pega su propio GA4 Measurement ID en Configuración →
  Integraciones (`companies.settings.tracking.ga_measurement_id`, sin
  migración nueva — reusa el JSONB existente).
- Captura de "primer toque": `booking-wizard.tsx` lee `utm_source/medium/
  campaign/term/content/gclid` de la URL al montar y los guarda en
  `sessionStorage` (nunca se sobreescribe si ya hay uno guardado en la
  sesión) — verificado en navegador que persiste incluso al recargar sin
  parámetros.
- `createPublicBookingAction` persiste la atribución (whitelist estricta de
  campos, nunca JSON arbitrario del cliente).
- `components/booking/conversion-tracker.tsx`: inyecta el gtag.js del
  operador (NO el de LuxeRide) y dispara un evento `purchase` (value+currency,
  reconocido automáticamente por GA4 para ROAS) — en dos puntos: la
  confirmación in-page (reservas sin pago online) y el nuevo
  `payment/success/page.tsx` (ahora server component dinámico que resuelve la
  reserva por `booking_number`, antes era 100% estático sin acceso a datos).

Verificado: `tsc --noEmit` limpio, `vitest run` 256/256, `npm run build`
exitoso, y en navegador con datos reales — captura de UTM/gclid confirmada en
`sessionStorage` con first-touch correcto tras recarga sin parámetros.

## ✅ Blindar cuentas corporativas frente a Uber for Business/Elite (2026-07-30)

5ª y última recomendación del paquete anti-consolidación (las otras 4 son la
entrada de arriba). El usuario identificó las cuentas corporativas como
exactamente el segmento que Uber for Business/Elite está cazando, y pidió
reforzar lo que ya existía (crédito, cost centers, portal) con **SLAs
visibles, reportes, onboarding más fácil**. Investigación previa (Explore)
confirmó: `require_approval`/`approval_threshold`/`allow_personal_trips` en
`corporate_accounts` son columnas sin ninguna lógica que las lea (placeholders
muertos, sin tocar); `addCorporateMemberAction` exigía que el invitado YA
tuviera cuenta LuxeRide, sin alternativa; el portal (`/corporate/*`) estaba
100% hardcodeado en español, sin pasar por `getDict()`.

- **SLA visible**: `lib/corporate/sla.ts` (`computeAccountSla`, puro,
  testeado) — mismo criterio de gracia de 10 min ya usado en
  `admin/drivers/[id]`, pero agregado por cuenta corporativa en vez de por
  conductor. Visible tanto en `/corporate/dashboard` (cliente) como en
  `/admin/corporate/[id]` (operador, para verlo antes de que el cliente se
  queje). Sin migración — se calcula al vuelo desde `bookings`.
- **Reportes self-service**: `/api/reports/bookings` ahora acepta
  `corporate_account_id` y permite que el propio manager corporativo
  descargue el CSV de SU cuenta directamente desde el portal — con guardrail
  de auto-scoping (nunca confía en el query param sin verificar pertenencia
  en `corporate_members`, mismo patrón que `updateCorporateMemberLimitsAction`).
- **Onboarding por link**: nueva tabla `corporate_invite_tokens` (clon del
  patrón ya establecido en `affiliate_invite_tokens` — capability-URL de un
  solo uso, RLS sin políticas, solo service-role). Tanto el operador como el
  propio manager corporativo pueden generar el link
  (`createCorporateMemberInviteAction`); la página pública
  `/corporate/join/[token]` crea la cuenta nueva o, si el email ya tiene
  cuenta LuxeRide, la vincula directo sin pedir password de nuevo. El flujo
  "agregar por email de usuario ya registrado" se mantiene sin cambios como
  alternativa rápida.
- **i18n completo del portal**: `dict.corporate` nuevo en en/es/pt —
  `/corporate/dashboard`, `/corporate/layout`, `/corporate/book` y
  `TeamLimitsForm` migrados de texto hardcodeado a `getDict()`.
- **Bug real encontrado y corregido durante la verificación en navegador**:
  el middleware bloqueaba `/corporate/*` en bloque (requiere sesión), y
  además `app/corporate/layout.tsx` (que llama `requireRole`) envolvía TODAS
  las rutas anidadas — incluida la nueva página pública
  `/corporate/join/[token]`, redirigiéndola a login antes de renderizar. Se
  resolvió moviendo `layout.tsx`, `dashboard/` y `book/` a un route group
  `app/corporate/(portal)/` (no cambia las URLs) para que la página de
  invitación quede fuera del layout autenticado, más una excepción explícita
  en el middleware para `/corporate/join`.

Verificado: `tsc`, `vitest` (256 tests, incluye 7 nuevos de `sla.test.ts`),
`next build`, y en navegador: `/corporate/join/[token]` con token inválido
renderiza correctamente en público (antes redirigía a login), `/corporate/dashboard`
sigue protegido.

## ✅ Fortalecer LuxeRide frente a Uber Elite/Blacklane: 4 iniciativas + oferta de fundadores (2026-07-29)

El usuario compartió dos investigaciones (ChatGPT) comparando LuxeRide contra
Uber Elite (su nuevo tier premium) y Blacklane (que Uber está adquiriendo).
Se descartó explícitamente construir un marketplace propio de LuxeRide
(contradice la decisión de white-label puro del 2026-06-14). En su lugar,
4 iniciativas defensivas compatibles con el modelo actual, más una revisión
de precios para primeros clientes:

- **Copy: demanda propia + "dueño de tu pasajero"** — 4ª fila en
  `landing.showcase[]` ("Para tu marca") con la personalización por
  preferencia del pasajero (`passenger_preferences`, ya construida, nunca
  mencionada antes en el copy) como prueba concreta; nueva pregunta de FAQ
  ("¿Quién es dueño de la relación con mis pasajeros?", se propaga solo al
  JSON-LD `FAQPage`); `llms.txt` ampliado con comparación explícita contra
  plataformas tipo marketplace. En `en/es/pt`.
- **"LuxeRide Verified"** (`lib/compliance/verified.ts`) — sello de
  confianza en el micrositio que reusa el `compliance_score` YA calculado
  (mismo umbral ≥90 que ya define `compliant` en `lib/compliance/engine.ts`)
  en vez de construir un motor nuevo o usar el Operator Score (demasiado
  volátil para un sello de confianza al pasajero). `VerifiedBadge` (dos
  variantes, dark/light) cableado en las 4 plantillas de micrositio (noir +
  Ivory/Bold/Corporate). Antigüedad del vehículo (paridad exacta con Uber
  Elite) queda fuera de v1 a propósito.
- **Protocolo de respaldo (Guaranteed Ride)** — el más grande de los 4.
  `lib/dispatch/risk.ts` (puro, testeado): `isDriverAtRisk()` marca riesgo
  si el pickup está a ≤45 min Y (sin GPS reciente en 20 min, O la distancia
  actual implica que no llega ni a velocidad conservadora). Nuevo
  `reassignForRisk()` en `lib/dispatch/auto-assign.ts` reutiliza
  `scoreDrivers`/`haversineMiles` y el mismo filtrado de candidatos que la
  auto-asignación, excluyendo al conductor en riesgo, con guard de carrera
  (`WHERE driver_id = <original>`). Nueva ruta
  `app/api/cron/dispatch-risk-check` la dispara. **Decisión de arquitectura
  clave**: el plan Hobby de Vercel solo permite crons 1 vez al día, así que
  esta vigilancia (necesita correr cada ~5 min) usa **pg_cron de Supabase**
  en vez de un cron de Vercel — primera vez que se usa pg_cron en este
  proyecto. Disponible en TODOS los planes (opt-in, toggle nuevo
  "Protocolo de respaldo" en el Dispatch Board, `companies.settings.
  dispatch.backup_protocol_enabled`). Al pasajero le llega un mensaje
  tranquilizador distinto del genérico "conductor asignado" (nuevo template
  `driver_reassigned_reassurance`); si no hay candidato, se avisa al
  dispatcher vía `pushAdminNotification` en vez de fallar en silencio.
  **Pendiente del usuario**: pegar la migración
  `20260801000081_dispatch_risk_reassign.sql` en el SQL Editor de Supabase,
  reemplazando `<APP_URL>` y `<CRON_SECRET>` por los valores reales antes de
  correrla — sin eso la ruta responde 401 y el protocolo nunca corre.
- **Oferta de fundadores** — banner en la sección de precios del landing
  (copy-only, `dict.landing.foundingOffer`): 50% de descuento los primeros 3
  meses, limitado a los primeros 15 operadores. El descuento en sí NO se
  construyó en código — se recomienda configurarlo como cupón directo en
  Whop (mismo patrón que el resto de la config de Whop en este proyecto).
  Los precios base actuales ($99–549 + 0.5%–3%) se evaluaron y NO se tocaron
  — ya son competitivos frente a canales tipo Uber Elite; la fricción real
  de un primer cliente es el riesgo de comprometerse antes de ver
  resultados, no el precio en sí.

Verificado: `tsc`, `vitest` (249 tests, incluye 7 nuevos de `risk.test.ts`),
`next build`, y revisión en navegador del landing (4ª fila del showcase,
FAQ nueva, banner de oferta de fundadores, todo el copy renderizando bien).

## ✅ Tracking en vivo: conductor en segundo plano + estado reactivo (2026-07-29)

El usuario reportó que, con un viaje en curso, no veía el vehículo avanzar
por las calles ni en la PWA, ni en la app Android del pasajero, ni en la
vista del conductor — solo actualizaciones de estado, y esas tampoco se
reflejaban solas (había que refrescar a mano). Investigación con dos
agentes (código real, no supuestos) antes de tocar nada:

- **La mayoría de las pantallas YA tenían mapa interactivo real con
  Realtime/animación** (`/track/[id]` con `InteractiveLiveMap` +
  `useGlidingPosition`; `TripTrackingScreen.tsx` de passenger-mobile con
  `react-native-maps` + Realtime instantáneo sobre `trip_locations`). Eso
  no era lo que había que arreglar.
- **Causa raíz real**: `apps/driver-mobile/lib/locationReporter.ts` (y su
  equivalente web) solo reportaban la posición del conductor con la app en
  PRIMER PLANO. Un conductor real usa Waze/Google Maps para navegar durante
  el viaje — en cuanto LuxeRide queda en segundo plano, dejaba de enviar
  posiciones por completo. No importa qué tan bueno sea el mapa del
  pasajero si no llegan filas nuevas a `trip_locations`.
- **Segundo problema, más chico**: `TripTrackingScreen.tsx` cargaba
  `bookings.status` una sola vez al montar — si el conductor avanzaba el
  viaje con la pantalla abierta, el texto no cambiaba solo.

Se descartó del alcance (no relacionado con el desplazamiento del
vehículo): reemplazar la imagen estática del propio conductor en
`driver-mobile` por un mapa interactivo (ya tiene botones a Waze/Google
Maps, no necesita ver su propio punto moverse), y el auto-refresco de
`/admin/bookings` (`/dispatcher/dashboard` ya es reactiva).

**Lo construido:**
- `apps/driver-mobile/lib/backgroundLocationTask.ts` (nuevo): tarea de
  `expo-task-manager` registrada a nivel de módulo (importada una sola vez
  desde `index.ts`, antes de `registerRootComponent`), lee `{bookingId,
  status}` de AsyncStorage (no puede leer `useState`, corre fuera de React)
  y reporta posición vía `callDriverApi('report-location', ...)`.
- `useDriverLocationReporter` ahora pide permiso en dos pasos (foreground,
  luego "Permitir siempre") y usa `Location.startLocationUpdatesAsync` con
  foreground service cuando se concede; si se deniega, cae exactamente al
  `watchPositionAsync` de foreground de siempre — no rompe nada para quien
  no lo conceda. Banner nuevo (`backgroundUnavailable`) sugiere activar
  "Permitir siempre" desde Configuración, y **reintenta el permiso solo al
  volver de Settings** (`AppState` + `settingsOpenedRef`), no solo lo
  oculta.
- `app.json`: plugin `expo-location` con `isAndroidBackgroundLocationEnabled`
  + `isAndroidForegroundServiceEnabled`, e `ios.infoPlist.UIBackgroundModes:
  ["location"]`. **Requiere un nuevo build EAS** para tomar efecto — no
  disparado, por la regla de solo hacer build con confirmación explícita.
- **Nota pendiente para cuando se publique en Play Store**: usar
  `ACCESS_BACKGROUND_LOCATION` exige una "Declaración de uso de ubicación en
  segundo plano" en Play Console (trámite de revisión de Google, no de
  código). Hoy la distribución es `internal`, que no pasa por eso.
- `apps/passenger-mobile/screens/TripTrackingScreen.tsx`: nuevo canal
  Realtime sobre `UPDATE` de `bookings` (mismo patrón que el canal ya
  existente de `trip_locations`) — el estado se actualiza solo, sin
  migración de RLS nueva (verificado: la política
  `customers_select_own_bookings` no depende de columnas que cambien al
  avanzar el viaje).
- Un pase del agente `mobile-ux-reviewer` encontró y se corrigieron dos
  bugs reales antes de cerrar: (1) una condición de carrera que podía dejar
  un `watchPositionAsync` filtrado reportando con un `bookingId` obsoleto
  si `requestBackgroundPermissionsAsync` tardaba (typo Android 11+ manda a
  Settings) y el efecto ya se había limpiado — se agregó chequeo de
  `cancelled` después de cada `await`; (2) el banner abría Configuración
  pero nunca reintentaba el permiso al volver, así que un conductor que
  seguía la instrucción exacta del banner igual se quedaba en modo
  foreground-only el resto del viaje — resuelto con el reintento descrito
  arriba.

**Sin verificar visualmente** (no hay simulador en este entorno): `tsc
--noEmit` limpio en ambas apps móviles. El flujo real de permisos y el
foreground service solo se pueden probar en un dispositivo físico, después
del build EAS que el usuario decida disparar.

## ✅ Reseñas en Google/TripAdvisor + recompensas automáticas (2026-07-25)

Dos pedidos del usuario que resultaron atados por la MISMA restricción de
política, y conviene no olvidarlo al retomar:

**Ni Google ni TripAdvisor permiten publicar reseñas por API.** Verificado
contra sus docs actuales: Google Business Profile solo permite LEER y
RESPONDER; el Content API de TripAdvisor es solo lectura (su Review Express
API es para hoteles con acuerdo de conectividad, no aplica a transporte).
Además Google endureció su política en **febrero 2026**: prohíbe incentivar
reseñas (descuentos, regalos) y hacer *review gating* (mandar solo a los
contentos). Sanciones civiles hasta $51,744 por violación más eliminación de
reseñas y penalización del listado.

- Migración 78 (YA CORRIDA): `companies.google_place_id` + `tripadvisor_url`,
  y tablas `reward_rules` / `reward_grants`.
- `/review/[id]`: tras calificar se ofrecen botones a Google
  (`search.google.com/local/writereview?placeid=…`) y al listado de
  TripAdvisor. **Se muestran a TODOS**, den 5 estrellas o 1, y sin ofrecer
  nada a cambio. Configurable en Configuración → Marca y micrositio.
- El auto-redirect de 30s al micrositio se desactiva cuando hay enlaces
  externos: arrancarle la página mientras decide sería lo contrario de lo
  que se busca.

**Recompensas automáticas** (`lib/rewards/engine.ts`, puro, 22 tests):
El usuario pidió "más de 4.5 estrellas → descuento". Se construyó SIN ese
disparador, por dos razones independientes:
  1. Es exactamente el embudo que Google sanciona (reseña incentivada +
     gating), sobre todo combinado con el botón de arriba.
  2. `drivers.rating` alimenta el score de auto-asignación
     (`lib/dispatch/scoring.ts`). Si el pasajero aprende que 5 estrellas da
     descuento, en un mes todos los conductores tienen 5 estrellas y esa
     señal deja de distinguir a nadie. Se estaría pagando por destruir el
     dato que reparte los viajes.

Disparadores que SÍ existen: `trips_completed`, `total_spent`, `first_trip`,
`inactivity_days` (reconquista) y `review_submitted` (por dejar la reseña,
**sin mirar la nota**, que resuelve la intención sin el daño).

- Se evalúan al completar viaje (driver.ts y bookings.ts) y al reseñar.
- La identidad del cliente es email/teléfono normalizado, no `customer_id`:
  la mayoría de reservas son de invitados sin cuenta.
- `UNIQUE (rule_id, customer_key)` en `reward_grants` es la garantía dura
  contra otorgar dos veces por carrera. El grant se inserta ANTES de crear el
  código: si choca, nadie crea un código duplicado.
- UI en `/admin/promo-codes`, ahora con pestañas Manuales / Automáticas.
  Mismo add-on de pago que los códigos manuales.

**Disparador de cumpleaños (2026-07-29, migración 79 YA CORRIDA):**
El usuario notó que `user_profiles.date_of_birth` ya se captura desde la 69
y pidió agregarlo como disparador — se había quedado fuera por error. A
diferencia de los demás, no lo dispara un viaje ni una reseña: lo dispara el
calendario, así que:
- `reward_grants.period_key` (nuevo, default `'once'`) deja que el
  cumpleaños se repita cada año: el `UNIQUE` pasó a ser
  `(rule_id, customer_key, period_key)`. Para cumpleaños `period_key` es el
  año en curso; para todo lo demás sigue siendo `'once'` (una vez en la vida,
  comportamiento sin cambios).
- Cron nuevo `/api/cron/birthday-rewards` (7am, `vercel.json`): por cada
  empresa con una regla de cumpleaños activa, recorre `user_profiles` (rol
  `customer`, con fecha de nacimiento) buscando a quién le toca hoy —
  comparando solo mes/día, nunca el año.
- El email del cliente no vive en `user_profiles` sino en `auth.users`
  (mismo patrón que `getSuperAdminEmails` en `lib/notifications/index.ts`).
- 6 tests nuevos en `engine.test.ts` (28 en total).

**Campo de Google Place ID duplicado (2026-07-29, migración 80 YA CORRIDA):**
El usuario detectó que había DOS campos "Google Place ID" en la misma
pestaña de Configuración: uno preexistente dentro de Portada (alimentaba el
carrusel de reseñas del micrositio vía `settings.site.googlePlaceId`, un
JSON) y el nuevo que se agregó para el botón de reseña de más arriba
(columna dedicada `companies.google_place_id`). Se consolidó en UNO solo:
- Fuente única = la columna `companies.google_place_id`. Se retiró el input
  duplicado de `CoverForm`; el único campo que queda vive en la sección
  "Reseñas en Google y TripAdvisor".
- Migración 80 hace el backfill: copia `settings.site.googlePlaceId` a la
  columna para empresas que lo habían configurado por el campo viejo.
- El micrositio (`book/[slug]/page.tsx`) ahora lee la columna primero, con
  fallback al valor viejo del JSON solo por si acaso.

**Sin verificar en navegador**: requiere sesión iniciada. Verificado con
`tsc`, 242 tests y `npm run build`.

## ✅ Reorganización de "lo monetario" a /admin/pricing (2026-07-25)

El usuario notó que Reglas de precio y Configuración tenían configuración
monetaria repartida (propinas, cargos extra en viaje, depósito, política de
cancelación vivían en Configuración; las reglas de tarifa en otra página).
Pidió agruparlo para que la empresa no tenga que saltar de un sitio a otro.

- `/admin/pricing` ahora es una página con pestañas (`PricingTabs`, mismo
  patrón pill-tab que Growth Assistant): **Reglas · Propinas y cargos ·
  Depósito y cancelación · Feriados**.
- Se movieron ahí: Propinas (`updateGratuitySettingsAction`), Cargos extra en
  viaje (`updateExtraFeesAction`), Política de cancelación
  (`updatePolicySettingsAction`), y el Depósito por adelantado — este último
  es nuevo (`updateDepositSettingsAction`) porque antes vivía mezclado dentro
  del formulario de "Reservas" (horarios de operación, fechas bloqueadas).
- `updateBookingSettingsAction` ahora hace merge sobre `settings.booking` en
  vez de sobrescribirlo completo: si no, guardar los horarios de operación
  borraría el depósito de la empresa sin que nadie lo tocara (y viceversa).
- Cobros (Whop Connect, QuickBooks) se quedan en Configuración a propósito:
  es conectar una cuenta externa, no fijar un precio — tarea de una sola vez,
  no algo que se ajuste cada semana.
- Sidebar: la entrada pasó de "Reglas de precio" a "Tarifas y cargos" para
  reflejar que ya no son solo reglas.

**Segunda pasada — Configuración también en pestañas:**
- `/admin/settings` pasó de 14 secciones en un solo scroll de ~1000 líneas a
  4 pestañas: **Empresa** (datos, suscripción, facturación adicional) ·
  **Marca y micrositio** (logo/color, portada, servicios, link de reservas,
  widget) · **Operación** (ventana de reservas, recordatorios, pesos del
  dispatch) · **Integraciones** (Whop Connect, QuickBooks, Stripe oculto).
- `components/admin/section-tabs.tsx` reemplaza al `pricing-tabs.tsx` de la
  primera pasada: es el mismo componente para ambas páginas, así no derivan.
- **Consciente del hash**: hay enlaces externos a `/admin/settings#subscription`
  (correos del cron de vencimiento, banner de error, popup de expiración) y a
  `#payments` / `#branding` (checklist de onboarding). Meter las secciones en
  pestañas los habría roto, así que cada pestaña declara qué anclas contiene y
  el componente selecciona la pestaña correcta al leer `location.hash`.
- De paso: `#payments` y `#branding` **no existían como anclas** — el checklist
  de onboarding llevaba a la nada desde siempre. Ahora existen.
- El aviso de "esto se mudó a Precios" que se había puesto en Reservas se
  quitó a pedido del usuario: no lo consideró necesario.

## ✅ Tarifa dinámica real + score compuesto de auto-asignación (2026-07-25)

Dos huecos que el usuario marcó como graves. En ambos casos la base de datos
ya tenía las columnas; lo que faltaba era usarlas.

**Precios — `pricing_rules` tenía cuatro columnas muertas:**
- `holiday_surcharge_pct` se guardaba y se pasaba por la UI pero NUNCA se
  aplicaba: el motor no sabía qué día es feriado. Se creó
  `company_holidays` (migración 77, YA CORRIDA) + `lib/pricing/holidays.ts`,
  y `calculateFare` ahora lo aplica usando la fecha LOCAL de la empresa
  (`getLocalTimeParts` devuelve `isoDate` en la misma llamada a `Intl` que la
  hora, para no cobrar el feriado equivocado en viajes de medianoche).
- `surge_enabled` / `surge_multiplier` funcionaban en el motor pero iban como
  `<input type="hidden">`: el operador no podía encenderlos. Ahora son campos
  editables (checkbox + multiplicador topado a 5x).
- `valid_from` / `valid_until` / `days_of_week` no se consultaban en ningún
  lado: una regla de "temporada alta 15 dic – 15 ene" se aplicaba todo el
  año. `bestRule` ahora descarta reglas fuera de vigencia ANTES de cualquier
  prioridad, y los tres campos son editables.
- FAQ desplegable en "Reglas de precio" (pedido explícito): cómo se elige la
  regla, cómo se acumulan los recargos, qué pasa si nada aplica.
- Panel de feriados de la empresa en la misma página.

**Dispatch — `lib/dispatch/scoring.ts` (nuevo, puro, 17 tests):**
El algoritmo ordenaba SOLO por "menos viajes completados hoy". Justo pero
ciego. Ahora hay cuatro señales normalizadas 0-100 y ponderadas:
- **Cercanía** (haversine contra `driver_presence`, que ya existía para el
  mapa del Dispatch Board). GPS de más de 90 min se ignora; sin GPS el
  conductor saca puntaje medio, ni premio ni castigo.
- **Reparto justo** — medido sobre la DIFERENCIA entre el que más y el que
  menos viajes lleva. Medirlo contra el máximo daba 0 a todos cuando estaban
  empatados; mismo orden pero puntaje engañoso en la bitácora. Lo encontró un
  test.
- **Calificación** (`drivers.rating`) — conductor nuevo sin estrellas no queda
  penalizado.
- **Confiabilidad** — rechazos en `booking_events` de los últimos 30 días.

Además: filtro DURO por tipo de vehículo (ya no se manda un sedán a una
reserva que pidió SUV), pesos configurables por empresa en Configuración
(`companies.settings.dispatch_weights`, con merge para no pisar el resto), y
el desglose del puntaje queda en `booking_events` para que el operador pueda
ver por qué le tocó a ese conductor.

**Sin verificar en navegador**: `/admin/pricing` y `/admin/settings` requieren
sesión iniciada y no puedo autenticarme. Verificado con `tsc`, 214 tests y
`npm run build`.

## ✅ Visibilidad al pasajero si falla el guardado de tarjeta (2026-07-25)

El usuario suscribió el webhook `whop-connect` a `setup_intent.succeeded` +
`canceled` + `requires_action`, y pidió que el pasajero SEPA por qué falló
(no solo quedarse con el mismo banner de "guarda tu tarjeta").

- **`getCardSetupStatusAction(companySlug, phone)`** (payments.ts) — consulta
  el estado real del intento en Whop (`client.setupIntents.list`, Whop no
  permite filtrar por metadata directo así que se listan los 20 más
  recientes de la empresa y se busca por `metadata.phone`). Devuelve
  `status` ('succeeded'/'canceled'/'requires_action'/'processing'/
  'not_found') + `error_message` real de Whop si lo hay (ej. "tarjeta
  rechazada").
- Ruta móvil nueva `card-setup-status`.
- **`BookingConfirmScreen.tsx`**: tras cerrar el WebBrowser del setup
  checkout, consulta este status antes de solo re-chequear la tarjeta —
  si no fue 'succeeded', muestra el `error_message` de Whop si existe, o
  un mensaje específico según la causa (canceló / banco pidió un paso
  extra / procesando / desconocido).
- Verificado: `tsc --noEmit` en ambos apps, `vitest run` (185/185),
  `npm run build`.

## ✅ Cobro de la diferencia cuando "Pagar ahora" + cargo extra durante el viaje (2026-07-25)

El usuario preguntó qué pasa con pasajero/equipaje extra (`driverAddExtraChargeAction`)
o una parada agregada (`applyStopToBooking`) cuando el pasajero ya pagó
completo con "Pagar ahora" — ambas ya subían `bookings.total_amount` en
tiempo real, pero antes de este fix el excedente se quedaba SIN forma
automática de cobrarse en la mayoría de los casos (solo existía un checkout
de seguimiento inmediato para el caso muy específico de parada agregada
por el pasajero desde `/track/[id]` con Whop/Stripe Connect — para
pasajero/equipaje extra, o parada agregada por el CONDUCTOR, no había nada).

- **`chargeWithSavedWhopCardAction`** (app/actions/payments.ts) ya NO
  rechaza si existe un pago exitoso previo — calcula cuánto se cobró
  (`paidSoFarCents`) y cobra solo la DIFERENCIA (`total_amount` actual menos
  lo ya pagado). Si no hay nada pagado, la diferencia ES el monto completo
  (mismo comportamiento de siempre para quien llama esto sin pago previo:
  el wizard público y "pagar con tarjeta guardada" en Mis viajes). Bloquea
  con error solo si hay un cobro `processing` en curso (evita carrera).
- Como `autoChargeDeferredCardInBackground` (llamado al completar el viaje,
  ver entrada de abajo) ya reusa esta misma función, el flujo queda
  unificado: no importa si el pasajero pagó todo de una vez, pagó al
  finalizar, o le agregaron un cargo extra a mitad de camino — al completar
  el viaje SIEMPRE se cobra automático cualquier saldo pendiente a la
  tarjeta guardada, sin importar el origen del cargo (conductor o pasajero).
- Sin cambios en `driverAddExtraChargeAction`/`applyStopToBooking` — siguen
  subiendo `total_amount` igual que siempre, el fix está enteramente en
  cómo se cobra después. El checkout de seguimiento inmediato para parada-
  agregada-por-pasajero (`createStopChargeIfPaidOnline`) se dejó igual,
  como un intento adicional de cobro proactivo — si el pasajero no lo paga,
  el auto-cobro al completar el viaje lo recoge de todas formas.
- Verificado: `tsc --noEmit`, `vitest run` (185/185), `npm run build` — los
  3 limpios, incluye confirmar que los otros 2 call sites existentes de
  `chargeWithSavedWhopCardAction` (wizard público, Mis viajes) no cambiaron
  de comportamiento (nunca tienen un pago previo en ese punto).

## ✅ Método de pago declarado al reservar (modelo Uber) — app pasajero (2026-07-25)

El usuario pidió que el pago se declare desde el INICIO de la reserva (no al
terminar el viaje como antes), con "Pagar ahora" como opción prioritaria
visualmente, pero permitiendo también "Tarjeta al finalizar" (se cobra solo
al completar el viaje, como Uber) o "Efectivo". Requirió investigar y usar
la API de Whop "Setup Intents" (guardar tarjeta sin cobrar) — confirmado
contra docs.whop.com que sí existe antes de construir nada.

- **Migración 72**: `bookings.payment_method_intent` ('card' | 'cash').
- **`lib/whop/checkout.ts`**: `createWhopSetupCheckout()` — checkout modo
  `'setup'` de Whop (guarda tarjeta, cobra $0).
- **`app/actions/payments.ts`**: `getSavedWhopCardByPhoneAction` /
  `createCardSetupCheckoutAction` (corren ANTES de que la reserva exista,
  por eso son por teléfono+slug, no por bookingId) y
  `autoChargeDeferredCardInBackground(bookingId)` — cobra automático con
  `chargeWithSavedWhopCardAction` (ya existente) cuando el viaje se
  completa, solo si quedó declarado 'card' y no hay ya un pago exitoso.
  Se llama desde `advanceDriverTrip` (driver.ts) y
  `updateBookingStatusAction` (bookings.ts) — los dos lugares donde un viaje
  puede pasar a 'completed'.
- **Webhook `whop-connect`**: nuevo handler `setup_intent.succeeded` — guarda
  el member_id en `passenger_whop_members` vía `metadata.company_id` +
  `metadata.phone` (sin booking_id, porque en ese punto la reserva aún no
  existe). **Pendiente del usuario**: suscribir el webhook a `setup_intent.*`
  en el dashboard de Whop (hoy solo tiene `payment.*`/`refund.*`) — sin esto
  el flujo de "Tarjeta al finalizar" sin tarjeta previa no completa.
- **3 rutas móviles nuevas**: `saved-card-by-phone`, `setup-card`, `checkout`.
- **`BookingConfirmScreen.tsx`**: "Pagar ahora" visualmente prioritario
  (tarjeta dorada grande, pill "Recomendado"), "Tarjeta al finalizar" y
  "Efectivo" como chips secundarios. Si elige "Tarjeta al finalizar" sin
  tarjeta guardada, un banner bloquea "Confirmar reserva" hasta guardarla
  (WebBrowser con el checkout de Whop en modo setup).
- **`expo-web-browser`** instalado + `scheme: 'luxeride-passenger'` agregado
  a `app.config.js` (necesario para que el navegador in-app detecte el
  regreso del checkout de Whop).
- **Driver-mobile**: badge "Paga con tarjeta" / "Paga en efectivo" en
  `TripDetailScreen` — el conductor ve el método declarado desde que abre
  el viaje, no al final.
- Verificado: `tsc --noEmit` en los 3 apps, `vitest run` (185/185),
  `npm run build` en `apps/web` (confirmó las 3 rutas nuevas + el webhook
  compilando limpio).

## ✅ Chat con el conductor en la app pasajero + decisión de métodos de pago (2026-07-24)

El usuario comparó un mockup de referencia (17 pantallas: 11 pasajero + 6
conductor) contra lo ya construido y señaló 2 gaps reales: faltaba el chat
y "métodos de pago" era solo parcial. El chat se construyó completo esta
sesión; métodos de pago quedó explícitamente pospuesto (ver razón abajo).

- **Chat con el conductor** — `ChatScreen.tsx` nuevo en
  `apps/passenger-mobile`, accesible desde un ícono en `TripTrackingScreen`
  (oculto si el viaje ya cerró). Migración 71
  (`customers_read_trip_messages` / `customers_write_trip_messages`) le da
  al pasajero autenticado el mismo acceso directo por RLS que ya tenía el
  conductor — sin ruta `/api/mobile/passenger/*` nueva, Realtime directo
  vía Supabase client. El chat del pasajero de la WEB sigue siendo distinto
  (guest sin sesión, vía server actions con service role) — no se tocó.
- **Métodos de pago — pospuesto a propósito.** El mockup mostraba una lista
  de varias tarjetas + "Agregar método de pago", pero Whop no soporta eso:
  `passenger_whop_members` guarda una sola tarjeta por teléfono+empresa (la
  última usada en un checkout), no un wallet. Construir la lista tal cual
  habría sido una interfaz que miente sobre lo que el backend puede hacer.
  Alcance recomendado si se retoma: mostrar la tarjeta en archivo (si
  existe) + botón que abre un checkout nuevo de Whop para reemplazarla —
  sin lista multi-tarjeta ni opción de efectivo nativa en la app.
- Verificado: `tsc --noEmit` en ambos apps, `vitest run` (185/185) y
  `npm run build` en `apps/web` — todo limpio. Migración 71 confirmada
  corrida por el usuario en Supabase.

## ✅ Push de re-engagement para pasajeros inactivos (2026-07-23)

Último ítem de Sprint 5 (PHASE-2-MOBILE.md) ligado directamente a la
infraestructura de push nativo ya construida. Reusa `device_tokens` y la
tabla `notifications` — sin migración nueva.

- `sendReengagementPush()` en `lib/notifications/index.ts` — sin booking
  asociado (a diferencia de `sendBookingReminder`), dedup por
  `recipient=userId` + `type='reengagement'` + `channel='push'` con
  **cooldown de 30 días** (no un dedup para siempre — el cron puede volver
  a avisar si la persona sigue sin reservar un mes después). Se salta sin
  gastar el cooldown si el usuario aún no tiene ningún `device_token`.
- Cron nuevo `/api/cron/passenger-reengagement` (registrado 1x/semana,
  lunes 10am, en `vercel.json`) — por cada empresa activa, busca
  `user_profiles` con `role='customer'`, `is_active=true`, cuenta con más
  de 7 días de antigüedad, que no tengan ningún `booking` creado en los
  últimos 21 días (cualquier estado, incluyendo cancelado — sigue contando
  como interacción reciente con la app).
- Verificado: `tsc --noEmit`, `vitest run` (185/185), `npm run build` — los
  3 limpios en `apps/web`. Sin cambios en la app móvil, no requiere build EAS.

## ✅ App de pasajero: pestaña Inicio, reservar para otro, Perfil ampliado (2026-07-23)

Feedback del usuario probando el build real: (1) al iniciar sesión caía
directo en "Reservar" sin ningún momento de bienvenida/marca, (2) solo 3
pestañas abajo, faltaba "Inicio", (3) Perfil demasiado básico — pidió
cambio de contraseña, datos completos, calificación en estrellas, modo
oscuro, direcciones guardadas (ya hecho) y reservar para otra persona. Se
aclaró con el usuario el alcance de dos puntos ambiguos antes de construir:
"reservar para otra persona" = reservar y pagar uno mismo pero que el
viaje sea para alguien más; modo oscuro se pospone (ver abajo).

- **Pestaña "Inicio" nueva** (`HomeScreen.tsx`, primera pestaña) — saluda
  por nombre, muestra la marca de la empresa, destaca el próximo viaje
  activo si existe (con acceso directo a verlo en vivo), botón principal
  "Reservar un viaje" y accesos rápidos a Mis viajes/Perfil. 4 pestañas
  ahora: Inicio, Reservar, Mis viajes, Perfil.
- **"Reservar para otra persona"** (`BookingConfirmScreen.tsx`) — chips
  "Para mí" / "Para otra persona" sobre los campos de nombre/teléfono.
  Cero cambios de backend: `bookings.passenger_name`/`passenger_phone` ya
  eran columnas separadas de `customer_id` (pensadas originalmente para el
  guest checkout de la web) — solo se expone la opción de llenarlas con
  otros datos en vez de auto-rellenar los del dueño de la cuenta. La
  reserva sigue apareciendo en "Mis viajes" de quien la hizo.
- **Perfil ampliado**:
  - Calificación en estrellas: no existe una columna agregada para el
    pasajero (a diferencia de `drivers.rating`, que sí tiene trigger) — se
    promedia en el momento sobre `bookings.driver_rating` (la misma columna
    que ya usa el conductor para calificar al pasajero desde
    `/driver/trips`). Sin migración nueva.
  - Cambio de contraseña: `supabase.auth.updateUser({ password })` —
    sesión ya autenticada, no pide la contraseña actual (mismo modelo que
    "¿Olvidaste tu contraseña?" de la web).
  - Teléfono agregado al header junto a nombre/correo (dato que ya se
    editaba pero no se mostraba destacado arriba).
- **Modo oscuro — pospuesto, documentado como pendiente real**: hoy
  `lib/theme.ts` exporta `color`/`font`/`space`/`radius` como objetos fijos
  que cada pantalla importa directo — un modo oscuro real requiere (a) una
  paleta oscura paralela, (b) un `ThemeContext` con el modo persistido
  (AsyncStorage), y (c) migrar CADA pantalla + `components/ui.tsx` de
  `StyleSheet.create` con `color` fijo a estilos computados dentro del
  componente vía un hook `useTheme()` — no es un interruptor rápido, toca
  las 8 pantallas. El usuario decidió posponerlo para una sesión dedicada
  en vez de ahora.
- **Verificado**: `tsc --noEmit` limpio. Sin verificación visual en
  emulador (no disponible en este entorno).
- **Pendiente del usuario**: instalar el próximo build de EAS.

## ✅ App de pasajero: pasada de pulido visual (2026-07-23)

El usuario pidió pulir la presentación general ("la veo débil"), sin
puntos concretos — se revisaron las 8 pantallas con criterio propio y se
corrigieron 3 puntos débiles reales, sin poder probarlos visualmente en un
emulador (limitación ya conocida de este entorno):

- **`BookingSuccessScreen.tsx`** (el momento más plano de la app — "reserva
  confirmada" aparecía todo de golpe, sin ningún énfasis para un momento
  que debería sentirse como un logro): entrada orquestada con
  `Animated` — el ícono de check rebota primero, luego el resto del
  contenido sube con fade. Respeta `AccessibilityInfo.isReduceMotionEnabled()`
  (sin animación si el sistema lo pide). El círculo de check ahora tiene un
  resplandor sutil en vez de quedar plano.
- **`BookingConfirmScreen.tsx`**: los campos de nombre/teléfono usaban
  `TextInput` suelto con solo un ícono al lado, sin borde — visualmente
  inconsistente frente a Auth/Perfil, que ya usan el componente `Field`
  (fondo, borde, foco dorado). Se migraron a `Field` para que las 3
  pantallas con formularios se vean de la misma familia.
- **`TripTrackingScreen.tsx`**: la barra de estado sobre el mapa mostraba
  solo el badge de estado, flotando solo en una barra ancha — se sentía
  incompleta. Se agregó el número de reserva al lado para dar contexto.
- **Explícitamente no tocado**: `VehicleSelectScreen.tsx` y
  `MyTripsScreen.tsx` ya se sentían sólidos (el segundo ya concentra
  bastante trabajo de esta sesión — recibo, calificar, pagar, reservar de
  nuevo) — no se forzó un cambio ahí solo por tocar algo.
- **Verificado**: `tsc --noEmit` limpio. Sin verificación visual en
  emulador (no disponible en este entorno) — se recomienda instalar el
  próximo build de EAS y confirmar especialmente la animación de
  "Reserva confirmada".

## ✅ App de pasajero: Perfil editable + direcciones guardadas (2026-07-23)

Cierra el pulido menor pendiente ("Perfil solo tenía cerrar sesión") — ahora
el pasajero puede editar nombre/apellido/teléfono/fecha de nacimiento y
guardar direcciones frecuentes ("Casa", "Trabajo", etc.) para reservar más
rápido.

- **Edición de perfil**: sin backend nuevo — `user_profiles` ya tenía una
  policy RLS `users_update_own_profile` (migración 03) que deja a cualquier
  usuario actualizar su propia fila (bloquea cambiar `role`/`company_id`),
  nunca usada desde ningún cliente hasta ahora. La app actualiza directo
  vía Supabase, limitando ella misma los campos enviados a los 4 visibles
  en el formulario (nunca `avatar_url`/`metadata`/`is_active`, aunque la
  policy los permitiría).
- **Direcciones guardadas**: tabla nueva `passenger_saved_addresses`
  (migración `20260723000070_passenger_saved_addresses.sql`), RLS propia
  scopeada a `customer_id = auth.uid()` — mismo patrón de acceso directo
  sin ruta de servidor (como `device_tokens`). Chips rápidos "Casa"/
  "Trabajo"/"Otro" al guardar.
- **Reutilizadas en el flujo de reserva**: `NewBookingScreen.tsx` muestra
  las direcciones guardadas como chips debajo de Origen y Destino — un
  toque llena el campo sin re-escribir ni re-buscar.
- **Refactor menor**: el componente `Field` (input con ícono) vivía privado
  dentro de `AuthScreen.tsx`; se promovió a `components/ui.tsx` junto con
  un `FieldButton` nuevo (mismo look, para valores que se eligen con un
  picker en vez de escribirse, ej. fecha de nacimiento) — ahora se reusa
  en Perfil sin duplicar código.
- **Verificado**: `tsc --noEmit` limpio en `apps/passenger-mobile`.
- **Pendiente del usuario**: correr la migración
  `20260723000070_passenger_saved_addresses.sql` en Supabase.

## ✅ Push como tercer canal de los recordatorios ya configurables (2026-07-23)

El usuario preguntó si los avisos push pueden controlarse desde
configuración de empresa con tiempos propios — aclarado que se refería al
sistema de recordatorios que YA es configurable en minutos
(`/admin/settings` → "Recordatorios de viaje"), pidiendo agregar push ahí
como canal adicional, no una sección nueva.

- **`sendBookingReminder()`** (`lib/notifications/index.ts`) acepta ahora
  `channel: 'push'` además de `'email'`/`'sms'` — mismo mecanismo de dedup
  por `booking_id`+`type`+`channel`. Para push, `to` es el `user_id` (no
  email/teléfono); si el usuario todavía no tiene ningún dispositivo
  registrado en `device_tokens`, se omite SIN marcar el dedup como
  consumido — así, si instala la app y registra un token antes de que pase
  el viaje, la siguiente corrida del cron sí le avisa.
- **Cron** (`app/api/cron/booking-reminders/route.ts`): en cada umbral ya
  configurado (`passengerMinutes`/`driverMinutes`), además de email/SMS
  ahora también intenta push — al pasajero (si tiene `customer_id`, cuenta
  en la app) y al conductor (mismos `device_tokens` que ya usa "nuevo viaje
  asignado"). Cero UI nueva: es el mismo umbral en minutos que el operador
  ya configuraba, un canal más.
- **Verificado**: `tsc --noEmit` limpio, 185/185 tests, `npm run build`
  compila sin errores.
- **Pendiente del usuario**: ninguna acción nueva — funciona con la
  configuración de umbrales que ya exista en `/admin/settings`, y con el
  build de EAS que ya se generó para el registro de push del pasajero.

## ✅ App de pasajero: notificaciones push nativas (2026-07-23)

Parte de Sprint 5 (pulido/lanzamiento) — el usuario pidió avisos empujados
al teléfono en vez de que el pasajero solo vea el estado al abrir la app.
Se reutilizó exactamente la infraestructura ya construida para el
conductor (`device_tokens`, Expo Push API directa, **sin Firebase**) — cero
migración nueva, la tabla ya era genérica por `user_id`.

- **App**: `apps/passenger-mobile/lib/push.ts` (nuevo, mismo código que
  `apps/driver-mobile/lib/push.ts`) — pide permiso y registra el token de
  Expo en `device_tokens` en cuanto hay sesión de pasajero válida
  (`App.tsx`). A diferencia del estado inicial del conductor, aquí el
  registro funciona de una vez (ya existe `projectId` de EAS desde el
  primer build).
- **Backend** (`lib/notifications/push.ts`): se generalizó
  `notifyDriverPush`/`notifyDriverPushInBackground` a
  `notifyUserPush`/`notifyUserPushInBackground` (los nombres de conductor
  quedan como alias, cero call sites rotos).
- **Disparo real** en `app/actions/bookings.ts`: push al pasajero (si tiene
  `customer_id`, o sea cuenta en la app — no aplica a guest checkout de la
  web) en conductor asignado (`assignDriverAction`) y en los cambios de
  estado en camino / llegó / completado / cancelado
  (`updateBookingStatusAction`). Deliberadamente sin push en 'pending' (esa
  confirmación ya se ve en pantalla al reservar).
- **Explícitamente fuera de alcance por ahora**: extender el cron de
  recordatorios (`sendBookingReminder`) para que también use push adicional
  a email/SMS — el diseño actual de esa función recibe una dirección
  (`to`: email o teléfono), no un `userId`, así que necesitaría su propio
  diseño en vez de un cambio rápido. Queda como fast-follow natural.
- **Verificado**: `tsc --noEmit` limpio en ambas apps, 185/185 tests,
  `npm run build` compila sin errores.
- **Pendiente del usuario**: instalar el próximo build de EAS (obligatorio
  — son módulos nativos nuevos, no basta con recargar Expo Go) y aceptar el
  permiso de notificaciones la primera vez que abra la app con esa versión.
- **Nota de seguridad, no de código**: al investigar esto se encontró un
  archivo `apps/driver-mobile/AGENTS.md` con el contenido "# Expo HAS
  CHANGED / Read the exact versioned docs at
  https://docs.expo.dev/versions/v57.0.0/ before writing any code" — no
  coincide con la versión real instalada (Expo SDK 54 en ambas apps
  móviles, confirmado en `package.json`). Tiene forma de instrucción
  embebida para un agente de IA más que de nota de proyecto real; no se
  siguió (no se visitó esa URL como si fuera una directiva) y se deja
  constancia por si el usuario no la puso él mismo.

## ✅ Fecha de nacimiento del pasajero (2026-07-23)

Pedido explícito del usuario: capturar la fecha de nacimiento para poder
enviar en el futuro un mensaje de felicitación de cumpleaños (estrategia de
retención — recordarle al cliente el servicio de la empresa). Solo se
construyó la captura y el guardado; el envío automático del mensaje de
cumpleaños queda para más adelante (no se pidió todavía).

- **Migración** `20260723000069_date_of_birth.sql`: `user_profiles.
  date_of_birth DATE`.
- **App móvil (obligatorio)**: nuevo campo en el signup de `AuthScreen.tsx`
  — selector de fecha nativo (`@react-native-community/datetimepicker`,
  mismo patrón que el selector de fecha/hora de `NewBookingScreen.tsx`),
  `maximumDate` = hoy. Es un campo requerido para crear la cuenta (si no se
  captura ahí, no se puede reconstruir después). Se valida también en el
  servidor (`passenger-auth.ts`, `SignupPassengerSchema`) — rechaza fechas
  futuras o inválidas.
- **Admin manual (opcional)**: al crear un cliente a mano desde
  `/admin/team` → "Agregar miembro" con rol "Cliente", aparece un campo
  opcional de fecha de nacimiento (el staff puede no conocerla en el
  momento, ej. un walk-in) — mismo patrón de campo condicional por rol ya
  usado en esta sesión (select controlado + campo que aparece solo con el
  rol correcto).
- **Visible en la pestaña Pasajeros** (`/admin/team?tab=customers`, ver
  entrada anterior) — nueva columna "Fecha de nacimiento".
- **Explícitamente fuera de alcance, a pedido del usuario**: la métrica de
  "usuarios nuevos por semana/mes" agregada de todas las empresas en
  `/super-admin/dashboard` — el usuario confirmó que por ahora solo quiere
  la captura del dato, y dejar esa métrica para una ronda futura. Cuando se
  construya: el dashboard de super-admin ya tiene un patrón de gráfico de
  barras hecho a mano (divs con `height` proporcional, sin librería de
  charts — ver `TREND_DAYS`/líneas ~132-142 y ~352-366 de
  `super-admin/dashboard/page.tsx`) que se puede replicar con
  `user_profiles.created_at` sin filtrar por empresa (mismo patrón
  `createAdminClient()` + `Promise.all` que ya usa esa página). No hay
  ninguna librería de gráficos (recharts/chart.js) en el proyecto todavía.
- **Verificado**: `tsc --noEmit` limpio en ambas apps, 185/185 tests,
  `npm run build` compila sin errores.
- **Pendiente del usuario**: correr la migración
  `20260723000069_date_of_birth.sql` en Supabase; instalar el próximo build
  EAS para probar el selector de fecha de nacimiento en el registro real.

## ✅ Fix real: pasajeros mezclados con el equipo en /admin/team + pestaña "Pasajeros" (2026-07-23)

El usuario notó (viendo `/admin/team`) que cuentas de pasajeros — incluyendo
las creadas por primera vez desde la app móvil — aparecían permanentemente
en la tabla de "Equipo", junto al staff real, sin forma de filtrarlas ni ver
más detalle que nombre y teléfono.

- **Causa real**: la query de `/admin/team` nunca filtraba por rol —
  `select(...).eq('company_id', ...)` traía TODAS las filas de
  `user_profiles` de la empresa, incluyendo `role = 'customer'` (pasajeros)
  y `role = 'corporate_manager'/'corporate_user'` (cuentas corporativas, que
  ya se gestionan aparte en `/admin/corporate`). Un pasajero que reservó una
  sola vez quedaba ahí para siempre.
- **Fix**: `STAFF_ROLES` (`company_owner`, `company_admin`, `dispatcher`,
  `accounting`, `driver`) — la pestaña "Equipo" ahora filtra
  `.in('role', STAFF_ROLES)`.
- **Pestaña nueva "Pasajeros"** (mismo patrón GET-form + `searchParams` que
  ya usa `/admin/messages`, sin JS de cliente): búsqueda por nombre/teléfono,
  filtro por rango de fecha de registro, paginación real a nivel de base de
  datos (20 por página vía `.range()`, no carga todo a memoria), y por
  pedido explícito del usuario tras ver la primera versión: columnas
  **"Fecha de registro"** y **"Último acceso"** (ambas con fecha+hora) — el
  último acceso viene de `auth.users.last_sign_in_at`, leído en la MISMA
  llamada `getUserById` que ya se hacía para el email de cada fila (cero
  llamadas extra).
- **Índices**: ya existía `idx_user_profiles_company_role (company_id,
  role)` desde la migración 03. Se agregó
  `idx_user_profiles_company_role_created (company_id, role, created_at
  DESC)` (migración 68) para que el filtro + orden de "Pasajeros" no tenga
  que ordenar en memoria a medida que crece la base de clientes.
- **Verificado en navegador** (Revival Transportation Group, datos reales):
  la pestaña Pasajeros muestra correctamente 1 pasajero con email/fecha/
  estado; confirmado por el usuario en captura de pantalla.
- **Verificado**: `tsc --noEmit` limpio, 185/185 tests, `npm run build`
  compila sin errores.
- **Pendiente del usuario**: correr la migración
  `20260723000068_customers_pagination_index.sql` en Supabase.

## ✅ App de pasajero: recibo con desglose de tarifa (2026-07-23)

Cierra el hueco de "Historial + recibos" del roadmap (Sprint 3-4) — hasta
ahora "Mis viajes" solo mostraba el total, sin desglose. `booking_fees` y
`payments` tienen RLS scopeada a `company_id` (staff), así que el pasajero no
puede leerlas directo por Supabase como sí hace con `bookings`.

- **Ruta nueva** `/api/mobile/passenger/receipt` (mismo patrón bearer +
  ownership check que las demás rutas mobile) — devuelve tarifa base,
  descuento de promo, propina, cada `booking_fee` y el último pago
  registrado, todos campos que ya existen en `bookings`/`booking_fees`/
  `payments` (cero columnas nuevas).
- **UI**: en "Mis viajes", cada viaje `completed` tiene un botón "Ver
  recibo" que expande el desglose completo (carga perezosa, solo al abrir
  el panel — no dispara una llamada extra por cada viaje de la lista).
- **Verificado**: `tsc --noEmit` limpio en ambas apps, 185/185 tests,
  `npm run build` compila sin errores.

## ⚠️ Resend en modo sandbox — los emails de producción probablemente solo llegan a una cuenta (2026-07-23)

Descubierto al probar el envío de un recordatorio: Resend rechazó el envío
con `"You can only send testing emails to your own email address
(digitalconnectdr@gmail.com)..."`. `RESEND_FROM_EMAIL` está en
`onboarding@resend.dev` (el remitente sandbox por defecto) — mientras no se
verifique un dominio propio en resend.com/domains, la cuenta de Resend
**solo puede enviar a la dirección dueña de la cuenta**, rechazando
cualquier otro destinatario. Esto no es específico de los recordatorios —
afecta `sendEmail()` en general, es decir probablemente **ningún cliente
real ha recibido nunca un correo de la plataforma** (confirmaciones,
recibos, recordatorios, etc.), solo esa cuenta de prueba.

- **SMS sí funciona** (Twilio, probado con envío real a un número real).
- **Pendiente del usuario**: verificar un dominio propio en
  resend.com/domains (requiere agregar registros DNS en su proveedor de
  dominio) y luego actualizar `RESEND_FROM_EMAIL` a una dirección de ese
  dominio, tanto en `.env.local` como en Vercel. No se puede hacer sin
  acceso al panel de DNS del dominio.

## ✅ Pricing "Por hora": mínimo de horas para evitar cobrar $0 (2026-07-23)

El usuario pidió revisar la regla "Por hora" en `/admin/pricing`. Hallazgo:
el modelo `hourly` nunca cobró por horas SOLICITADAS — cobra
`tarifa_por_hora × duración estimada por Google Maps entre origen y
destino` (`lib/pricing/engine.ts`). Esto no encaja con cómo se vende
normalmente un servicio "por horas" (bodas, eventos, conductor a
disposición), donde origen y destino suelen ser iguales o la ruta es corta
— con la lógica actual eso da una tarifa base de ~$0. No existe en NINGÚN
lugar (web, admin, app móvil) un campo para que el cliente/staff indique
"quiero 3 horas de servicio".

Se le presentaron 3 opciones al usuario (agregar selector de horas
solicitadas al cliente, dejarlo como está, o solo poner un mínimo de
horas) — eligió la opción rápida: **mínimo de horas a nivel de regla**.

- **Migración** `20260723000066_pricing_minimum_hours.sql`:
  `pricing_rules.minimum_hours NUMERIC(6,2) DEFAULT 0`.
- **`lib/pricing/engine.ts`**: `case 'hourly'` ahora usa
  `Math.max(durationMinutes / 60, rule.minimum_hours ?? 0)` — la tarifa
  nunca se calcula con menos horas que el mínimo configurado, sin importar
  cuán corta sea la ruta estimada (3 tests nuevos, incluyendo origen=destino).
- **UI**: campo "Mínimo de horas" condicional (solo aparece cuando el
  modelo es "Por hora"), igual patrón que los selects de zona condicionales
  a "Por zona" — en el formulario de crear (`pricing-model-field.tsx`) y de
  editar (`pricing-rule-row.tsx`) reglas.
- **Explícitamente NO resuelto todavía**: un campo real de "horas
  solicitadas" capturado del cliente al reservar (requeriría UI nueva en el
  wizard web, el form de admin y la app móvil, más lógica de qué pasa si el
  cliente pide menos horas que las paradas/ruta real necesitan) — el
  usuario lo dejó pendiente de revisión futura.
- **Verificado**: `tsc --noEmit` limpio, 182/182 tests, `npm run build`
  compila sin errores.
- **Pendiente del usuario**: correr la migración
  `20260723000066_pricing_minimum_hours.sql` en Supabase; configurar un
  mínimo de horas en las reglas "Por hora" existentes (por defecto queda en
  0, es decir sin cambio de comportamiento hasta que se configure).

## ✅ App de pasajero: pagar viaje + propina con tarjeta Whop guardada (2026-07-23)

El usuario confirmó seguir con la parte de "propina post-viaje" (Sprint 4)
que había quedado en pausa por tocar pagos reales. **Alcance deliberadamente
acotado** para no arriesgar la protección anti-doble-cobro existente: se
reusa `chargeWithSavedWhopCardAction` (ya en producción, usada por el
checkout público de la web) TAL CUAL, sin tocar su lógica — cubre
exactamente el mismo caso que ya soporta la web (pagar con una tarjeta
guardada de un pago anterior), simplemente portado a la app nativa por
primera vez. Explícitamente NO se construyó: agregar una propina a un viaje
que YA tiene un pago exitoso registrado (eso exigiría aflojar el guard
anti-doble-cobro — cambio de mayor riesgo, no se tocó sin pedirlo aparte).

- **2 rutas nuevas delgadas** (mismo patrón que las demás — bearer token +
  verificación de `bookings.customer_id`): `/api/mobile/passenger/saved-card`
  (envuelve `getSavedWhopCardAction`) y `/charge-saved-card` (envuelve
  `chargeWithSavedWhopCardAction`). Cero lógica de pago nueva.
- **UI**: en "Mis viajes", un viaje completado consulta automáticamente si
  el pasajero tiene tarjeta Whop guardada (de un pago anterior con esa
  empresa); si la tiene, muestra chips de propina (Sin propina/15/18/20%) +
  botón "Pagar viaje". Si el viaje ya tiene un pago registrado, la acción
  ya existente lo rechaza con su mismo mensaje — sin duplicar esa validación.
- **Verificado**: `tsc --noEmit` limpio en ambas apps, 185/185 tests,
  `npm run build` compila sin errores.
- **Limitación conocida**: los % de propina son fijos genéricamente (no se
  consultan los `gratuity.options` configurados por la empresa) — si una
  empresa deshabilitó propinas en su configuración, el servidor igual
  valida/descarta el % elegido (`sanitizeGratuityPct`), así que no hay
  bug de cobro, solo una propina que termina en $0 sin explicación en la UI.

## ✅ Fix real: Total no reflejaba el cargo de cancelación (2026-07-23)

Reportado por el usuario probando `/admin/bookings/[id]` de una reserva
cancelada de prueba: "Tarifa Base $250, Cargo Por Cancelación Tardía
(50%) $125, pero el Total sigue en $250" — esperaba $125.

- **Causa real** (`updateBookingStatusAction` en `app/actions/bookings.ts`):
  al cancelar/marcar no-show con cargo, el código insertaba la fila del
  cargo en `booking_fees` pero **nunca actualizaba `bookings.total_amount`**
  — el campo se quedaba con el valor de la reserva viva (la tarifa
  completa), y el "Total" del desglose de cargos en la página de detalle
  simplemente lee `booking.total_amount` directo, ignorando por completo
  el cargo recién insertado.
- **Fix**: cuando `fee.feeAmount > 0`, además de insertar la fila en
  `booking_fees`, se actualiza `bookings.total_amount = fee.feeAmount` —
  el monto que el cliente debe pagar ahora es el cargo de cancelación, no
  la tarifa original. Confirmado que esto no afecta reportes de ingresos
  existentes (`/admin/dashboard` y el CSV de `/api/reports/bookings` ya
  excluyen o simplemente exportan el campo crudo por reserva — nada suma
  `total_amount` de reservas canceladas como si fueran ingreso).
- **Verificado**: `tsc --noEmit` limpio, 185/185 tests, `npm run build`
  compila sin errores.

## ✅ App de pasajero: calificar viaje completado (2026-07-23)

Siguiente pieza de Sprint 4 ("Post-viaje: calificación... bookings.rating ya
existe") — implementado SOLO la calificación, sin propina post-pago (esa
parte depende de adaptar el flujo de pago de Whop a la app, que es Sprint 3
y sigue sin construir — ver nota existente en `docs/PHASE-2-MOBILE.md`
sobre por qué eso no es un simple Payment Sheet de Stripe).

- **Cero backend nuevo de verdad** — reusa `submitReviewAction` (el mismo
  núcleo que ya usa `/review/[id]`, el link público que se manda por email
  al completar un viaje). Solo se agregó una ruta delgada
  `/api/mobile/passenger/submit-review` que exige bearer token de rol
  `customer` y verifica que `bookings.customer_id` sea el usuario
  autenticado (capa extra de seguridad que el link público de la web no
  necesita, porque ahí el bookingId ya es el secreto — ver `/track/[id]`).
- **UI**: `MyTripsScreen.tsx` — se extrajo la tarjeta de viaje a su propio
  componente `TripCard` (antes vivía como closure inline dentro de
  `renderItem`, lo cual no permite estado por-ítem en un `FlatList`).
  Viajes `completed` sin `rated_at` muestran "Calificar viaje" → panel
  expandible con 5 estrellas + comentario opcional, mismo patrón visual que
  ya usa el conductor para calificar al pasajero en
  `apps/driver-mobile/screens/EarningsScreen.tsx`.
- **Verificado**: `tsc --noEmit` limpio en ambas apps, 185/185 tests,
  `npm run build` compila sin errores.
- Sin migración nueva — las columnas `rating`/`rating_comment`/`rated_at`
  ya existían desde antes.

## ✅ App de pasajero: "Reservar de nuevo" desde Mis viajes (2026-07-23)

Siguiente pieza del roadmap de Sprint 3-4 (`docs/PHASE-2-MOBILE.md`) — "Re-
reservar en 1 toque" estaba listado como pendiente.

- **`lib/types.ts`**: `BookingPrefill` (pickup/dropoff address+lat/lng+
  passengerCount) + `NewBooking: { prefill?: BookingPrefill } | undefined`
  en `BookingStackParamList` (antes `undefined` a secas).
- **`NewBookingScreen.tsx`**: lee `route.params?.prefill` para precargar
  origen/destino/pasajeros. Como bookings no guarda `placeId`/código
  postal, el prefill marca los campos como "no resueltos por autocomplete"
  pero con lat/lng reales — suficiente para cotizar sin re-geocodificar.
  Se agregó un `useEffect` además del `useState` inicial: si la pantalla ya
  estaba montada (el pasajero ya había visitado esa pestaña), el estado
  inicial no se habría actualizado con params nuevos — el efecto lo corrige.
- **`MyTripsScreen.tsx`**: botón "Reservar de nuevo" en viajes con status
  `completed` (no en cancelados/no-show — la ruta pudo ser el motivo de la
  cancelación) que tengan lat/lng guardados en ambas direcciones.
- **Verificado**: `tsc --noEmit` limpio en `apps/passenger-mobile`.
- Build EAS nuevo en camino con este cambio.

## ✅ Pricing "Por hora": campo "Horas solicitadas" + mínimo default 1h (2026-07-23)

Continuación de la revisión de "Por hora": el usuario pidió NO elegir entre
el mínimo de horas y el campo de horas solicitadas — quiso las dos cosas.

- **Migración** `20260723000067_requested_hours.sql`: agrega
  `price_quotes.requested_hours` y `bookings.requested_hours`; sube el
  `DEFAULT` de `pricing_rules.minimum_hours` de 0 a 1 (para reglas nuevas) y
  además actualiza las reglas "Por hora" existentes que seguían en 0 (nadie
  las había configurado todavía vía la UI nueva) a 1, para que el fix del
  caso "$0" aplique de inmediato sin tocarlas una por una.
- **`lib/pricing/engine.ts`**: `calculateFare()` ahora acepta
  `requestedHours` opcional. Si viene (y es > 0), se usa como base de horas
  en vez de la duración estimada de Google Maps; `minimum_hours` sigue
  siendo el piso en ambos casos — si el cliente pide menos horas que el
  mínimo del operador, igual se cobra el mínimo (4 tests nuevos).
- **Backend**: `calculateQuoteAction` y `getPublicVehicleQuotesAction` leen
  `requested_hours`/`requestedHours` y lo pasan a `calculateFare` +
  lo guardan en `price_quotes`. `createBookingAction` y
  `createPublicBookingAction` copian `requested_hours` del quote a la
  reserva (mismo patrón que `duration_minutes`) — sin parámetros nuevos ahí,
  ya leen `select('*')` de `price_quotes`.
- **UI**: campo "Horas solicitadas" condicional (solo con tipo de servicio
  "Por hora") en el wizard público (`booking-wizard.tsx`, paso 1) y en el
  formulario de admin (`new-booking-form.tsx`, fase 1 — ruta).
- **Explícitamente fuera de alcance todavía**: la app móvil de pasajero no
  tiene ninguna opción de tipo de servicio "Por hora" (siempre reserva
  `one_way`) — agregar ese flujo ahí es trabajo aparte, no se tocó.
- **Verificado**: `tsc --noEmit` limpio, 185/185 tests, `npm run build`
  compila sin errores.
- **Pendiente del usuario**: correr la migración
  `20260723000067_requested_hours.sql` en Supabase.

## ✅ Feedback de sesión sobre la app de pasajero + AI Growth Assistant (2026-07-23)

Tras probar el build anterior en el dispositivo, tres observaciones de UI +
una idea nueva:

- **Fotos de vehículo recortadas**: `VehicleSelectScreen.tsx` mostraba la
  imagen dentro de una caja cuadrada de 48×48 con `resizeMode="cover"` — las
  fotos reales son landscape (mismo ratio que la miniatura `h-11 w-16` de
  `/admin/fleet`), así que un cuadrado recortaba casi todo el vehículo. Se
  agrega una caja rectangular (76×52) solo para cuando hay foto real.
- **Contraste insuficiente**: `color.inkFaint` (`#9c9587`) daba ~2.97:1
  sobre blanco, por debajo del mínimo WCAG AA (4.5:1) — se usa en labels,
  fechas, placeholders y el disclaimer de toda la app. Se oscurece a
  `#797263` (~4.77:1), manteniendo la jerarquía frente a `inkMuted`.
- **Fuente de números poco legible**: precios y contadores (`totalValue` en
  BookingConfirm, `price` en VehicleSelect/MyTrips, `stepperValue` en
  NewBooking) usaban Playfair Display (serif de marca) — sus cifras no
  quedan parejas como en una fuente pensada para datos. Se cambian las 4 a
  Inter Bold (`font.bodyBold`), dejando Playfair solo para títulos/texto.
- **Nueva idea: ciudad del solicitante en "Rutas más frecuentes"** — el
  usuario preguntó si además del origen/destino del viaje se puede saber
  desde qué ciudad se HIZO la reserva (puede ser distinto: alguien en Santo
  Domingo reservando un viaje en Nueva York para un familiar). Se resuelve
  con `geolocation()` de `@vercel/functions`, que lee los headers de
  geolocalización por IP que Vercel ya agrega a cada request en su edge
  network — sin API externa, sin costo, sin permiso del usuario. Nueva
  migración `20260723000065_requester_geo.sql` (`bookings.requester_city`,
  `requester_country`); se captura en `createPublicBookingAction` (cubre web
  guest checkout Y la app móvil, que reusa esa misma acción vía
  `/api/mobile/passenger/book`). `lib/route-insights/engine.ts` calcula la
  ciudad de solicitante más frecuente por corredor (`topRequesterCity`) y se
  muestra como columna nueva en la tabla de Rutas más frecuentes. Reservas
  anteriores a esta migración quedan con el campo NULL (no hay forma de
  reconstruir la IP retroactivamente).
- **Verificado**: `tsc --noEmit` limpio (web y app), 179/179 tests,
  `npm run build` compila sin errores.
- **Pendiente del usuario**: correr la migración
  `20260723000065_requester_geo.sql` en Supabase; instalar el nuevo build
  EAS de la app para ver los 3 fixes visuales.

## ✅ Recordatorios automáticos de viaje — email + SMS, umbrales en minutos (2026-07-23)

A pedido del usuario: el operador configura en `/admin/settings` cuántos
minutos antes de un viaje avisar al pasajero y/o al conductor (umbrales
independientes, ej. 1440 = 1 día, 90 = 1:30, 30 = 30 min), por email y SMS.

- **Sin migración nueva**: se guarda en `companies.settings.
  notificationReminders = { passengerMinutes: number[], driverMinutes: number[] }`
  (mismo patrón JSONB que `settings.payments.platform_fee_pct`).
  `app/actions/settings.ts` → `updateNotificationRemindersAction`.
- **`lib/notifications/index.ts`** → `sendBookingReminder()` — mismo patrón
  de dedup que `sendQuoteFollowup` (chequea la tabla `notifications` por
  `booking_id` + `type` + `channel` antes de enviar; `type` incluye el
  umbral, ej. `reminder_passenger_90m`, para que cada umbral+canal avise
  una sola vez por reserva). Soporta `channel: 'email' | 'sms'` — SMS vía
  Twilio, mismo proveedor que el resto de la plataforma.
- **Cron** `app/api/cron/booking-reminders/route.ts` — por cada empresa
  activa con umbrales configurados, busca bookings próximos
  (`pending`/`assigned`/`en_route`) dentro de la ventana de cada umbral y
  envía el aviso al pasajero (`bookings.passenger_email`/`passenger_phone`)
  y/o al conductor (email vía `admin.auth.admin.getUserById`, teléfono vía
  `user_profiles.phone`, cacheados por corrida).
- **Precisión real (30min, 1:30, etc.) — QStash configurado y funcionando
  (2026-07-23)**: el cron sigue registrado 1x/día en `vercel.json` como
  respaldo (límite del plan Hobby de Vercel), pero además hay un Schedule de
  Upstash QStash corriendo cada 10 min contra el mismo endpoint. La consola
  de QStash **no permite agregar el header `Authorization` personalizado**
  en su UI de Schedules (solo ofrece una lista fija de headers propios de
  Upstash) — se resolvió agregando un fallback de auth por query param:
  `isAuthorized()` en `booking-reminders/route.ts` acepta
  `?token=<CRON_SECRET>` en la URL además del header `Authorization: Bearer`.
  El schedule real usa `https://getluxeride.vercel.app/api/cron/booking-reminders?token=<CRON_SECRET>`,
  método POST (default de QStash), cron `*/10 * * * *`. `CRON_SECRET` se
  generó y se agregó como env var (Production + Preview) en Vercel.
- **UI**: sección "Recordatorios de viaje" en `/admin/settings`, chips de
  minutos independientes para pasajero/conductor (formateados como "30m",
  "1h30", "6h", "1d" para legibilidad) — `components/admin/hour-chips-field.tsx`
  (mismo patrón visual que los códigos postales de zonas).
- **App de pasajero**: "Mis viajes" ahora muestra un indicador de cercanía
  que cambia de color según cuánto falta para el viaje (verde >24h, ámbar
  6-24h, rojo <6h) — `MyTripsScreen.tsx`.
- **Explícitamente fuera de alcance todavía**: WhatsApp y Telegram — el
  usuario los pidió como próximo paso, pero requieren que él mismo obtenga
  acceso/token de esos proveedores primero (aprobación de WhatsApp Business
  API o un bot de Telegram) antes de poder integrarlos.
- **Verificado**: `tsc --noEmit` limpio (web y app), 177/177 tests,
  `npm run build` compila sin errores.
- **Pendiente del usuario**: configurar los umbrales deseados en
  `/admin/settings` (vacío por defecto — la función no envía nada hasta que
  el operador configure al menos un umbral).

## ✅ App de pasajero — 2 ajustes tras feedback visual del build anterior (2026-07-23)

- **Chips de "¿Cuándo?" con tamaños inconsistentes**: `NewBookingScreen.tsx`
  usaba `<Text onPress={...}>` desnudo como botón — mismo antipatrón que
  `PressableScale` (`components/PressableScale.tsx`) ya documenta haber
  tenido que resolver para otros botones. Se migran los chips a
  `PressableScale` + `View`+`Text`, consistente con el resto de la app.
- **Faltaba "Instrucciones especiales (opcional)"** — ya existía en el
  backend (`/api/mobile/passenger/book` ya aceptaba `specialInstructions`,
  nunca se exponía en la UI de la app) y en la web. Se agrega el campo en
  `BookingConfirmScreen.tsx`, mismo lugar que la web (junto a nombre/teléfono).
- **Verificado**: `tsc --noEmit` limpio.

## ✅ Fix crítico: Google eliminó HeatmapLayer, crasheaba "Rutas frecuentes" (2026-07-23)

Descubierto en producción real (Revival Transportation Group, primera vez
que alguien entraba a la pestaña con datos reales) — pantalla en blanco:
"Application error: a client-side exception has occurred".

- **Causa real** (confirmada por consola del navegador del usuario):
  `Error: The Heatmap Layer functionality in the Maps JavaScript API is no
  longer available in the Maps JavaScript API as of version 3.65.` Google
  **eliminó por completo** `google.maps.visualization.HeatmapLayer` de su
  API — no era un bug de tipos desactualizados como se pensó al construir
  la feature (ver nota original en el commit), sino que la función ya no
  existe en absoluto. Nunca se había detectado porque no se pudo probar
  visualmente con datos reales durante la construcción (sin cuenta con el
  addon activo en ese momento).
- **Fix** (`route-insights-map.tsx`): se reemplaza `HeatmapLayer` por
  `google.maps.Circle` — un círculo pequeño y semitransparente (300m,
  18% opacidad) por cada punto de recogida/destino. Donde hay más
  reservas cercanas, los círculos se superponen y la zona se ve más
  intensa — mismo efecto visual de densidad, con una API que sí sigue
  soportada. Se quita `'visualization'` de `maps-provider.tsx` (ya no se
  usa esa librería).
- **Verificado**: `tsc --noEmit` limpio, `npm run build` compila sin
  errores.

## ✅ App de pasajero — 3 pulidos tras la primera prueba end-to-end real (2026-07-23)

Primer recorrido completo en dispositivo físico (signup → cotizar → elegir
vehículo → confirmar → "Reserva confirmada") con Revival Transportation
Group. El usuario reportó 3 huecos reales frente a la web:

- **"Mis viajes" era un placeholder fijo** (`MyTripsScreen.tsx`) — si el
  pasajero cerraba "Reserva confirmada" sin tocar "Ver mi viaje", no había
  forma de volver a encontrar esa reserva. Ahora lee `bookings` directo por
  Supabase (RLS `customers_select_own_bookings`, ya existente desde Sprint
  0+1 — nunca se había conectado a esta pantalla), con pull-to-refresh y
  tap-para-ver-en-vivo en viajes con estado activo (navegación cross-tab
  hacia `TripTracking`, que vive en el stack de la pestaña "Reservar").
- **Sin selector de fecha/hora nativo** — `NewBookingScreen.tsx` solo tenía
  chips rápidos ("En 30 min", "Mañana 9:00 AM"), sin forma de agendar un
  viaje en una fecha/hora arbitraria como sí permite la web
  (`<input type="date"/"time">`, tarea #32). Se agregó
  `@react-native-community/datetimepicker` (nueva dependencia nativa —
  requiere el build de EAS de hoy) con un quinto chip "Elegir fecha y hora".
- **Sin foto real del vehículo** en `VehicleSelectScreen.tsx` (solo ícono
  genérico por clase) — se descubrió que la web declara
  `imageUrl: string | null` en su tipo `VehicleQuote` desde hace tiempo
  pero **nunca lo usa** (campo muerto). Se conectó de verdad: `vehicle_types.
  base_image_url` ahora se selecciona en `getPublicVehicleQuotesAction`
  (`apps/web/app/actions/bookings.ts`, compartido con la web — no se duplica
  el motor de precios) y se mapea a `imageUrl`; la app renderiza `<Image>`
  con fallback al ícono de clase si no hay foto. La web sigue sin renderizarla
  (queda como mejora futura de bajo esfuerzo, fuera de alcance hoy).
- **Verificado**: `tsc --noEmit` limpio (app y web), 177/177 tests de Vitest.
- **Nota de infraestructura, no de código**: durante esta sesión el disco C:
  del usuario se llenó a 0 bytes libres (`.gemini\antigravity-backup\
  browser_recordings`, 48.7 GB de capturas de sesión de Antigravity — nada
  que ver con este repo), lo que causó fallos `ENOSPC` transitorios en
  Vitest. El usuario liberó espacio manualmente: nada que hacer de nuestro
  lado, solo dejar constancia por si reaparece.

## ✅ Fix crítico: audit_trigger() rompía todo UPDATE sobre companies (2026-07-22)

Descubierto al intentar reactivar "Revival Transportation Group" (suspendida)
desde `/super-admin/companies` — el dropdown de status mostraba el cambio
pero se revertía en cada recarga, sin ningún error visible.

- **Causa real**: `audit_trigger()` (migración 11, `search_path` fijado en
  migración 61) referencia `OLD.company_id`/`NEW.company_id` — válido para
  `bookings`/`payments`/`refunds`/`user_profiles` (tienen FK `company_id`),
  pero el trigger `audit_companies` también la aplica a la tabla `companies`,
  que NO tiene esa columna (solo `id`). Cualquier `UPDATE` sobre `companies`
  fallaba en Postgres con `record "old"/"new" has no field "company_id"`.
  **Esto también afecta `activateCompanySubscription`
  (`lib/billing/subscriptions.ts`), usada por el webhook real de Whop y por
  la renovación manual de suscripción desde super-admin** — probablemente
  bloqueó en silencio activaciones/renovaciones pagadas reales.
- **Por qué no se había notado antes**: `status-forms.tsx` (dropdown de
  super-admin) no revisaba el resultado del server action — el error de
  Postgres se perdía en silencio y el `<select>` (no controlado,
  `defaultValue`) mostraba el cambio en el navegador de todas formas,
  revirtiendo solo al recargar.
- **Fix de UI** (ya desplegado, `apps/web/components/super-admin/status-forms.tsx`):
  ambos `<select>` (status y plan) ahora son controlados, revierten
  visualmente si el guardado falla, y muestran el mensaje de error real.
- **Fix de base de datos** (migración 64, `audit_companies_trigger()`
  dedicada usando `id` en vez de `company_id`) — **pendiente del usuario**:
  correr `supabase/migrations/20260723000064_fix_companies_audit_trigger.sql`
  en Supabase SQL Editor. Sin esto, cualquier `UPDATE` sobre `companies`
  sigue fallando, incluyendo activaciones reales de Whop.
- **Verificado por el usuario** (2026-07-22): tras aplicar la migración,
  reactivar Revival Transportation Group desde `/super-admin/companies`
  quedó en `active` de forma persistente (confirmado en base de datos).

## ✅ Fix: crash nativo al abrir la app de pasajero (2026-07-22)

Tras el primer `eas build` real (perfil `apk`), la app instalaba pero se
cerraba de inmediato al abrir, sin mostrar ninguna pantalla (ni siquiera la
pantalla roja de error de React Native). Diagnosticado con `adb logcat` en un
dispositivo físico (no había otra forma de ver el error — los logs de EAS
Build solo cubren tiempo de compilación, nunca crashes en runtime).

- **Causa real**: `apps/passenger-mobile/lib/supabase.ts` lee
  `process.env.EXPO_PUBLIC_SUPABASE_URL!` sin fallback. El perfil `apk` de
  `eas.json` solo tenía `GOOGLE_MAPS_ANDROID_API_KEY` en su bloque `env` —
  faltaban las variables de Supabase. **EAS Build no lee el `.env` local del
  proyecto**, solo variables declaradas explícitamente en `eas.json` o en el
  panel de EAS — mismo problema que ya había pasado con la key de Maps.
  Sin la URL, `createClient()` lanzaba `Error: supabaseUrl is required.` al
  cargar el primer módulo JS, lo que abortaba el proceso nativo antes de
  poder renderizar cualquier UI (de ahí el cierre instantáneo sin pantalla
  de error).
- **Fix**: se agregaron `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  y `EXPO_PUBLIC_API_BASE_URL` al bloque `env` del perfil `apk` en
  `apps/passenger-mobile/eas.json`, junto a la key de Maps. Nuevo build
  confirmado funcionando por el usuario en dispositivo físico (llega a la
  pantalla de login).
- **Para recordar en Sprint 3+**: cualquier variable `EXPO_PUBLIC_*` o de
  `app.config.js` que se agregue a la app debe declararse también en
  `eas.json` → `build.apk.env`, no solo en `.env` local.
- **Empresa de prueba configurada**: `EXPO_PUBLIC_COMPANY_SLUG=luxeride-platform`
  (única empresa activa con vehículos y reglas de precio ya configurados
  al momento de esta prueba; `revival` no tenía datos suficientes y estaba
  suspendida — ver fix del trigger arriba). Signup + login + branding
  dinámico verificados end-to-end en dispositivo físico por el usuario.

## ✅ Reporte de rutas frecuentes — insight geográfico para Ads (add-on AI Growth Assistant) (2026-07-22)

El usuario preguntó si se puede capturar país/ciudad de origen y destino de
cada reserva para identificar zonas de alta demanda de cara a Google Ads/Meta.
Se dividió en dos partes: (1) reporte/insight con mapa interactivo (construido
en esta sesión) y (2) creación/gestión automática de campañas de Ads con
presupuesto — **explícitamente pendiente de revisión, NO construida**, el
usuario quiere revisar más detalles antes de decidir.

- **Migración 63** (`pickup_city`/`pickup_country`/`dropoff_city`/`dropoff_country`
  + `booking_source` en `bookings`): `booking_source` se agregó a pedido del
  usuario ("también sería bueno capturar desde dónde el cliente reserva: web
  o app Android, para saber dónde más se usa el sistema") — enum
  `web`/`mobile_app`/`staff`, default `'web'` a nivel de columna para no
  romper ningún call site existente.
- **Reverse geocoding nuevo** (`apps/web/lib/maps/reverse-geocode.ts`) — la
  key de servidor ya tenía Geocoding API habilitada (confirmado al configurar
  el mapa de la app móvil el mismo día), no hizo falta nada nuevo en Google
  Cloud. Se dispara en background (`waitUntil`, mismo patrón que el flight
  tracking) en `createPublicBookingAction` (cubre guest web Y la app de
  pasajero) y `createBookingAction` (staff/dispatcher) — nunca bloquea la
  creación de la reserva.
- **Cron de backfill** (`/api/cron/geocode-backfill`, diario, 100 reservas
  históricas por corrida) — usa `''` (no `NULL`) como marca de "ya se
  intentó, sin dato" para que una reserva con coordenadas raras no bloquee
  la cola para siempre.
- **`lib/route-insights/engine.ts`** — agregación pura y testeada (7 tests):
  corredores origen→destino (top 20 por volumen), top ciudades de origen/
  destino, puntos para heatmap, y desglose por canal (web/app/staff).
- **UI**: `/admin/growth-assistant` ganó su primer selector de pestañas
  ("Generador de contenido" | "Rutas frecuentes"). El mapa nuevo
  (`route-insights-map.tsx`) usa `HeatmapLayer` de Google Maps (librería
  `visualization`, agregada a `maps-provider.tsx` — no se usaba en ningún
  lado del proyecto) para pickups/dropoffs, más líneas de corredor
  (grosor = volumen, click muestra viajes/facturación). Mismo gating que el
  generador de contenido (`company_addons` ai_growth_basic/plus) — el
  reporte NO consume la cuota de `ai_growth_generations` (es lectura, no
  una llamada a OpenAI).
- **Hallazgo de tipos**: `@types/google.maps` tiene `HeatmapLayer` con un
  constructor vacío y sin `setMap`/`setData` (desactualizado respecto a la
  API real) — se resolvió con una interfaz local + cast puntual, documentado
  en el propio archivo.
- **Verificado**: `tsc --noEmit` limpio, 177/177 tests de Vitest (incluye
  los 7 nuevos de `aggregateRoutes`), `npm run build` compila
  `/admin/growth-assistant` y `/api/cron/geocode-backfill` sin errores.
  Servidor de dev levantado y confirmado que la ruta nueva redirige a login
  correctamente (protegida) — **no se pudo verificar visualmente el mapa
  con datos reales** por no tener credenciales de una cuenta con el addon
  activo en este entorno.
- **Pendiente del usuario**: correr la migración 63 en Supabase SQL Editor.
- **Explícitamente fuera de alcance** (a pedido del usuario, "pendiente de
  revisión"): creación/gestión automática de campañas de Google Ads/Meta con
  presupuesto asignado por el operador y medición de efectividad — quedó
  como conversación de producto, sin ningún código construido.

## 🚧 App nativa de pasajero — Sprint 2 (mapa en vivo + autocomplete) (2026-07-22)

Continuación del Sprint 0+1 de abajo, mismo día. El usuario pidió proceder
con Sprint 2 (mapa interactivo + autocomplete de direcciones), ya
documentado en `docs/PHASE-2-MOBILE.md`.

- **Bloqueo real, ya comunicado y aceptado por el usuario**: `react-native-maps`
  en Android necesita su PROPIA API key de Google Maps SDK, restringida por
  package name (`com.jprsdigitalconnect.luxeride.passenger`) + huella SHA-1
  del keystore de firma — algo que solo el usuario puede generar en su
  Google Cloud Console (requiere haber corrido `eas credentials` para tener
  el SHA-1). Se construyó todo el código de todas formas; sin esa key el
  mapa simplemente no renderiza, el resto de la app sigue funcionando.
  Instrucciones completas en `apps/passenger-mobile/.env.example`.
- `app.json` → `app.config.js` (necesario para leer la key desde el entorno
  en vez de comprometerla en un JSON estático versionado).
- **Autocomplete de direcciones sin exponer una key de Places a la app**:
  nuevo `apps/web/lib/maps/places-autocomplete.ts` + rutas
  `/api/mobile/passenger/places-autocomplete` y `/places-details` — proxy
  server-side reusando `GOOGLE_MAPS_SERVER_KEY` (ya configurada en
  producción), igual principio que `lib/maps/routes.ts`
  ("nunca exponer este módulo al cliente"). **Pendiente del usuario**:
  confirmar que "Places API" esté habilitada para esa key en Google Cloud
  Console (es un toggle, no una key nueva).
- `NewBookingScreen` ahora usa `AddressAutocomplete` (debounce 300ms +
  dropdown) en vez de texto libre — mantiene el fallback a
  `Location.geocodeAsync` del Sprint 1 si el usuario escribe sin
  seleccionar una sugerencia. El código postal resuelto por Places ahora
  se manda a `/quote` para mejorar la resolución de zona de precio.
- **Mapa en vivo (`TripTrackingScreen`, nuevo)**: se llega ahí con un botón
  "Ver mi viaje" desde `BookingSuccessScreen`. El pasajero autenticado lee
  `trip_locations` directo por Supabase Realtime (RLS
  `customers_select_own_trip_locations`, migración 62, ya aplicada) —
  mismo patrón que `apps/driver-mobile/screens/ChatScreen.tsx` (payload.new
  directo, sin side-channel de refetch como hace la web para el guest
  anónimo). La ruta se dibuja decodificando `bookings.route_polyline`
  (ya existente, sin volver a llamar la Routes API). Alcance de este
  sprint: el pasajero SOLO ve al conductor, no comparte su propia
  ubicación (eso requeriría una policy RLS de INSERT nueva + permiso de
  ubicación — no lo pide el mockup de referencia, queda fuera).
- **Verificado**: `tsc --noEmit` limpio (app y web), `npx expo export
  --platform android` compila con `react-native-maps` (3.35 MB, bundle
  sano), `npm run build` de `apps/web` compila con las 2 rutas nuevas de
  Places, 170/170 tests de Vitest.
- **Pendiente del usuario**: generar la key de Google Maps Android
  (ver `.env.example`), confirmar Places API habilitada para
  `GOOGLE_MAPS_SERVER_KEY`, y probar el mapa en un build real cuando
  ambas estén listas.
- **Backlog explícito, sin empezar** (Sprint 3-5, ver
  `docs/PHASE-2-MOBILE.md`): pago vía **Whop** (corregido — no Stripe, ver
  sección de abajo), chat con el conductor, viaje en curso, calificar,
  historial de viajes, perfil completo, i18n, primer `eas build`.

## 🚧 App nativa de pasajero — Sprint 0+1 (vertical slice) (2026-07-22)

A partir de un mockup de referencia de 17 pantallas (11 pasajero + 6
conductor) que el usuario compartió, se decidió arrancar `apps/passenger-mobile`
desde cero. El usuario confirmó dos decisiones de arquitectura antes de
construir: **cuenta real** (signup/login, no guest) y **mapa interactivo
nativo** (`react-native-maps`, Sprint 2 — no construido todavía). Plan
completo en `docs/PHASE-2-MOBILE.md` (Sprint 3-4, actualizado).

Siguiendo el mismo criterio que `apps/driver-mobile` (probar el pipeline
completo con una porción vertical antes de construir las 11 pantallas de
golpe), este pase cubre: **signup → login → cotizar → reservar**, sin pago
todavía.

- **Modelo de identidad**: el rol `customer` y el modelo de datos para
  pasajeros con cuenta ya existían end-to-end (`bookings.customer_id`,
  RLS `customers_select_own_bookings`) — solo faltaba el flujo de signup.
  Nuevo: `apps/web/app/actions/passenger-auth.ts` (`signupPassengerCore`,
  mismo patrón que `signupAction` pero rol `customer`) +
  `/api/mobile/passenger/signup` (público). Login usa
  `supabase.auth.signInWithPassword` directo, sin servidor.
- **White-label real (a pedido explícito del usuario)**: la app pinta el
  logo/nombre/color de la empresa configurada en `EXPO_PUBLIC_COMPANY_SLUG`
  en RUNTIME, nunca fijo en el código — nuevo endpoint público
  `/api/mobile/passenger/branding` (mismo patrón que ya usa la web en
  `quote/[id]`/`review/[id]`: logo en caja blanca o inicial sobre el color
  de marca si no hay logo) + `lib/branding.tsx` (`BrandingProvider`,
  contexto) + `components/BrandMark.tsx`. Esto es lo que hace posible que
  la MISMA app instalada sirva a cualquier empresa que use LuxeRide, sin
  tocar código por cliente. Limitación real (no resuelta, ya documentada):
  el nombre/ícono de la app en las stores SÍ queda fijo por build de EAS —
  un build de marca propia por operador es upsell Enterprise futuro.
- **Cotizar + reservar**: `/api/mobile/passenger/quote` y `/book` — rutas
  delgadas que delegan a `getPublicVehicleQuotesAction`/`createPublicBookingAction`
  (los mismos núcleos que ya usa el wizard público de la web, sin duplicar
  el motor de precios). `createPublicBookingAction` ganó un parámetro
  `customerId` opcional para asociar la reserva a la cuenta del pasajero.
- **Geocodificación con `expo-location`** (geocoder nativo del teléfono,
  gratis, sin key propia) en vez de autocomplete de Google Places — el
  autocomplete real llega en el Sprint 2 junto con el mapa interactivo.
- **Migración 62** (`stripe_customer_id` en `user_profiles` + RLS
  `customers_select_own_trip_locations`): el nombre de columna quedó mal
  puesto — **el pago en este proyecto es 100% vía Whop, no Stripe**
  (`getSavedWhopCardAction`/`chargeWithSavedWhopCardAction`,
  `passenger_whop_members`, ya existentes en `app/actions/payments.ts`).
  La columna queda sin usar hasta que el Sprint 3 de pago se replantee
  sobre Whop en vez de Stripe SetupIntent como se había planeado
  originalmente — corregido en `docs/PHASE-2-MOBILE.md`.
- **Pantallas construidas**: Auth (login+signup), Nueva reserva, Selección
  de vehículo, Confirmar reserva (sin cobro), Éxito, más stubs de Mis
  viajes/Perfil (Perfil sí tiene cerrar sesión real).
- **Verificado**: `tsc --noEmit` limpio (app y web), `npx expo export
  --platform android` compila (1024 módulos), `npm run build` de
  `apps/web` compila con las 4 rutas nuevas, 170/170 tests de Vitest.
- **Pendiente del usuario**: correr la migración 62 en Supabase SQL Editor
  (no aplicada todavía) y definir `EXPO_PUBLIC_COMPANY_SLUG` en
  `apps/passenger-mobile/.env` con el slug de una empresa real
  (`status = 'active'`) antes de poder probar el flujo en un dispositivo.
- **Backlog explícito, sin empezar** (Sprint 2-5, ver
  `docs/PHASE-2-MOBILE.md`): mapa en vivo interactivo (`react-native-maps`),
  autocomplete de Places, pago vía Whop, chat con el conductor, viaje en
  curso, calificar, historial de viajes, perfil completo, i18n, primer
  `eas build`.

## ✅ Auditoría completa de RLS + fix de seguridad + selector de idioma en 5 páginas públicas (2026-07-21)

- **Auditoría de RLS de las 60+ migraciones**: en general bien configurado
  (59 tablas, 58 con RLS habilitado, 102 políticas, aislamiento consistente
  por `company_id = auth_company_id()` en todo lo sensible, sin
  `USING(true)` accidental ni acceso `anon` fuera de catálogos
  intencionalmente públicos). 2 hallazgos críticos reales, ya corregidos
  en migración 61:
  - `live_tracking_usage_by_booking` era la única de las 59 tablas sin
    `ENABLE ROW LEVEL SECURITY` (no explotado hoy — solo se lee vía
    service-role — pero sin protección si se agrega una query client-side).
  - `auth_company_id()`, `auth_role()`, `auth_has_role()` y
    `audit_trigger()` — las funciones que usan literalmente todas las
    políticas del sistema — eran `SECURITY DEFINER` sin `search_path`
    fijo (patrón clásico de escalación de privilegios en Postgres,
    marcado por el Security Advisor de Supabase). `handle_new_user()`
    tenía el mismo defecto y ya se había corregido antes (migración 16);
    nunca se aplicó retroactivamente a estas 4.
  - Hallazgos medios sin acción automática (documentados, no son huecos):
    8 tablas con RLS habilitado pero cero políticas (deny-all por diseño,
    "solo service-role" documentado en el propio código); INSERT de
    `bookings` no exige `customer_id = auth.uid()`, solo `company_id`;
    `company_services_public_read` permite leer el catálogo de servicios
    de todas las empresas sin conocer el slug (intencional para el
    micrositio, riesgo bajo).
- **Selector de idioma agregado a 5 páginas públicas** que ya usaban el
  diccionario i18n (EN/ES/PT) para su contenido pero no tenían el
  `LanguageSwitcher`: `/affiliate/join/[token]`, `/payment/success`,
  `/payment/cancelled`, `/quote/[id]` y `/review/[id]`. Quedaban atrapadas
  en el idioma que resolviera la cookie/Accept-Language sin forma de
  cambiarlo. Verificado en navegador (dropdown abre, cambia a español
  correctamente). `/terms` y `/privacy` ya lo tenían (vía
  `LegalPageLayout`), no hacía falta tocarlas.

## ✅ Alertas de reserva/viaje nuevo + fixes de notificaciones + índices RLS + centro de notificaciones admin + badge de plan (2026-07-20)

- **Toast + sonido de reserva/viaje nuevo**: Dispatch Board y portal web del
  conductor (`/driver/trips`) avisan con un chime (Web Audio API, sin asset)
  + toast (`sonner`) cuando aparece una reserva/viaje nuevo entre renders —
  antes solo había polling silencioso. El auto-refresh del conductor dejó
  de depender de tener viajes activos.
- **3 fixes más de la auditoría de notificaciones**: `subscription-alerts`
  ahora también emaila a la propia empresa (antes solo el super-admin se
  enteraba); `reportDriverAction` (cliente reporta a un conductor) ahora
  notifica por email al admin; `document-alerts` se fusionó dentro de
  `compliance-alerts` (un solo cron, un solo email por conductor con todo
  lo que vence, en vez de dos crons en dos horarios).
- **4 índices RLS faltantes** en `trip_locations`, `trip_messages`,
  `audit_logs` y `notifications` — las 4 filtraban por `company_id` en su
  política sin índice propio o solo con índices simples. Migración 59.
- **Iconos en Editar/Eliminar** (9 tablas CRUD del admin: tipos de vehículo,
  zonas, reglas de precio, aeropuertos, servicios de portada, leads
  Enterprise de super-admin) en vez de texto — más limpio visualmente.
- **Badge de mantenimiento en Flota** rediseñado: pasó de un recorte ámbar
  pegado al nombre del vehículo a una pill propia en su propia línea.
- **Centro de notificaciones del panel admin (nuevo)**: concentra reporte
  de conductor, mantenimiento/seguro de vehículo y alerta de compliance en
  una campana con leído/no-leído (mismo patrón que la del super-admin).
  Diseñado explícitamente para volumen — los avisos no se calculan al
  vuelo en cada render (eso lo carga cada admin de cada empresa en cada
  navegación), se insertan una vez por evento o los detecta el cron diario
  con deduplicación de 14 días; el layout hace una sola query indexada por
  `(company_id, created_at)`; el mismo cron purga avisos de más de 30 días.
  Migración 60. Extendida el mismo día para incluir también "reserva nueva
  sin asignar" (interna o pública) — mismo criterio que el toast: solo si
  el intento de auto-asignación/auto-farm no la dejó asignada.
- **Badge de plan** (Free/Starter/Professional/Elite/Enterprise) en el
  topbar admin, colores ascendentes por prestigio (Enterprise en negro+
  dorado). De paso, el ícono de "Mensajes" dejó de compartir la campana
  visual con "Notificaciones" (ahora es una burbuja de chat).

## ✅ i18n de /auth/* + signup wizard + auditoría completa de notificaciones/alertas (2026-07-19)

- **i18n de /auth/***: las 5 páginas (login, signup, reset-password,
  update-password, verify-email) estaban 100% en inglés pese a que el
  selector de idioma ya funcionaba en el resto del sitio — solo
  `auth/layout.tsx` (panel lateral) estaba traducido, ningún `page.tsx`
  debajo. Convertidas a Server Component (trae el diccionario) + Client
  Component de formulario (`labels` por props), mismo patrón que
  `FeatureRequestButton`. Se quitó además un tagline redundante
  ("Plataforma de Transporte Premium").
- **Signup como wizard de 2 pasos** (Empresa → Tu cuenta): el formulario de
  6 campos desbordaba el viewport incluso en desktop (medido con DOM real,
  no supuesto) — el usuario eligió el wizard sobre solo comprimir espacios.
  Los campos del paso inactivo viajan como `<input type="hidden">` (no
  `display:none`, que exime la validación `required` de HTML5) para que la
  única submission final incluya los 6 campos sin importar el paso visible.
- **Campana de notificaciones del super-admin — estado leído/no-leído
  real**: antes el badge rojo se basaba solo en `feature_requests.status`
  (estado de negocio), así que reaparecía como "nuevo" aunque el super-admin
  ya lo hubiera visto varias veces. Ahora hay una tabla
  `super_admin_notification_reads` (migración 58, aplicada en producción)
  con `last_seen_at` por usuario, actualizada al abrir el panel; la lista
  además quedó acotada a un historial rodante de 7 días en vez de un top-8
  fijo. Alcance confirmado con el usuario: solo la campana de super-admin
  (el panel admin normal no tiene una campana equivalente).
- **Auditoría completa del sistema de notificaciones/alertas**, pedida
  explícitamente por el usuario ("antes de seguir construyendo, analiza
  todo el sistema") cubriendo super-admin, empresas (admin regular) y
  conductores. Gaps confirmados y corregidos en el momento:
  - **Dispatch Board + portal web del conductor**: no había ninguna señal
    (sonido/toast) ante una reserva o viaje nuevo, solo polling silencioso.
    Se agregó un chime de dos tonos (Web Audio API, sin asset de audio —
    no existía ningún patrón de sonido previo en la app web) + toast
    (`sonner`, ya estaba instalado) al detectar un ID nuevo entre renders.
    En el portal del conductor el auto-refresh dejó de depender de tener
    viajes activos (si no, un conductor sin viajes nunca se enteraría de
    uno recién asignado).
  - **Suscripción por vencer**: `subscription-alerts` solo le avisaba por
    email al super-admin (digest de todas las empresas); la empresa misma
    no recibía ningún correo sobre su propia suscripción. Ahora también se
    le emaila directo. *Corrección sobre mi propio hallazgo*: el popup
    in-app de suscripción por vencer (≤5 días o suspendida) **ya existía**
    en todo el panel admin (`app/admin/layout.tsx`), no solo en Settings —
    no se construyó nada duplicado ahí.
  - **Cliente reporta a un conductor**: `reportDriverAction` insertaba en
    `trip_reports` sin ningún aviso — el admin solo se enteraba si entraba
    a `/admin/driver-reports` por su cuenta. Ahora notifica por email al
    contacto de la empresa (conductor, motivo, detalle, link al reporte).
  - **Crons de vencimientos duplicados**: `document-alerts` (11am) y
    `compliance-alerts` (2pm) eran dos crons separados que podían mandarle
    al mismo conductor dos avisos de "algo vence" el mismo día. Se
    fusionaron en uno solo (`compliance-alerts`): un email por conductor
    con todo lo que venza (documentos genéricos, licencia, permiso
    chauffeur/for-hire) en vez de correos repartidos en dos horarios.
  - **Pendiente, marcado como secundario** (no construido en esta ronda):
    badge de Compliance visible fuera de `/admin/compliance` — hoy el
    aviso in-app (banner ámbar) solo se ve entrando a esa página
    específica, no hay indicador en el sidebar ni en el dashboard.

Verificación de esta ronda: typecheck, 170/170 tests y build de producción
limpios en cada entrega; el toast/sonido de reserva-nueva se verificó por
código (patrón de diffing + `sonner` ya usado en otra parte del proyecto)
pero no se pudo ejercitar en vivo con una reserva real por falta de
credenciales de prueba en este entorno — queda como verificación pendiente
del usuario si quiere confirmarlo con una cuenta real.

## ✅ Marketplace de add-ons + feedback con origen + notificaciones/cuenta super-admin + limpieza de datos + fixes SEO (2026-07-17/19)

Ronda de trabajo de 3 días, resumida (detalle completo en el historial de
commits, no repetido aquí):

- **Marketplace de add-ons** (`/admin/marketplace`): tienda unificada de los
  6 add-ons de pago con modal de detalle/compra, tiers para AI Chat/AI
  Growth, badges de estado (Activo/Disponible con intensidad de verde
  corregida tras feedback), badge "Mejor valor" y botón Comprar reubicados
  para no tapar el nombre del plan.
- **Centro de ayuda** (`/admin/help`): el ícono de Ayuda del topbar, que
  antes no hacía nada, ahora enlaza a un FAQ real por categorías.
- **Recomendar función / reportar problema con origen**: el botón ya vivía
  en el topbar del admin; se extendió a la PWA del conductor (`/driver/trips`)
  y al tracking público del cliente (`/track/[id]`, sin sesión, resuelve la
  empresa desde el `booking_id`). Cada solicitud queda etiquetada con su
  canal (`feature_requests.source`: admin/driver/customer), visible como
  columna en `/super-admin/feature-requests`. Migración 56 aplicada en
  producción.
- **Super-admin: topbar completo** — selector de idioma reubicado (arreglado
  el recorte visual del dropdown), campana de notificaciones nueva (solicitudes,
  compras de add-ons y ahora también empresas nuevas registradas), e ícono de
  cuenta con iniciales (antes ausente vs. los demás roles) enlazando a la
  nueva `/super-admin/settings` (datos de cuenta + cambio de contraseña).
- **Dashboard super-admin**: el bloque de pagos ya no menciona solo Stripe
  (ahora contempla Stripe Connect **o** Whop Connect, según el proveedor de
  cada empresa) y se agregó una tabla de adopción de add-ons por empresa
  (qué empresa tiene cuáles activos + lista de empresas activas sin ningún
  add-on, para detectar oportunidades de upsell).
- **SEO**: corregido el dominio equivocado en el header CORS de `vercel.json`
  (apuntaba a `luxeride.vercel.app` en vez de `getluxeride.vercel.app`),
  empresa demo excluida del sitemap público y marcada `noindex`, `llms.txt`
  documentando el patrón de páginas por operador. El "Sitemap could not be
  read" de Search Console se investigó a fondo (200, XML válido, funciona
  hasta con el user-agent de Googlebot) — conclusión: reporte de un rastreo
  viejo, sin causa técnica reproducible hoy; pendiente que el usuario le dé
  "Volver a probar" en Search Console.
- **Limpieza de datos de producción**: se auditaron las ~40 tablas que
  referencian `company_id` y se borraron 25 empresas de prueba (creadas
  durante verificaciones de UI de esta misma semana, todas con 0 reservas/
  conductores/vehículos/usuarios) + sus 87 registros huérfanos en
  `audit_logs`. Quedan exactamente 3 empresas en producción: LuxeRide
  Platform, LuxeRide y Revival Transportation Group (cliente real).

## ✅ Portal corporativo: facturas + autogestión de crédito del equipo (2026-07-16)

A raíz de explorar la idea de un "portal de clientes" completo, se auditó
qué tanto ya existía (`/account/bookings`, `/corporate/dashboard`, tarjeta
guardada de Whop) antes de proponer nada nuevo. Se encontró que la
facturación corporativa YA estaba completa en el backend (el cron mensual
`app/api/cron/corporate-invoices` ya generaba `invoices` +
`invoice_line_items` reales) pero nunca se mostraba al cliente. Se
construyeron 2 módulos sobre `/corporate/dashboard`, solo visibles para el
`corporate_manager`:

1. **Facturas** — lista de invoices de la cuenta con detalle de line items
   expandible (`<details>` nativo, sin JS extra).
2. **Mi equipo** — el manager ajusta el límite por viaje y mensual de sus
   propios miembros (`updateCorporateMemberLimitsAction`, nueva), con un
   guardrail: la suma asignada entre el equipo no puede exceder el
   `credit_limit` que el operador le otorgó a la cuenta. El manager no
   puede editar su propio límite ni el crédito total de la cuenta (eso
   sigue siendo control exclusivo del operador).

Sin migración — ambas columnas (`spending_limit`, `monthly_limit`) y las
tablas de facturación ya existían. Verificado end-to-end en navegador:
factura con line items, guardrail de crédito rechazando una asignación que
excedía el disponible, guardado exitoso dentro del límite, y confirmación
de que un `corporate_user` normal no ve ninguna de las dos secciones.
Typecheck, 170 tests y build de producción limpios.

**Explícitamente fuera de alcance** (decisión del usuario): no tocar la
integración de tarjeta guardada (Whop por teléfono) — se deja tal como
está hoy.

## ✅ Audit trail de reservas ampliado + pestaña "Booking Trail" (2026-07-16)

El usuario preguntó qué tan a fondo se puede rastrear una reserva (quién la
creó, despachó, canceló, cobró, reasignó, etc.). Auditoría del código +
consulta directa a producción reveló un hallazgo real: el trigger genérico
de `audit_logs` SÍ guarda el diff completo (old/new) de bookings/payments/
refunds/user_profiles/companies, pero su `user_id` depende de `auth.uid()`,
que queda `NULL` porque casi todas las mutaciones pasan por el cliente
service-role — confirmado con una consulta a producción (los últimos 15
audit_logs de bookings tenían `user_id: null`).

En vez de reescribir ese trigger (exigiría cambiar cómo cada server action
ejecuta sus escrituras), se amplió `booking_events` — que ya usaba un patrón
confiable (actor_id explícito pasado desde la propia server action, que sí
conoce a `user.id` vía `requireRole`) — con 3 tipos de evento nuevos:
`created`, `driver_assigned` (antes la primera auto-asignación se
etiquetaba por error como `driver_reassigned`, corregido), `payment_recorded`.

Además: `bookings.created_by` / `dispatched_by` (nuevas columnas),
`/admin/bookings/[id]` ahora muestra el vehículo específico asignado (antes
solo el tipo) y quién creó/despachó/canceló cada reserva, y `/admin/audit`
tiene una segunda pestaña "Booking Trail" con la bitácora ampliada,
filtrable por tipo de evento. Verificado end-to-end en navegador (reserva
de prueba con conductor, vehículo y pago simulados — los 3 se vieron
correctamente en el detalle de reserva y en la nueva pestaña). Migración
`20260716000053` aplicada por el usuario en Supabase Studio. Typecheck,
170 tests y build de producción limpios.

**Pendiente conocido, no cerrado**: número de permiso del vehículo
("for-hire permit") vive en JSONB sin estructurar (`vehicles.compliance`),
no en una columna propia, y no se muestra en el detalle de la reserva —
solo en la pantalla de cumplimiento del vehículo. Igual que "quién aceptó
el viaje" (el conductor solo puede *rechazar*, no hay paso explícito de
aceptación) — ninguno de los dos se abordó en esta ronda.

## ✅ Auditoría responsive/móvil de las 71 pantallas (2026-07-16)

Revisión sistemática de todas las rutas de `apps/web/app` (públicas,
admin, dispatcher, driver, corporate, super-admin) buscando problemas de
optimización web/móvil, corrigiendo sobre la marcha.

**Hallazgo principal (P1, sistémico)**: ninguna de las 24 tablas de datos
de toda la app tenía wrapper de scroll horizontal. En móvil, el
contenedor `overflow-hidden` recortaba silenciosamente las columnas que
no cabían — confirmado en vivo: 151px de una tabla de 461px quedaban
invisibles, sin forma de acceder a esos datos desde el celular. Corregido
envolviendo cada `<table>` en un `<div overflow-x-auto>` (22 archivos, 26
tablas: bookings, fleet, drivers, team, zones, pricing, payroll,
promo-codes, partners, quotes, reports, audit, esignature, airports,
driver-reports, y todo `/super-admin`).

**Otros hallazgos menores corregidos**:
- 3 grids con `grid-cols-3` fijo sin breakpoint (detalle de reserva,
  detalle de cuenta corporativa, dashboard super-admin) → `grid-cols-2
  sm:grid-cols-3`.
- Touch targets del sidebar móvil (botones Abrir/Cerrar menú) por debajo
  de 44px → aumentados a ~40-44px.
- Toggle de disponibilidad del conductor en `/driver/trips` (control
  frecuente en el celular) de 27px a 38px de alto.

Verificado con cuentas de prueba reales para los 6 roles (owner,
dispatcher, driver, corporate, customer, super_admin) a 375px de ancho —
cuentas ya eliminadas por completo. Typecheck, 170 tests y build de
producción limpios. Commit `3709811`, ya en producción.

**Ronda 2 (mismo día)**: el usuario mostró 4 capturas reales de pantallas
que seguían viéndose mal en móvil. El barrido automático anterior (grep
por `<table>` y `grid-cols-3+`) no las detectó porque eran dos categorías
distintas: filas `flex justify-between` sin `flex-wrap` (no son tablas ni
grids), y un `grid-cols-2` (no 3+) que igual se apretaba con etiquetas
largas — es decir, "2 columnas siempre es seguro" era un supuesto falso.
Corregido: `/super-admin/tracking` (fila de precio/cuota por plan),
`/super-admin/compliance` (filas de la cola de revisión, 3 secciones),
`/admin/pricing` (grid del formulario "Agregar regla" a `grid-cols-1
sm:grid-cols-2`), y `/admin/team` (tabla reescrita como tarjetas
apiladas en móvil, con la tabla original intacta para desktop). Verificado
en vivo a 375px con cuenta de prueba nueva (creada y eliminada por
completo). Typecheck limpio. Commit `57f20fb`, ya en producción.

## ✅ Onboarding guiado para empresas nuevas (2026-07-15)

Checklist de setup en `/admin/dashboard` (banner no bloqueante, siempre
visible mientras falte algo, sin migración): `lib/onboarding/checklist.ts`
(puro, 6 tests) + `lib/onboarding/gather.ts` (conteos por `company_id`).
5 ítems: Flota (vehicle_types + vehicles), Zonas/tarifas (service_zones o
pricing_rules), Pagos (**solo Whop Connect** — Stripe Connect existe en el
código pero no es el método de cobro real de LuxeRide; su
`stripe_connect_onboarded` solo se activa con una key real de Stripe, que
hoy es un placeholder no funcional), Equipo (drivers), Marca (logo + color
+ al menos 1 servicio). Verificado en navegador con una empresa de prueba
real, ya eliminada por completo (perfil, auth, audit_logs, empresa).

## ✅ Prueba de estrés pre-lanzamiento (2026-07-15)

Sistema aún sin clientes reales, así que se generó volumen de datos real
sin riesgo: 5 empresas de prueba × 2,000 reservas c/u (10,000 total,
insertadas directo vía admin client, sin pasar por Maps/email), + prueba
de concurrencia con `autocannon` contra un build de producción local
(`next build && next start`, NO el dev server — el dev server da
lecturas de latencia irreales por la recompilación de rutas).

**Resultados:**
- Landing (`/`) y micrositio de reserva pública (`/book/[slug]`) con 50
  conexiones concurrentes: latencia mediana ~1-1.1s, sin errores, estable
  (esto corriendo en una sola máquina local — Vercel con auto-scaling e
  instancias serverless debería comportarse igual o mejor).
- **Bug de correctness real encontrado y corregido**: `/admin/bookings`
  traía TODAS las reservas de la empresa (sin `.limit()`) solo para armar
  el conteo por estado. Con 2,000 reservas eso choca con el límite
  silencioso de 1000 filas de PostgREST — **cualquier empresa con más de
  1000 reservas mostraba contadores por estado incorrectos, sin ningún
  aviso**. Corregido con 9 queries `head:true` en paralelo (mismo patrón
  que `/admin/dashboard`) — commit `a9789c5`, ya en producción.
- Dispatch Board, Reportes y Operator Score: tiempos normales con el
  volumen probado (el "9.2s" inicial en Dispatch Board fue compilación de
  Next.js en modo dev, no un problema real — confirmado con una segunda
  carga en 723ms).
- Todos los índices relevantes de `bookings` (`company_id`,
  `company_id+status`, `company_id+scheduled_at`) ya existen — no hizo
  falta agregar ninguno.

**Falsa alarma corregida (2026-07-16)**: se reportó aquí que Upstash Redis
no estaba configurado y que el rate limiting caía a un fallback en
memoria no confiable en Vercel. Error mío — solo revisé
`apps/web/.env.local` (el archivo local de este entorno de desarrollo),
nunca las variables de entorno reales de Vercel, a las que no tengo
acceso. El usuario confirmó con captura del dashboard de Vercel
(Settings → Environment Variables) que `UPSTASH_REDIS_REST_URL` y
`UPSTASH_REDIS_REST_TOKEN` SÍ están configuradas, en Production y
Preview, actualizadas 2026-07-09 — antes incluso de esta prueba de
estrés. El rate limiting distribuido real sí está activo en producción.
Sin acción pendiente sobre esto. Lección: para cualquier gap de
configuración futuro, aclarar explícitamente que solo se revisó el
`.env.local` local y pedir confirmación de Vercel antes de reportarlo
como pendiente real.

**No probado (fuera de alcance de hoy)**: el flujo completo de
cotización→reserva bajo carga real, porque la API key de Google Maps está
restringida por dominio (rechaza `localhost`, correctamente) — para
probar ese flujo de punta a punta haría falta correrlo contra el dominio
real de producción, una decisión aparte por tocar el sitio en vivo.

## 🔑 TL;DR — pendientes activos ahora mismo (2026-07-19)

**Del usuario (acción externa, no depende de código):**
1. **`OPENAI_API_KEY`** — pendiente A PROPÓSITO hasta el primer cliente real de
   cualquiera de los dos asistentes de IA (Chat Assistant o Growth Assistant).
   Sin ella, ambos add-ons responden con un error controlado si alguien los
   activa por Whop — no rompen nada, solo no generan texto todavía.
2. **Variables de entorno del add-on de Red de Afiliados en Vercel** — el
   plan ID y el checkout URL de Whop ya existen, solo falta cargarlos (sin
   acceso a Vercel CLI desde este entorno).
3. **App nativa Android del conductor — EN PAUSA desde 2026-07-10**
   (`apps/driver-mobile/`). No es un esqueleto: 6 pantallas completas
   (login, viajes, viaje activo, ganancias, documentos, perfil), GPS en
   vivo, presencia de flota, chat con el pasajero, push con sonido, cobro
   en efectivo + firma, viajes de afiliados, rediseño premium tras 5+
   rondas de prueba en dispositivo real — todo deployado en `main`,
   typecheck limpio. Lo único que falta para retomar es que el usuario
   corra su primer `eas build --profile development` (o el APK de
   producción) desde `apps/driver-mobile` — sin eso no se puede confirmar
   que el push con teléfono bloqueado funciona de verdad (Expo Go no lo
   soporta bajo ninguna circunstancia desde el SDK 53). Detalle completo,
   backlog explícito (mapa embebido, multi-stop, cola offline, i18n
   diferido a propósito) y hallazgos de seguridad en la sección "Estado al
   pausar (2026-07-10)" al final de `docs/PHASE-2-MOBILE.md`.
4. **Google Search Console**: dar "Volver a probar/enviar" al sitemap — el
   error "Sitemap could not be read" no tiene causa técnica reproducible hoy
   (verificado 2026-07-19: 200, XML válido, funciona incluso con el
   user-agent de Googlebot); todo indica que es un reporte de un rastreo
   anterior a los últimos fixes.
5. **Decisión de negocio, sin fecha**: ¿construir una API pública real para
   Enterprise, o ajustar el copy? Hoy "Integraciones a medida y API" es una
   promesa sin nada detrás (ver sección F2 más abajo).
6. Gaps de infraestructura ya conocidos, sin apuro: WhatsApp Business
   (pospuesto), Intuit Development→Production para QuickBooks (investigado,
   sin construir), Stripe con keys reales cuando haya clientes, Twilio para
   SMS cuando se quiera activar.

**Ideas evaluadas, no construidas (esperando que el usuario pida avanzar):**
- **Chauffeur Quality System** — evaluado, valor real pero menor prioridad;
  se iría completando como pieza de apoyo al Operator Score, no como
  lanzamiento propio.
- **LuxeRide Launch Package, fork de landing (2 rutas) y plan "Solo
  Operator"** — evaluados 2026-07-12 tras comparativa contra A+Drive
  (competidor enfocado en conductores independientes de Uber/Lyft). Usuario
  confirmó explícitamente NO construir todavía, solo dejarlo documentado.
  Detalle completo, orden recomendado y hallazgos técnicos en la sección
  "📋 A+Drive vs LuxeRide" más abajo.

**Trabajo construido pero con una pieza real sin cerrar:**
- **Programa de referidos entre empresas**: atribución, niveles y expiración
  a 12 meses funcionan completos, pero el pago real de la comisión vía API
  de Whop (`affiliate`/`override`) no está construido — falta confirmar
  cómo Whop permite cortar selectivamente la comisión de un solo referido
  sin afectar a los demás del mismo referrer. Mientras tanto un cron diario
  solo avisa por email cuando algo vence (ver sección "Programa de
  referidos" más abajo).

**Todo lo demás ya está construido y desplegado en producción**: AI Chat
Assistant, AI Growth Assistant, Partner Portals, LuxeRide Operator Score,
marketplace de add-ons, feedback con origen (admin/conductor/cliente),
notificaciones + cuenta de super-admin, y los fixes de SEO de esta semana —
ver el detalle completo de cada uno en las secciones de abajo.

## 📋 A+Drive vs LuxeRide + 3 iniciativas evaluadas, NO construir aún (2026-07-12)

Usuario pidió a ChatGPT comparar getluxeride.vercel.app contra aplusdrive.com
(competidor: paquete de branding+web+booking para conductores independientes
de Uber/Lyft que quieren dejar de depender de esas apps, US$597 inicial +
US$29.99/mes). Conclusión del análisis: LuxeRide gana en profundidad
operativa (despacho, flota, cuentas corporativas, compliance, etc.) por
amplio margen, pero A+Drive gana el primer contacto con conductores
individuales — un segmento que hoy LuxeRide ni siquiera le habla en su
landing. Se evaluaron 3 iniciativas para cerrar esa puerta de entrada SIN
diluir el posicionamiento premium/empresarial ya construido. **Ninguna se
construye todavía — el usuario pidió explícitamente dejarlas solo como
pendiente.** Se descartó expresamente la idea de "LuxeRide Operator
Academy" (comunidad/cursos) — no interesa agregarla.

### 1. Fork de landing en dos rutas comerciales
Selector arriba del hero ("Soy conductor independiente" / "Administro una
empresa o flota") que lleva a dos landings o secciones ancla distintas.
Importante: el selector va ANTES del hero corporativo actual, no lo
reemplaza — mezclar ambos mensajes en un solo hero (como sugirió ChatGPT en
su copy final) diluiría el posicionamiento premium ya construido. Solo
copy/UI, sin tocar backend.

### 2. LuxeRide Launch Package (paquete de onboarding, pago único)
Neutraliza directamente la ventaja de A+Drive (implementación "llave en
mano"). Dos sub-niveles sugeridos en vez de un rango difuso:
- **Essentials US$597**: marca + web + booking + Stripe configurado.
- **Complete US$997**: + dominio propio, SEO local extendido, lanzamiento
  prioritario en 7 días.

Implementación de bajo esfuerzo (cero cambios de esquema):
- Reutilizar `components/admin/enterprise-lead-modal.tsx` +
  `app/actions/enterprise-leads.ts` (`submitEnterpriseLeadAction`) agregando
  un campo `lead_type` (`'enterprise' | 'launch_package'`) en vez de
  duplicar tabla/action — el patrón ya es genérico.
- Cobro: producto de pago único en Whop (riel de pagos ya existente, no
  meter Stripe Checkout aparte solo para esto).
- Fulfillment 100% manual con las herramientas de super-admin que ya
  existen (crear empresa, subir logo, configurar flota/tarifas) — es un
  servicio humano, no una feature de software.

### 3. Plan "Solo Operator" (US$49–79/mes)
1 conductor, hasta 2 vehículos, hasta 75 reservas/mes, sin despacho
avanzado, comisión igual o ligeramente arriba del 3% de Starter (para
proteger margen dado el precio bajo de suscripción).

**Hallazgos técnicos (investigado 2026-07-12, evitar re-investigar):**
- `plan_quotas` (límites: vehículos/conductores/reservas-mes/equipo/%
  comisión) es 100% data-driven vía `getPlanLimits()` en
  `apps/web/lib/plans/limits.ts` — cero cambios de código para los límites.
- Pero el "plan" en sí es un enum de Postgres (`company_plan`, definido en
  `supabase/migrations/20260607000001_extensions.sql`) + union type TS en
  `database.types.ts`. Agregar un tier ya se hizo una vez para Elite
  (`20260708000035_plan_elite_tier.sql`: `ALTER TYPE` en su propia
  migración por restricción de Postgres, + INSERT en `plan_quotas`) — mismo
  patrón, esfuerzo conocido y acotado.
- `apps/web/app/super-admin/tracking/page.tsx` tiene arrays hard-coded
  `PLAN_ORDER`/`PLAN_LABEL` — agregar una línea, no permite crear planes
  desde la UI.
- `apps/web/lib/billing/whop.ts` (`mapWhopPlanId`) mapea con 4 `if`
  hard-coded contra env vars — un 5to tier necesita una env var
  (`WHOP_PLAN_ID_SOLO_OPERATOR`) + un `if` más.
- **No existe ningún gate de plan sobre Dispatch Board/auto-assign** — no
  hace falta construir una restricción para "sin despacho avanzado": con 1
  solo conductor permitido, el despacho ya no tiene nada que despachar.

**Orden recomendado cuando se decida avanzar:** (1) Launch Package primero
(menor esfuerzo, mayor apalancamiento), (2) fork de landing en paralelo
(solo copy/UI), (3) Solo Operator al final y solo tras validar demanda real
capturando esos leads con el mismo modal genérico (`lead_type:
'solo_operator'`) y dando de alta manual en un Starter con precio ajustado
— evita construir el tier formal (enum + Whop) especulativamente.

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

1. **Search Console + Bing Webmaster Tools**: ✅ completado 2026-07-11 —
   ambos verificados y con sitemap enviado (`getluxeride.vercel.app`,
   distinto del otro proyecto del usuario `credytek.vercel.app` que ya
   tenía en Bing). Bing marcó un issue real de SEO al inspeccionar la URL:
   "Meta Description too long or too short" — la description medía entre
   177 y 199 caracteres según idioma (EN/ES/PT), por encima del máximo
   recomendado (~160). Ya corregida a 142-147 caracteres en los 3 idiomas
   (`landing.metaDescription` en los diccionarios), manteniendo la info
   clave. El "Couldn't fetch" que mostró Google en el primer intento de
   leer el sitemap es normal justo después de enviarlo por primera vez
   (se confirmó que `https://getluxeride.vercel.app/sitemap.xml` responde
   XML válido) — se resuelve solo en horas, no requiere acción.
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
6. **Probar /super-admin/subscriptions**: ✅ revisado 2026-07-11 (código,
   no login directo — no había credenciales disponibles en este entorno).
   Encontrado y corregido un bug real: `updateCompanyPlan` no invalidaba
   `/super-admin/subscriptions` (solo `/super-admin/companies`), así que
   cambiar el plan de una empresa desde el selector de esa página no se
   reflejaba ahí sin recargar manualmente. El resto (KPIs, aprobar/
   rechazar solicitudes, renovar suscripción con `activateCompanySubscription`
   extendiendo desde la fecha correcta) se revisó y está bien.
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
3. ✅ **Dominio propio del cliente** `reservas.suempresa.com` (HECHO 2026-07-24,
   add-on nuevo "Dominio personalizado" $15/mes — ver sección L abajo).
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

### E. SEO para IA + todos los buscadores (pedido 2026-06-14, auditoría/fixes 2026-07-11)
- ✅ Buscadores: el SEO (meta tags, OG, sitemap, canonical, robots) es estándar
  → sirve para Google, Bing, DuckDuckGo, Brave, Ecosia, etc. (no solo Google).
  Google Search Console y Bing Webmaster Tools ya verificados y con sitemap
  enviado (2026-07-11) — ver detalle en "Pendientes del usuario" #1.
- ✅ IA: JSON-LD LocalBusiness por operador (2026-06-14) → ChatGPT, Perplexity,
  Claude, Gemini pueden entender y recomendar cada operador. robots no bloquea
  GPTBot/PerplexityBot/etc.
- ✅ **llms.txt** (2026-07-11): `public/llms.txt` con resumen del producto,
  add-ons y pricing exacto — se actualiza cada vez que cambian planes/precios.
- ✅ **JSON-LD del landing corregido** (2026-07-11): el schema
  `SoftwareApplication` nunca incluía la lista de features de cada plan en su
  `Offer` (solo nombre/precio/desc corta) — bug real, ya arreglado en
  `lib/seo/structured-data.ts`. Ahora cualquier feature/add-on nuevo que se
  agregue a `plans[i].features` en los diccionarios aparece automáticamente
  en el JSON-LD, sin tocar el schema.
- ✅ **hreflang + páginas por idioma** (2026-07-11): el landing ya tiene
  `/en`, `/es`, `/pt` como páginas ESTÁTICAS dedicadas (antes solo existía
  `/` con idioma resuelto por cookie/Accept-Language, invisible para SEO
  multi-idioma). Cada una con su propio `canonical` + `title` +
  `description` traducidos y tags `hreflang` cruzados + `x-default`. Ver
  `components/landing/landing-content.tsx` (contenido único, parametrizado
  por locale) y `lib/seo/hreflang.ts`.
- Opcional futuro: más tipos Schema (Review, AggregateRating cuando existan
  calificaciones agregadas) para recomendaciones más ricas.

### F2. Navegación del sistema + gap de API (auditoría/fixes 2026-07-11)
- ✅ **Login en los micrositios**: ninguna de las 4 plantillas (noir, ivory,
  bold, corporate) tenía acceso a `/auth/login` desde el header público — se
  agregó un link "Iniciar sesión" en las 4, verificado sin desborde a 375px.
- ✅ **Sidebar de super-admin reconstruido**: no tenía íconos ni se ocultaba
  en móvil (a diferencia del sidebar de admin normal). Reconstruido con
  paridad completa (íconos lucide, modo colapsado persistido) + drawer móvil
  nuevo detrás de un botón hamburguesa. Se descubrió que el sidebar de admin
  normal tenía el mismo hueco de responsividad móvil (nunca reportado) y se
  le aplicó el mismo arreglo. **Nota de verificación**: el slide-in del
  drawer al hacer clic no se pudo confirmar visualmente al 100% en este
  entorno de preview (mediciones de posición inconsistentes pese a que el
  estado de React y las clases CSS se actualizaban bien en cada prueba) —
  probable limitación de tooling, no del código, pero pendiente que el
  usuario lo confirme una vez en su teléfono.
- ⬜ **API pública para Enterprise — NO existe, solo copy.** El plan
  Enterprise promete "Integraciones a medida y API" pero se confirmó por
  búsqueda exhaustiva en `app/api/*` que hoy solo hay endpoints internos
  (app móvil del conductor, webhooks de Stripe/Whop/QuickBooks, crons,
  manifest/PWA) — nada público/documentado que un cliente pueda consumir.
  **Pendiente de decisión del usuario**: construir una API real (auth por
  API key, endpoints documentados, rate limiting propio) o ajustar el copy
  de Enterprise mientras tanto para no prometer algo que no existe.
- ✅ **"Múltiples empresas / DBAs" (Enterprise) — mismo problema, ya
  corregido 2026-07-11.** El usuario preguntó por este punto del plan
  Enterprise y se confirmó que tampoco existe: `user_profiles.company_id`
  es una columna simple (una empresa por cuenta, para siempre, reforzado
  por RLS) — no hay tabla de relación usuario↔empresa, ni selector de
  "cambiar de empresa" en la UI, ni concepto de empresa padre/grupo de
  marcas en el esquema. **Decisión del usuario**: no construirlo por ahora
  (se revisa a fondo si un cliente real lo pide), pero SÍ corregir el copy
  para no prometer algo inexistente. Reemplazado en `lib/i18n/dictionaries/
  {en,es,pt}.ts` (tarjeta de pricing + modal de lead Enterprise en
  `enterpriseBenefit2`) por **"Asistente de chat con IA incluido"** — este
  sí es un beneficio real y entregable: el super-admin puede activar
  manualmente `ai_chat_basic`/`ai_chat_plus` sin costo para una cuenta
  Enterprise negociada (mismo toggle de `/super-admin/companies/[id]`
  construido para el add-on, ver sección de más abajo), igual que ya se
  hace con "Dedicated account manager" o "Data migration done for you"
  (compromisos manuales por venta directa, no automatizados).

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
- ✅ **Autoservicio: HECHO por completo.** Producto creado en Whop
  ($29/mes, plan ID `plan_yiizBu4P6kbnt`, checkout URL
  `https://whop.com/jprs-digital-connect/luxeride-affiliate-network-add-on/`)
  y las dos env vars (`WHOP_PLAN_ID_AFFILIATE_ADDON`,
  `WHOP_CHECKOUT_URL_AFFILIATE_ADDON`) ya cargadas en Vercel por el usuario
  (2026-07-10, en otra sesión). Código ya estaba 100% listo desde antes
  (`isAffiliateAddonPlan()`, webhook, `AffiliateNetworkUpsell`). Pendiente
  solo confirmar visualmente en producción que `/admin/affiliates` muestra
  el botón de checkout real (no el formulario de lead) para una empresa
  Starter/Professional sin el addon activo.
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
  útil) — dejarlo así hasta que haya feedback real de uso.
- ✅ **Fases 3 (Pools), 4 (Bidding) y 5 (Auto-farm) — construidas y desplegadas
  2026-07-10/11** (migración `20260710000046_affiliate_pools.sql`, aplicada
  en producción por el usuario).
  Antes solo se podía enviar un booking a UN afiliado a la vez (índice único
  por `booking_id`) — ahora se puede mandar a varios simultáneamente
  (`sendBookingToAffiliateAction` acepta `companyAffiliateIds: string[]`):
  cada uno recibe su propia fila `requested`, el primero que acepta gana
  (`closeSiblingPoolMembers` pasa a los demás a un nuevo estado `'lost'`,
  llamado tanto desde `respondToAffiliateTripAction` como desde
  `resolveCounterOfferAction`), protegido a nivel de base de datos por un
  índice único que ahora solo cubre estados OPERATIVOS
  (`accepted`/`en_route`/`arrived`/`in_progress`) en vez de cualquier
  solicitud activa — dos afiliados aceptando casi al mismo tiempo dan un
  error de carrera con mensaje claro ("Otro afiliado ya se quedó con este
  viaje"), no un 500. `send-to-affiliate-card.tsx` (en `/admin/bookings/[id]`)
  ahora es una lista de checkboxes en vez de un `<select>`, y muestra un
  estado de "pool" con cada afiliado pendiente + sus contraofertas
  (Fase 4: comparar y aceptar cualquiera desde ahí) + "Cancelar todo el
  envío" (`cancelAffiliatePoolAction`). **Fase 5 (auto-farm)**: si
  `tryAutoAssignDriver` no encuentra conductor propio, y la empresa tiene la
  Red de Afiliados activa, `tryAutoFarmToAffiliates` (en
  `lib/dispatch/auto-assign.ts`) manda automáticamente la reserva como pool
  a sus afiliados aprobados (precio por defecto: 70% de lo cobrado al
  pasajero) — conectado en los 3 puntos donde ya se llamaba
  `tryAutoAssignDriver` (creación de reserva interna, reserva pública, y el
  cron diario de respaldo), con guard contra re-ejecución (si el cron corre
  de nuevo sobre una reserva que ya farmeó y sigue con solicitudes vivas, no
  duplica el envío). **Score de confiabilidad**:
  `computeAffiliateReliability()` en `lib/affiliates/engine.ts` (tasa de
  respuesta, minutos promedio de respuesta, puntualidad — mismo cálculo que
  ya existía por conductor en `/admin/drivers/[id]`), mostrado en
  `/admin/affiliates` por cada relación aprobada. **HECHO 2026-07-11 —
  filtrado + priorización real del auto-farm**: ya no manda a todos los
  aprobados sin filtrar. (1) Excluye afiliados sin un vehículo de la misma
  CLASE que pide la reserva (`vehicle_types.class`, enum compartido entre
  empresas) y sin cobertura de zona de servicio en el punto de recogida
  (`resolveZoneId`; un afiliado sin zonas definidas cuenta como sin
  restricción). (2) Prioriza por `computeAffiliateReliability()`: la tanda 1
  solo va a la mitad superior por score (un afiliado sin historial recibe
  puntaje neutro, no penalizado); si esa tanda se cierra entera sin que nadie
  acepte, la siguiente corrida del cron diario manda una tanda 2 al resto de
  los elegibles. No hay escalonamiento con delay corto real (el plan Hobby de
  Vercel solo permite cron una vez al día) — la tanda 2 depende de esa
  corrida, no de un temporizador.

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
3. ✅ **Fase 3 — Pools — HECHO 2026-07-10.** Enviar a un grupo de afiliados a
   la vez en vez de uno por uno; el primero que acepta gana, los demás pasan
   a `'lost'` automáticamente. (Recorte: el dispatcher sigue eligiendo a mano
   de su lista de afiliados aprobados vía checkboxes, sin filtro por ciudad/
   aeropuerto/rating en ESTA pantalla manual — el auto-farm de Fase 5 sí
   filtra y prioriza, ver más abajo.)
4. ✅ **Fase 4 — Bidding — HECHO 2026-07-10.** El mecanismo de contraoferta ya
   existía desde la Fase 1 (1 a 1); lo nuevo es la vista de pool en
   `/admin/bookings/[id]` que muestra las contraofertas de varios afiliados
   a la vez para que el dispatcher compare y acepte cualquiera.
5. ✅ **Fase 5 — Auto-farm — HECHO 2026-07-10, filtrado + priorización
   HECHO 2026-07-11.** `tryAutoFarmToAffiliates` en
   `lib/dispatch/auto-assign.ts`: si no hay conductor propio disponible,
   manda automáticamente un pool a sus afiliados aprobados (precio por
   defecto 70% de lo cobrado al pasajero). Filtra por clase de vehículo real
   de la flota del afiliado (`vehicle_types.class`, enum compartido) y por
   cobertura de `service_zones` en el punto de recogida (sin zonas definidas
   = sin restricción); prioriza a los candidatos elegibles por
   `computeAffiliateReliability()`, mandando la primera tanda solo a la
   mitad superior por score y una segunda tanda al resto si la primera se
   cierra entera sin aceptación (vía la próxima corrida del cron diario, sin
   necesitar un temporizador nuevo).
6. ✅ **Score de confiabilidad por afiliado — HECHO 2026-07-10.**
   `computeAffiliateReliability()` en `lib/affiliates/engine.ts` (tasa de
   respuesta, minutos promedio de respuesta, puntualidad), mostrado en
   `/admin/affiliates`. (Recorte: el auto-farm de Fase 5 NO prioriza/escalona
   por este score todavía — manda a todos a la vez; usar el score para
   priorizar queda como fast-follow.)

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

### L. Dominio personalizado — BYOD + "consíganme uno" ✅ completado 2026-07-24
Pedido del usuario: que el link final del micrositio sea el dominio propio
del cliente (`reservas.suempresa.com` en vez de `getluxeride.vercel.app/book/slug`)
Y que LuxeRide pueda cobrar por proveer el dominio a los clientes que no
tengan uno. Se construyeron ambos caminos juntos desde el inicio (decisión
explícita del usuario, no phaseado).

**Corrección de modelo de precio (mismo día, tras feedback del usuario):**
el primer diseño cobraba $15/mes por CUALQUIER conexión de dominio, incluido
BYOD. El usuario aclaró que eso no tiene sentido si el cliente ya tiene su
propio sitio/dominio pagado aparte — LuxeRide no asume ningún costo continuo
en ese caso. Los dos caminos quedaron con modelos de cobro DISTINTOS:
- **BYOD** (`custom_domain_byod`, `CUSTOM_DOMAIN_BYOD_SETUP_FEE = $29`) —
  cargo ÚNICO por conectar un dominio que el operador YA TIENE. Sin costo
  variable para LuxeRide → SÍ incluido gratis en Elite/Enterprise (mismo
  criterio que nómina/firma electrónica/promo codes). Vive en el mecanismo
  GENÉRICO de add-ons (`company_addons`, vía `resolveAddonKeyForPlanId`), con
  su propio producto de Whop (pago único).
- **Consíganme uno** — **segunda corrección, mismo día**: el primer intento
  de arreglo todavía dejaba un producto de Whop de $15/mes fijo para este
  camino, lo cual repite el MISMO problema original (el costo real de un
  dominio varía por disponibilidad, puede costar mucho más que $15). Se quitó
  por completo — **no existe ningún producto de Whop para "consíganme uno"**.
  Es 100% manual: `submitDomainRequestAction` es gratis y sin ningún gate de
  addon → el super-admin cotiza/compra el dominio real fuera del sistema →
  `resolveDomainRequestAction` lo conecta → el super-admin crea un cargo con
  el precio REAL acordado vía el sistema de cargos adicionales (sección M) —
  ahí es donde vive el precio "definido al momento de la implementación".
- Desarrollo de un sitio 100% a medida (distinto a las 4 plantillas del
  micrositio) quedó **fuera de alcance deliberadamente** — es un servicio
  manual/cotización aparte, no una feature del sistema.

Piezas construidas:
- **Migración 73** (`custom_domain`/`custom_domain_status`/`custom_domain_added_at`
  en `companies` + tabla nueva `domain_requests` con RLS solo-super_admin,
  mismo patrón que `enterprise_leads`) — **ya corrida en Supabase**.
- **`lib/billing/custom-domain-addon.ts`**: SOLO el add-on BYOD (pago único)
  — env var de Whop, precio y checker de activación.
- **`lib/vercel/domains.ts`**: wrapper delgado sobre la API de Dominios de
  Vercel (`VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID` opcional) —
  agregar/verificar/quitar un dominio del proyecto. Nota: los shapes de
  respuesta siguen la documentación pública, no se confirmaron aún contra una
  llamada real (agregar un dominio de prueba antes de depender en producción).
- **`app/actions/domains.ts`**: núcleo compartido `connectDomainToCompany()`
  usado por ambos caminos — BYOD (`addCustomDomainAction`, gateado por el
  cargo único o Elite/Enterprise) y resolución de super-admin
  (`resolveDomainRequestAction`, sin gate). `submitDomainRequestAction` SIN
  ningún gate — cualquier operador puede solicitar un dominio gratis.
- **Middleware** (`middleware.ts`): si el host de la request no es la
  plataforma (excluye cualquier `*.vercel.app`, cubre prod + previews) y el
  path es exactamente `/`, busca `companies.custom_domain` verificado y
  reescribe a `/book/<slug>` — el resto de rutas (`/track`, `/quote`, etc.)
  no cambian porque son por ID, no por slug. Consulta REST directa (fetch,
  sin supabase-js) para no cargar el cliente completo en el Edge Runtime.
- **`/admin/domain`**: columna 1 (BYOD) gateada por el cargo único o
  Elite/Enterprise; columna 2 ("consíganme uno") siempre visible y gratis de
  solicitar, sin upsell ni paywall.
- **`/super-admin/domains`**: cola de solicitudes con "Marcar como comprado"
  (el super-admin escribe el dominio real que compró manualmente — NO hay
  integración de compra, es dinero real fuera del sistema) o "Rechazar". El
  siguiente paso natural tras marcar "comprado" es crear el cargo recurrente
  en `/super-admin/companies/[id]` (sección M).
- Catálogo del marketplace: SOLO 1 item (`custom_domain_byod`, cargo único).
  Nav del admin (`/admin/domain`) visible siempre, sin gate — la página
  siempre tiene algo útil que mostrar (BYOD o la solicitud gratis).
  `AddonUpsellCard` soporta `cadence: 'once' | 'monthly'` (queda disponible
  para reusar en otros add-ons futuros, aunque ya no lo usa el camino
  "consíganme uno").

**Pendiente del usuario:** configurar env vars — Vercel: `VERCEL_API_TOKEN`,
`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (si aplica). Whop (UN SOLO producto,
BYOD únicamente): `WHOP_PLAN_ID_CUSTOM_DOMAIN_BYOD`/`WHOP_CHECKOUT_URL_CUSTOM_DOMAIN_BYOD`
(pago único ~$29). **"Consíganme uno" no necesita ningún producto de Whop.**
Antes de depender del flujo BYOD en producción, agregar un dominio de
prueba real y confirmar el shape de respuesta de Vercel.

### M. Cargos adicionales recurrentes — LuxeRide cobra al operador ✅ completado 2026-07-24
Surgió de la sección L: el servicio "consíganme un dominio" no puede tener
precio fijo ($15/mes) porque el costo real de un dominio varía mucho según
disponibilidad — cobrar de más perdería plata en dominios caros. Solución:
en vez de un plan de Whop con precio único, el super-admin configura un
**cargo manual por empresa** (etiqueta, monto real acordado, frecuencia
mensual/anual) y el sistema lo cobra automáticamente. Genérico desde el
inicio (decisión del usuario) — sirve para cualquier cargo especial futuro,
no solo dominio.

- **Arquitectura de cobro**: el operador guarda UNA vez una tarjeta con la
  cuenta PADRE de Whop de LuxeRide (`WHOP_PARENT_COMPANY_ID`) —
  `createCompanyBillingSetupCheckout()` en `lib/whop/checkout.ts`, mismo
  mecanismo de "setup checkout" que ya usan los PASAJEROS para guardar
  tarjeta con cada operador, solo que aquí es LuxeRide quien cobra
  (autorización única, confirmada por el usuario — no se pide aprobación
  por cada cobro individual).
- **Migración 74**: `companies.whop_billing_member_id`/`whop_billing_card_saved_at`
  + tabla `company_extra_charges` (la plantilla: label, amount_cents,
  frequency_months 1|12, next_charge_date, active) + tabla
  `company_extra_charge_payments` (el HISTORIAL de cada cobro individual —
  separada a propósito para poder **reversar/acreditar UN cobro puntual sin
  afectar los demás**, ej. si por error se cobró dos veces).
- **Webhook `whop-connect/route.ts`**: rama nueva en `setup_intent.succeeded`
  (distinguida por `metadata.kind === 'company_billing'`) que guarda
  `whop_billing_member_id` en `companies` en vez de `passenger_whop_members`;
  y en `payment.succeeded`/`payment.failed` una rama por
  `metadata.extra_charge_payment_id` que confirma/falla el cobro.
- **Cron `api/cron/company-extra-charges`** (diario, `0 18 * * *`): cobra
  cargos vencidos vía `client.payments.create()` contra la tarjeta guardada.
  Avanza `next_charge_date` SOLO si la llamada a Whop no lanzó error — evita
  reintentar (y cobrar dos veces) al día siguiente sobre un cobro que Whop
  ya aceptó; si falta tarjeta o la llamada falla, no avanza (reintento
  natural al día siguiente).
- **`/super-admin/companies/[id]`**: nueva tarjeta "Cargos adicionales" —
  crear/pausar/eliminar cargos + tabla de historial de cobros con botón
  "Reversar" (llama `whop.payments.refund()`, mismo método ya usado por
  `refundPaymentAction` en `app/actions/payments.ts`) por cada cobro exitoso.
- **`/admin/settings`**: nueva sección "Facturación adicional" (solo si el
  operador tiene cargos activos o ya guardó tarjeta) — solo lectura de los
  cargos + botón "Guardar método de pago" si falta.

**Pendiente del usuario:** ninguna env var nueva (reusa `WHOP_API_KEY` +
`WHOP_PARENT_COMPANY_ID` + `WHOP_CONNECT_WEBHOOK_SECRET` ya configuradas
para Whop Connect). Correr la migración 74 en Supabase (SQL abajo).

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
8. **Gaps mayores**: WhatsApp Business. Pospuesto a propósito. (farm-in/
   farm-out ya tiene diseño concreto, ver sección G más abajo; los otros 4
   gaps originales de esta lista — QuickBooks, e-signatures, promo codes,
   nómina de conductores — ya se construyeron, ver detalle abajo.)
   - ✅ **Sistema genérico de add-ons de pago — HECHO 2026-07-11.** Antes de
     construir nómina/firma/promo codes, se generalizó el patrón de la Red
     de Afiliados (`companies.affiliate_network_enabled`) en una tabla
     reusable `company_addons` (`lib/billing/addons.ts`): cada add-on nuevo
     solo necesita una fila `(company_id, addon_key, enabled, ...)` en vez de
     3 columnas booleanas repetidas en `companies`. Diferencia deliberada
     respecto al add-on de afiliados: ahí "incluido en Elite/Enterprise" es
     una convención manual (el super-admin debe recordar activarlo); aquí
     `isAddonActive()` compara el plan automáticamente, así que un upgrade a
     Elite/Enterprise activa el add-on sin tocar ningún toggle. El webhook de
     Whop (`app/api/webhooks/whop/route.ts`) y el toggle de super-admin
     (`/super-admin/companies/[id]`) ya reconocen los 3 add-ons nuevos.
     ✅ **Checkout de autoservicio activo (2026-07-11)**: el usuario ya creó
     los 3 productos en Whop, cargó las 6 env vars
     (`WHOP_PLAN_ID_PAYROLL_ADDON`/`WHOP_CHECKOUT_URL_PAYROLL_ADDON`,
     `..._ESIGNATURE_ADDON`, `..._PROMO_CODES_ADDON`) en Vercel e hizo
     redeploy — el checkout de autoservicio de los 3 add-ons ya funciona en
     producción, no queda pendiente.
   - ✅ **Códigos promocionales ($3/mes Starter/Professional, incluido en
     Elite/Enterprise) — HECHO 2026-07-11.** Motor puro
     (`lib/promo/engine.ts`, testeado) valida vigencia/límite de usos total/
     límite por cliente/monto mínimo y calcula el descuento (% o monto fijo,
     nunca negativo ni mayor al total). CRUD en `/admin/promo-codes`.
     Aplicación real en el wizard público (`booking-wizard.tsx`): el
     pasajero ve una vista previa del descuento al escribir el código
     (`validatePromoCodeAction`), pero `createPublicBookingAction` SIEMPRE
     revalida el código server-side antes de descontarlo del `total_amount`
     real — nunca confía en el descuento mostrado en el navegador. El pago
     con tarjeta (Stripe Checkout) ya cobra el monto correcto sin cambios
     porque lee `bookings.total_amount`, que ya viene descontado. Tablas
     `promo_codes` + `promo_code_redemptions` (para el límite por cliente).
   - ✅ **Nómina de conductores ($9/mes, incluido en Elite/Enterprise) — HECHO
     2026-07-11.** Alcance confirmado con el usuario: SOLO cálculo y reporte,
     nunca mueve dinero real — el operador sigue pagando por fuera (efectivo,
     transferencia) y solo marca el periodo como pagado en LuxeRide. Dos
     modelos por conductor (`drivers.payroll_type`/`payroll_rate`): comisión
     (% de cada viaje) o tarifa fija por viaje — ambos calculables directo
     desde `bookings.completed`, sin necesitar infraestructura de reloj/
     turnos que no existe hoy (por eso NO se ofrece un modelo "por hora",
     recorte consciente). UI en `/admin/payroll`: selector de periodo,
     reporte por conductor, botón "Marcar como pagado" que congela el monto
     y la cantidad de viajes exactos de ESE momento en `payroll_payments`
     (para que un cambio posterior de tarifa no altere un periodo ya
     liquidado).
   - ✅ **Firma electrónica ($9/mes, incluido en Elite/Enterprise) — HECHO
     2026-07-11.** Alcance confirmado con el usuario: acuerdo del conductor
     al unirse + contrato de cuenta corporativa (NO exención de
     responsabilidad del pasajero, quedó fuera de esta ronda). Canvas de
     firma propio en `components/admin/esignature/signature-pad.tsx`
     (mouse/touch, exporta PNG) — sin agregar una librería externa, ya que
     el equivalente de React Native (`apps/driver-mobile/components/
     SignatureModal.tsx`) no es reusable en DOM. Firma guardada en el bucket
     de Storage `documents` (mismo bucket que ya usa la firma del pasajero
     en viajes pagados en efectivo) + snapshot completo del texto del
     acuerdo en `signed_agreements.agreement_text_snapshot` (si el texto
     cambia después, lo ya firmado no se reescribe). **Nota**: el contenido
     de las plantillas (`lib/esignature/templates.ts`) es genérico, no es
     asesoría legal — mismo criterio que `/privacy` y `/terms`.
   - ✅ **QuickBooks Online — construido y validado end-to-end 2026-07-11.**
     Cada empresa conecta SU PROPIA cuenta de QuickBooks Online (mismo
     espíritu que Stripe Connect / Whop Connect, pero con OAuth2 real — QBO
     no permite crear sub-cuentas desde una key de plataforma única, así que
     sí se guarda un access_token/refresh_token por empresa en `companies`,
     a diferencia de los otros dos rieles). Sincroniza DOS cosas (alcance
     confirmado con el usuario: "ambos"): un Sales Receipt por cada reserva
     `completed` (`syncCompletedBookingsForCompany`), y una Invoice espejo de
     cada factura corporativa que ya genera el cron mensual existente
     (`syncInvoiceToQuickBooks`, conectado en
     `app/api/cron/corporate-invoices/route.ts`). Cliente e Item de servicio
     ("LuxeRide Transportation Service") se crean una sola vez por empresa y
     se cachean (`companies.quickbooks_item_id`). Dos caminos de sync: manual
     ("Sincronizar ahora" en `/admin/settings`, inmediato) + cron diario
     nuevo (`/api/cron/quickbooks-sync`) que también reintenta cualquier
     invoice que haya quedado sin sincronizar. Migración
     `20260711000047_quickbooks_integration.sql` aplicada en producción.
     **Validado en vivo por el usuario 2026-07-11**: conectó su app real
     (developer.intuit.com) contra su Sandbox Company, y "Sincronizar ahora"
     generó correctamente un Sales Receipt con el monto y pasajero exactos de
     una reserva completada de prueba — el flujo completo (OAuth, creación de
     cliente/item, Sales Receipt) queda confirmado contra una cuenta real de
     QuickBooks, no solo contra la documentación pública de la API.
     **Nota de diseño a tener en cuenta**: el matching de Customer es por
     `DisplayName` EXACTO (sensible a mayúsculas). **HECHO 2026-07-11 —
     normalización de nombres de cliente**: nueva tabla `quickbooks_customers`
     (migración `20260711000048_quickbooks_customer_cache.sql`) guarda el
     mapeo nombre normalizado → `quickbooks_customer_id` por empresa.
     `normalizeCustomerName()` (función pura, testeada en
     `lib/quickbooks/sync.test.ts`) colapsa espacios repetidos y pasa a
     minúsculas antes de buscar/crear el cliente — así "Steephany Vargas" y
     "steephany   vargas" (misma persona, distinta captura) resuelven al
     mismo Customer en QuickBooks, y de paso se evita una consulta a la API
     de QBO en cada sincronización (solo la primera vez que se ve ese
     nombre). **Alcance deliberado**: esto NO es fuzzy-matching — un error de
     tipeo real (ej. "Stephany" vs "Steephany", con una letra de más/menos)
     sigue creando dos clientes distintos, ya que no hay forma segura de
     saber si es la misma persona sin arriesgar unir a alguien equivocado.
     **Nota de mercado**: QuickBooks Online no está disponible para empresas
     registradas en República Dominicana (a diferencia de Stripe/Whop, donde
     Whop existe justamente por esa limitación de Stripe) — esta integración
     solo la pueden usar operadores con entidad en un país soportado por
     Intuit (EE.UU., Canadá, Reino Unido, Australia, etc.), coherente con el
     público objetivo del Compliance Center (sección J).
   - ⬜ **Pendiente — pasar de Development a Production en Intuit (investigado
     2026-07-11, sin construir).** Hoy la app usa credenciales de
     *Development*, que SOLO permiten conectar contra compañías Sandbox — un
     cliente real de LuxeRide no puede conectar su propia cuenta de
     QuickBooks todavía, aunque el código ya está listo. Pasos reales
     (investigados contra la documentación oficial de Intuit):
     1. En el dashboard de la app → "Keys & OAuth" → cambiar el toggle de
        Development a Production, completar "App details" (categoría, host
        domain, launch/disconnect URL, país(es)/IP(s) donde se hostea).
     2. Pestaña **Compliance**: cuestionario de auto-evaluación (~30-40 min)
        — pide URLs de política de privacidad y EULA propios de LuxeRide,
        declarar litigios/denuncias, confirmar implementación correcta de
        OAuth2 (refresh tokens, CSRF, expiración), cumplimiento de
        GDPR/CCPA/LGPD/PIPEDA si aplica, soporte 24/7 con 99.95% uptime
        esperado, y no operar desde/con países sancionados.
     3. Registrar el redirect URI de PRODUCCIÓN por separado (pestaña propia
        en "Redirect URIs", igual que ya se hizo para Development) —
        confirmado que ambos ambientes tienen listas independientes.
     4. Para uso privado (sin listar en el QuickBooks App Store, que es el
        caso de LuxeRide — cada operador conecta su cuenta directamente, no
        hay un marketplace público), la aprobación suele tardar días, no
        semanas. Si más adelante se quisiera *listar* la app en el App Store
        (descubribilidad pública), hay una revisión técnica formal aparte de
        ~20 días, más una revisión de seguridad anual recurrente para
        cualquier app en producción.
     5. **Costo**: el tier gratuito "Builder" del Intuit App Partner Program
        se asigna automático, sin costo — incluye llamadas ilimitadas a Core
        API y hasta 500,000 créditos CorePlus API/mes, más que suficiente
        para el volumen esperado. Los tiers pagos (Silver $300/mes en
        adelante) solo hacen falta con mucho más volumen o beneficios de
        marketplace.
     6. **Rate limits** (iguales en Sandbox y Production, tenerlos en cuenta
        para el cron de sync): 500 requests/min por compañía conectada, máx.
        10 concurrentes por app, 200 requests/min en endpoints pesados —
        HTTP 429 si se exceden. El volumen actual (un sync diario + manual
        por empresa) está muy por debajo de estos límites.
     Fuentes: developer.intuit.com/app/developer/qbo/docs/go-live/publish-app
     (platform-requirements, technical-requirements), help.developer.intuit.com
     (production-keys, New-app-assessment-process-FAQ, API-call-limits-and-
     throttling, platform-service-fees).
   - ✅ **Detección de conflictos de vehículo — HECHO 2026-07-11.** Antes solo
     se evitaba que un mismo CONDUCTOR quedara en dos viajes que se solapan
     (`windowFor`/`overlaps` en `lib/dispatch/auto-assign.ts`); el VEHÍCULO
     que trae asignado el conductor se copiaba sin validar. Ahora se aplica
     el mismo chequeo de horario también por `vehicle_id`, en dos puntos:
     `tryAutoAssignDriver` (excluye del reparto automático a cualquier
     candidato cuyo vehículo actual ya esté comprometido en otro viaje activo
     que se solape — cubre el caso de dos conductores de turnos distintos que
     comparten el mismo carro) y `assignDriverAction` (asignación/reasignación
     manual desde el Dispatch Board: si el vehículo efectivo — explícito o el
     `current_vehicle_id` del conductor — ya está en otra reserva
     `assigned`/`en_route`/`arrived`/`in_progress` que se solapa, devuelve el
     error "Vehículo ya asignado a la reserva [núm.] en un horario que se
     solapa" en vez de permitir el doble-booking). `windowFor`/`overlaps` se
     exportaron de `auto-assign.ts` para reusarlos en ambos archivos, con test
     nuevo (`lib/dispatch/auto-assign.test.ts`, 4 casos). No hizo falta
     migración — usa columnas ya existentes (`vehicle_id`, `scheduled_at`,
     `duration_minutes`, `status`). Nota: hoy ninguna UI deja elegir un
     vehículo distinto al del conductor (el parámetro `vehicleId` de
     `assignDriverAction` existe pero no lo usa ningún componente todavía),
     así que el caso de uso principal cubierto es el de flota compartida
     entre turnos, no un selector manual de vehículo en pantalla.
   - ✅ **Asistente de IA por micrositio (add-on nuevo, 2026-07-11) — código
     completo, falta configuración externa del usuario.** Origen: el usuario
     vio un competidor (suncitilimo.com) con un chat de Botpress y preguntó si
     era viable ofrecer algo así. Se investigó el costo real: Botpress cobra
     $0.50-0.65 por conversación (y otras plataformas similares o peores —
     Chatbase, Voiceflow, Tidio — todas revenden con margen alto), mientras
     que construirlo directo sobre GPT-4o-mini cuesta fracciones de centavo
     por conversación. Decisión: LuxeRide lo construye y captura ese margen en
     vez de pagárselo a un tercero.
     - **Aislamiento por empresa — arquitectónico, no por instrucción.** El
       riesgo que preguntó el usuario ("¿cómo evitamos que el bot hable de
       otra empresa o se salga de tema?") se resuelve en dos capas: (1) el
       bot de la empresa A NUNCA recibe datos de la empresa B en su contexto
       — `lib/ai-chat/context.ts` solo consulta `service_zones`,
       `vehicle_types`, `pricing_rules`, `company_services` y la política de
       cancelación de ESA `company_id`, mismo aislamiento que ya usa el resto
       de la plataforma; (2) el system prompt además rechaza explícitamente
       temas ajenos, otras empresas, e intentos de "ignora tus instrucciones".
     - **Dos tiers, deliberadamente NO incluidos gratis en Elite/Enterprise**
       (a diferencia de nómina/firma/promo codes) porque este add-on sí tiene
       costo variable real por uso: **Básico $15/mes (400 conversaciones)** y
       **Plus $29/mes (1,000 conversaciones)**, ancorados a duplicar lo que
       da gratis/barato la competencia más económica (Botpress: 250 conv. a
       $150/mes). Excedente: $5 por cada 100 conversaciones extra — hoy es
       SOLO informativo (el operador ve su consumo del mes en
       `/admin/assistant`), no bloquea al visitante ni factura
       automáticamente; facturar el excedente real queda pendiente de decidir
       cómo (Whop no tiene un modelo simple de metered billing confirmado).
     - Tablas nuevas `ai_chat_conversations`/`ai_chat_messages` (migración
       `20260711000050_ai_chat_addon.sql`, con RLS — ✅ **aplicada en
       producción 2026-07-11**, ejecutada por el usuario en el SQL Editor de
       Supabase). Estado del add-on vive en la
       tabla genérica `company_addons` ya existente (`addon_key`
       `ai_chat_basic`/`ai_chat_plus`), reusando el mismo webhook de Whop y el
       mismo toggle manual de super-admin que los otros add-ons — sin tocar
       ese código, solo se amplió `resolveAddonKeyForPlanId()` para reconocer
       los dos plan_id nuevos.
     - Widget flotante (`components/booking/ai-chat-widget.tsx`) insertado
       una sola vez en `book/[slug]/page.tsx` (cubre las 4 plantillas),
       visible solo si la empresa tiene el add-on activo. Modelo fijo
       `gpt-4o-mini` (no configurable por el operador — es la base del margen
       calculado).
     - ✅ **Whop configurado (2026-07-11)**: 2 productos creados, plan ID +
       checkout URL cargados en Vercel — `WHOP_PLAN_ID_AI_CHAT_BASIC_ADDON`
       (`plan_naWKpgQNH7Rdy`), `WHOP_CHECKOUT_URL_AI_CHAT_BASIC_ADDON`
       (`https://whop.com/jprs-digital-connect/ai-assistant-basic/`),
       `WHOP_PLAN_ID_AI_CHAT_PLUS_ADDON` (`plan_pjCyRE8gNmoej`),
       `WHOP_CHECKOUT_URL_AI_CHAT_PLUS_ADDON`
       (`https://whop.com/jprs-digital-connect/ai-assistant-plus/`). El
       checkout de autoservicio de `/admin/assistant` ya debería mostrar
       ambos botones reales tras el redeploy de Vercel.
     - ⬜ **Pendiente a propósito — `OPENAI_API_KEY`.** Decisión explícita del
       usuario (2026-07-11): NO crearla todavía, se hará cuando haya un primer
       cliente real interesado en el add-on (para no pagar por una key sin
       uso). Sin esta variable, `isOpenAiConfigured()` es `false` y
       `sendChatWidgetMessageAction` devuelve un error controlado ("El
       asistente no está disponible en este momento") en vez de fallar mal —
       aunque alguien active el add-on por Whop antes de tener la key, el
       widget no rompe, solo muestra ese mensaje. Retomar este punto cuando el
       usuario avise que ya tiene el primer cliente.
     - **No verificado visualmente en navegador** (sin credenciales de login
       en este entorno, y ninguna empresa tiene aún el add-on activo para
       probar el widget en vivo) — sí se verificó: typecheck limpio, build de
       producción exitoso, 134 tests pasando.
   - ⬜ **PENDIENTE DE CONSTRUIR — AI Growth Assistant (add-on nuevo, decidido
     2026-07-11).** Tras el asistente de chat, el usuario pidió explorar más
     ideas de IA/automatización para diferenciar vs. Limo Anywhere/Moovs (ver
     `docs/COMPETITIVE-ANALYSIS.md` línea 57: Moovs ya vende "AI scheduler"/
     "AI contact center" en Enterprise). Se evaluaron 4 candidatas (seguimiento
     de cotizaciones con IA, reservas telefónicas por voz, generador de
     contenido de marketing, copy de SEO local) — el usuario decidió empaquetar
     LAS DOS MÁS BARATAS en un solo add-on, con precio de bundle más atractivo
     que verlas sueltas:
     - **Seguimiento de cotizaciones con IA**: reemplaza el email genérico del
       cron `quote-followup` existente por uno redactado por IA (contexto:
       vehículo, precio, fecha). No requiere ninguna API nueva — reusa
       `lib/ai-chat/openai.ts` (GPT-4o-mini) + Resend, ambos ya integrados.
     - **Generador de contenido de marketing (solo texto)**: el operador pide
       un post para Instagram/Google Business y recibe el texto listo para
       copiar/pegar, generado con el mismo contexto por empresa que ya
       construimos para el chat (`lib/ai-chat/context.ts`, reusable tal cual).
       Deliberadamente SIN auto-publicar (eso requeriría aprobación de la API
       de Google Business Profile y de Meta Graph por cada operador — mucho
       más esfuerzo, se descarta por ahora).
     - **Unidad de medida combinada**: "generaciones de IA al mes" (cuenta
       tanto los seguimientos automáticos como los posts a pedido).
     - **Precio propuesto y confirmado por el usuario**: Básico $9/mes (150
       generaciones), Plus $19/mes (500 generaciones), excedente $3 por cada
       50 extra. Más barato que el AI Chat Assistant ($15/$29) porque cada
       generación es una respuesta única, no una conversación completa.
     - **Descartado deliberadamente**: copy de SEO local para el micrositio —
       aunque es la más barata de construir, el usuario señaló (correctamente)
       que es la más difícil de justificarle al cliente: no hay forma de
       mostrar una métrica clara de efectividad (no hay Search Console por
       operador, todos comparten el dominio de LuxeRide bajo `/book/<slug>`).
     - ✅ **CONSTRUIDO 2026-07-11.** `lib/billing/ai-growth-addon.ts` (mismo
       patrón que `ai-chat-addon.ts` — tiers separados de `ADDON_KEYS`, nunca
       gratis en Elite/Enterprise por el costo variable real). Tabla
       `ai_growth_generations` (migración `20260711000052_ai_growth_addon.sql`
       — ✅ **aplicada en producción 2026-07-11** por el usuario en el SQL
       Editor de Supabase). Seguimiento de cotizaciones con IA integrado
       directo en el cron existente (`app/api/cron/quote-followup/route.ts`):
       si la empresa tiene el add-on activo, redacta el email con
       GPT-4o-mini; si falla o no está activo, cae al texto genérico de
       siempre — nunca bloquea el envío del recordatorio. Generador de
       contenido bajo demanda en `/admin/growth-assistant`
       (`lib/ai-growth/context.ts` para el prompt de marketing, contexto más
       liviano que el del chat — solo nombre/ciudad/tagline/servicios/flota,
       no necesita zonas/tarifas). Toggle manual de super-admin agregado en
       `/super-admin/companies/[id]` igual que el AI Chat Assistant.
       ✅ **Whop configurado (2026-07-11)**: 2 productos creados, plan ID +
       checkout URL cargados en Vercel — `WHOP_PLAN_ID_AI_GROWTH_BASIC_ADDON`
       (`plan_XpOBZZus8DeuK`), `WHOP_CHECKOUT_URL_AI_GROWTH_BASIC_ADDON`
       (`https://whop.com/jprs-digital-connect/ai-growth-assistant-basic/`),
       `WHOP_PLAN_ID_AI_GROWTH_PLUS_ADDON` (`plan_lAJ3Y6Pr9jeGM`),
       `WHOP_CHECKOUT_URL_AI_GROWTH_PLUS_ADDON`
       (`https://whop.com/jprs-digital-connect/ai-growth-assistant-plus/`).
       El checkout de autoservicio de `/admin/growth-assistant` ya debería
       mostrar ambos botones reales tras el redeploy de Vercel. **Único
       pendiente real**: `OPENAI_API_KEY` — reusa la misma que ya está
       pendiente a propósito para el AI Chat Assistant, se crea cuando el
       usuario avise que ya tiene el primer cliente de cualquiera de los dos
       asistentes de IA. Hasta entonces, si alguien activa el add-on por
       Whop, el widget/generador responde con un error controlado en vez de
       fallar mal (mismo comportamiento ya verificado en el AI Chat
       Assistant).
   - ⬜ **EN EVALUACIÓN — dos ideas nuevas del usuario (2026-07-11), no
     construidas todavía, solo revisadas y con opinión registrada**:
     1. **Partner Portals** (hoteles, FBOs, wedding/event planners, clínicas,
        universidades): portal privado co-brandeado por partner
        (`luxeride.app/partners/<slug>`) con tarifas especiales, comisión para
        el partner, reporte por partner, y facturación separada. Evaluación:
        es una idea genuinamente nueva y de alto valor (canal B2B de
        referidos, patrón real en la industria — conserjes de hotel refieren
        traslados a una limusina de confianza a cambio de comisión), y NO está
        cubierta por lo ya construido: Cuentas Corporativas (`corporate_accounts`)
        cubre la facturación/tarifas especiales pero no paga comisión al
        partner ni tiene link/branding privado propio; la Red de Afiliados
        (`affiliate_trips`, capability-URL de `affiliate_invite_tokens`) es
        entre operadores LuxeRide (empresas con flota propia), no con un
        socio no-operador (un hotel no tiene choferes ni vehículos). Sí es
        construible reusando patrones ya probados: el link privado con el
        mismo patrón capability-URL del portal de afiliado externo, y el
        pago de comisión con el mismo enfoque "solo cálculo/reporte, el
        operador paga por fuera" que ya usa Nómina de conductores (evita
        prometer un split de pago automático que no existe). Prioridad alta,
        de acuerdo con el usuario.
     2. **Chauffeur Quality System** (score del chofer, checklist pre-viaje,
        VIP brief, incident log, chofer preferido, recordatorios de
        entrenamiento, resumen de ganancias): evaluación mixta — varias partes
        YA EXISTEN en piezas sueltas y solo faltaría consolidarlas: puntualidad
        y cancelación/no-show ya se calculan dinámicamente en
        `/admin/drivers/[id]` (falta solo la tasa de aceptación, calculable
        desde los eventos `rejected_by_driver` de `booking_events`, y un
        "score" único que combine todo); el incident log YA EXISTE
        (`trip_reports` + `booking_events`); el resumen de ganancias YA EXISTE
        vía el add-on de Nómina (falta solo exponerlo al conductor, no solo al
        operador). Lo genuinamente nuevo es: checklist pre-viaje, VIP brief
        (notas del cliente antes del viaje), chofer preferido (requiere tocar
        `auto-assign.ts`), y recordatorios de entrenamiento. Sigue teniendo
        valor real (mejora la experiencia premium, retiene choferes buenos),
        pero es más una iniciativa de "consolidar + completar" que un módulo
        nuevo desde cero — menor riesgo arquitectónico que Partner Portals,
        pero también menor novedad. Prioridad alta, de acuerdo con el usuario,
        aunque por debajo de Partner Portals en impacto/diferenciación.
     3. **LuxeRide Operator Score** (score general 0-100 de la operación, 8
        áreas: Revenue Health, Dispatch Efficiency, Chauffeur Quality,
        Compliance Readiness, Customer Experience, Growth Performance,
        Corporate Account Strength, Affiliate Reliability + recomendación en
        lenguaje natural tipo "sube a 82/100 si..."). Evaluación: la de MEJOR
        relación esfuerzo/valor de las tres — 5 de las 8 áreas ya existen o
        casi existen (Compliance Readiness = `lib/compliance/engine.ts` casi
        1:1; Affiliate Reliability = `computeAffiliateReliability()` casi 1:1;
        Chauffeur Quality reusa lo ya calculado en `/admin/drivers/[id]`;
        Dispatch Efficiency y Customer Experience solo faltan la fórmula que
        combine datos que ya existen). Lo único genuinamente nuevo es "Growth
        Performance" (conversión cotización→reserva, tendencia mes a mes — no
        se calcula hoy en ningún lado). El párrafo de recomendación reusaría
        por TERCERA vez el mismo motor de IA (GPT-4o-mini + contexto por
        empresa) construido para el chat/growth assistant. **Recomendación de
        posicionamiento**: NO como add-on de pago aparte (a diferencia del
        chat/growth assistant) — como esta feature usa sobre todo datos que ya
        son de Elite/Enterprise, tiene más sentido como el gancho de upgrade
        de Starter/Professional a Elite ("desbloquea tu Operator Score") que
        como algo a cobrar por separado; el costo de IA aquí es mínimo
        (un párrafo por refresco semanal/mensual, no por conversación).
        **Plan de lanzamiento confirmado por el usuario (2026-07-11)**:
        construir primero la versión SOLO con los 8 números (pura matemática,
        sin dependencia de `OPENAI_API_KEY`, lanzable ya) y agregar el párrafo
        de recomendación en lenguaje natural DESPUÉS, cuando exista la
        `OPENAI_API_KEY` (la misma que se dejó pendiente a propósito para el
        asistente de chat — ver ítem del add-on de IA más abajo). No bloquear
        el lanzamiento del score esperando la key.
        - ✅ **FASE 1 CONSTRUIDA 2026-07-11 (solo números, sin narrativa de
          IA)**: `lib/operator-score/engine.ts` (8 funciones puras, testeadas
          — 22 tests) + `lib/operator-score/gather.ts` (glue de DB, ventana
          de 30 días vs. los 30 anteriores). Reuso confirmado: Compliance
          Readiness lee directo `companies.compliance_score` (ya lo mantiene
          `lib/compliance/recompute.ts`, cero cálculo nuevo); Affiliate
          Reliability reusa `computeAffiliateReliability()` tal cual sobre
          `affiliate_trips` donde esta empresa es `affiliate_company_id`
          (cómo de confiable es ESTA empresa como afiliada de otras, no al
          revés). Un área sin datos (`null`) nunca cuenta en el promedio
          general — un operador sin red de afiliados o sin cuentas
          corporativas no se ve penalizado por eso. UI en
          `/admin/operator-score` (nav bajo "Overview", ícono `Gauge`): score
          general grande + 8 tarjetas. Sin migración nueva — 100% aditivo
          sobre datos existentes, deployado directo a producción sin ninguna
          advertencia de orden (a diferencia de Partner Portals). Pendiente
          (fase 2, cuando exista `OPENAI_API_KEY`): el párrafo de
          recomendación en lenguaje natural.
     - **Ranking final del usuario tras revisar las 3 (2026-07-11)**: 1)
       Operator Score primero (más barato de construir, mejor gancho de venta,
       ayuda operativa real al cliente); 2) Partner Portals segundo (la que
       más valor NUEVO crea — comisiones son dinero extra real para el
       operador, no solo eficiencia); 3) Chauffeur Quality System NO como
       lanzamiento propio, sino como pieza que se completa en el camino y
       alimenta directamente el área "Chauffeur Quality" del Operator Score
       y la reputación de cara a los Partner Portals. Ninguna de las 3
       construida todavía — quedan documentadas para cuando el usuario pida
       avanzar con alguna.
   - ✅ **Partner Portals — CONSTRUIDO 2026-07-11.** Incluido en el plan
     (Professional+), sin cobro aparte (decisión del usuario, no pasa por
     company_addons/Whop). Tabla `partners` (`company_id, name, slug,
     logo_url, contacto, rate_adjustment_pct, commission_type/value,
     is_active`) + `partner_payments` (mismo patrón "solo cálculo/reporte,
     nunca mueve dinero real" que Nómina de conductores — al marcar un
     periodo como pagado se congela el monto/viajes exactos de ESE momento).
     `bookings.partner_id` (nullable) etiqueta qué partner refirió cada
     reserva — deliberadamente separada de `corporate_account_id` (semántica
     distinta: facturación B2B vs. referido con comisión).
     - **Link privado**: `/book/<slug>/partners/<partner-slug>` (nueva
       sub-ruta, mismo patrón que `/reservar`), con banner de co-marca
       (logo/nombre del partner) y el mismo `BookingWizard` de siempre.
     - **Tarifa especial**: `rate_adjustment_pct` (-50% a +50%,
       `lib/partners/engine.ts::applyPartnerRateAdjustment`, testeado) se
       hornea directo en el `total_amount` de `price_quotes` al cotizar
       desde el link del partner — todo lo que viene después
       (`createPublicBookingAction`) simplemente lee ese total, sin lógica
       de partners esparcida. Deliberadamente NO se tocó `bestRule()`/
       `pricing_rules` (más riesgoso, afecta a TODAS las reservas) — se
       eligió el mismo mecanismo ya probado de descuento de códigos
       promocionales, aplicado por canal en vez de por código.
     - **Comisión**: `computePartnerCommission()` (testeado), reporte por
       periodo + botón "Marcar como pagado" en `/admin/partners/[id]`,
       idéntico en espíritu a `/admin/payroll`.
     - **Admin**: `/admin/partners` (alta + lista + link copiable + toggle
       activo) y `/admin/partners/[id]` (edición + reporte de comisión).
       Nueva entrada en el sidebar (ícono `Store`, sección Management).
     - **⚠️ ADVERTENCIA DE ORDEN DE DESPLIEGUE — distinta a los add-ons
       anteriores.** `createPublicBookingAction` ahora SIEMPRE inserta la
       columna `bookings.partner_id` (con valor `null` si la reserva no vino
       de un partner) — a diferencia del asistente de IA (donde el código
       nuevo solo se activa si alguien prende el add-on), esto significa que
       **si se hace push a `main` (producción) ANTES de aplicar la migración
       51, se rompe la creación de CUALQUIER reserva pública** (Postgrest
       rechaza el insert por columna inexistente en el schema cache). Por
       esto, a diferencia del flujo normal de "push a develop → push a main
       automático", **este código SOLO se subió a `develop`** — falta
       aplicar la migración `20260711000051_partner_portals.sql` en
       producción (pendiente de que el usuario la corra, mismo proceso que
       la migración 50) antes de autorizar el push a `main`.
     - Verificado: typecheck limpio, build de producción exitoso, 142 tests
       pasando (8 nuevos de `lib/partners/engine.test.ts`). No verificado
       visualmente en navegador (sin credenciales de login en este entorno).
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

## Programa de referidos entre empresas (2026-07-16, primer paso)

  - Comisión escalonada por cantidad de referidos activos, congelada al
    momento exacto de cada referido individual y con vencimiento a los 12
    meses de actividad de la empresa referida. Pago real pensado vía Whop
    (affiliate + override `rev_share`), pero eso NO está construido todavía —
    solo se diseñó la arquitectura (ver conversación: crear afiliado/override
    en Whop al momento del referido, LuxeRide lleva su propio reloj de 12
    meses porque Whop no lo soporta nativamente, y el corte selectivo de un
    referido puntual a los 12 meses sin afectar a los demás del mismo
    referrer sigue sin confirmar en la API de Whop — punto pendiente de
    validar antes de automatizar esa parte).
  - Niveles (ajustados a pedido del usuario): Iniciado 1-3 referidos (5%),
    Socio 4-6 (8%), Aliado 7-11 (12%), Embajador 12+ (15%).
  - Construido en este paso: migración `company_referrals` (quién refirió a
    quién, % y nivel congelados, `expires_at` a 12 meses, columnas
    `whop_affiliate_id`/`whop_override_id` nulas para cuando se conecte Whop),
    `lib/referrals/tiers.ts` (niveles puros, testeable), y una tarjeta de
    nivel en el sidebar admin (bajo el rol, solo visible para
    `company_owner`, oculta en modo colapsado) que muestra el nivel actual +
    conteo de referidos activos.
  - Migración `20260716000054_referral_program.sql` aplicada y verificada en
    producción (tabla existe, CHECK de `tier_key` confirmado activo).

  **Segundo paso (mismo día)** — flujo de atribución real, ya construido y
  verificado end-to-end en local (signup completo a través del link,
  atribución correcta en `company_referrals`, página `/admin/referrals`
  mostrando el nivel + tabla):
  - `/r/[code]` (route handler): `code` = el `slug` de la empresa referente
    (se reutiliza, no se agregó columna nueva). Guarda una cookie `lr_ref`
    (30 días, httpOnly) y redirige a `/auth/signup` — con `new URL(path,
    request.url)`, NO con `getAppUrl()`, para no forzar el redirect a la URL
    pública configurada (bug real que se encontró y corrigió durante la
    verificación: con `getAppUrl()` el redirect saltaba a producción incluso
    probando en local).
  - `signupAction` (`app/actions/auth.ts`) lee la cookie `lr_ref` al crear la
    empresa nueva, calcula el nivel vigente del referrer en ESE momento
    (conteo de referidos activos + 1) y crea la fila en `company_referrals`
    con el % y nivel ya congelados. Best-effort — nunca bloquea el signup.
  - `/admin/referrals` (nueva página, solo `company_owner`, con entrada en
    el sidebar): muestra el link propio para compartir (con botón copiar),
    el nivel actual + cuánto falta para el siguiente, y la tabla de
    empresas referidas con su % congelado y fecha de vencimiento.
  - Cron `expire-referrals` (`app/api/cron/expire-referrals`, 4pm UTC en
    `vercel.json`): la expiración en sí ya la respetan las queries de
    conteo (siempre filtran `expires_at > now()`), así que este cron NO
    apaga nada — solo manda un email diario al super-admin listando los
    referidos que cumplieron 12 meses, porque la automatización con Whop
    (desactivar la comisión real en su dashboard) sigue sin construir.
  - **Sigue pendiente, sin construir**: la integración real con la API de
    Whop (crear `affiliate`/`override` cuando se confirma un referido, y
    sobre todo resolver la duda de cómo cortar selectivamente la comisión
    de UN referido puntual a los 12 meses sin afectar a los demás del mismo
    referrer — no confirmado en la documentación de Whop). Hasta que eso
    exista, el programa registra y muestra todo correctamente pero no paga
    comisión real todavía; el cron de arriba es el mecanismo puente
    (aviso manual) mientras tanto.

## Datos operativos

- Deploy: push a develop → preview (requiere login de Vercel salvo que se
  desactive Deployment Protection); push a main → PRODUCCIÓN
  (https://getluxeride.vercel.app, pública). Para promover: merge develop→main.
- Migraciones: SQL Editor de Supabase (proyecto iwjtjwryhtpzuvwmlpjk) o
  `supabase db push`.
- Flujo de solicitudes: signup del landing crea empresa en `trial` →
  aparece en /super-admin/subscriptions → Aprobar la activa con 1 mes.
- Tests: `npm test` (raíz). Build: `npx next build` en apps/web.
