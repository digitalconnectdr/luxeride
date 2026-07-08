# Análisis competitivo — LuxeRide vs Limo Anywhere vs Moovs

> Investigado el 2026-06-11 desde limoanywhere.com y moovsapp.com.
> Insumo para roadmap de producto y posicionamiento de ventas.

## Pricing de la competencia (referencia)

| | Limo Anywhere | Moovs |
|---|---|---|
| Entrada | Core $99/mes + $0.25/viaje + setup $299 | Free (10 viajes) / Standard $149/mes + setup $299 |
| Medio | Plus $249/mes + $0.20/viaje + setup $599 | Pro $199/mes + setup $299 |
| Alto | Black $549/mes + setup $899 | Enterprise desde $999/mes |
| Cargo por viaje | SÍ (todos los planes) | NO (su gran argumento de venta) |
| Passenger App | $199 + $99/mes (incluida solo en Black) | $499/mes + $1,000 setup |

**Posicionamiento LuxeRide (actualizado 2026-07-08, Sección K):** sin setup fee
(ninguno de los dos lo ofrece), trilingüe (ninguno lo es). El cargo por viaje
propio pasó de "no cobramos" a un % del valor del viaje que BAJA con el plan
(3% Starter → 1.5% Professional → 0.5% Elite → a medida en Enterprise) — a
diferencia del fee FIJO de LA ($0.20-0.25/viaje sin importar la tarifa), en
tarifas de lujo altas ($150-300+) nuestro % puede salir más caro por viaje que
el fijo de LA. El argumento de venta ya no es "más barato por viaje" sino
"casi todo lo que LA/Moovs cobran como add-on (cuentas corporativas, policy
engine, dispatch en tiempo real) ya viene incluido en el plan, sin fees
adicionales por feature" — y que el fee baja a medida que el operador crece,
alineando el costo de LuxeRide con su propio volumen de negocio.

## Funciones que ELLOS tienen y LuxeRide aún NO

### Alto impacto (candidatas al roadmap inmediato)
1. **Flight tracking automático** (ambos; Moovs usa FlightAware) — ajustar pickup
   según retrasos del vuelo. LuxeRide ya captura `flight_number`; falta integrar
   una API (FlightAware / AeroDataBox).
2. **Farm-in / Farm-out (red de afiliados)** (ambos; LA Net cobra $0.25–0.75/viaje,
   Moovs vía GNET) — pasar viajes entre operadores. Network effect fuerte.
3. **Apps móviles nativas** (ambos) — LuxeRide tiene web responsive + driver web;
   Phase 2 ya contempla React Native.
4. **Cotizaciones como pipeline de ventas** (Moovs: quote → follow-up automático
   → booking) — LuxeRide crea `price_quotes` pero no tiene UI de seguimiento ni
   follow-ups automáticos de cotizaciones abandonadas.
5. **Website builder / booking widget embebible** (ambos) — un `<iframe>`/script
   del wizard para incrustar en el sitio del operador sería barato de construir.

### Impacto medio
6. **QuickBooks integration** (ambos, en planes altos).
7. **E-signatures / contratos** (Moovs Standard; LA Plus).
8. **Multi-stop / waypoints en el booking** (Moovs) — el schema ya tiene
   `waypoints JSONB[]`; falta exponerlo en wizard y pricing.
9. **Driver payables / nómina de conductores** (Moovs; LA Black vía ADP) —
   `drivers.total_earnings` existe; falta el módulo de liquidación.
10. **Detección de conflictos de vehículo** (Moovs Pro) — evitar doble asignación
    del mismo vehículo en horarios solapados.
11. **Promo codes** (Moovs).
12. **Encuestas y reviews post-viaje** (ambos) — `bookings.rating` ya existe;
    falta el email post-viaje con link de calificación.
13. **Shuttle/rutas con ticketing** (ambos lo venden como add-on caro).
14. **AI add-ons** (Moovs Enterprise: AI scheduler, AI contact center).

## Donde LuxeRide YA es más fuerte (explotar en ventas)

1. **Trilingüe EN/ES/PT de fábrica** — ninguno de los dos lo ofrece. El mercado
   de operadores latinos en EE.UU. (Miami, NY/NJ, Houston, LA, Orlando) está
   desatendido; Brasil/Portugal abre con PT.
2. **Sin setup fee y sin cargo por viaje** — LA cobra ambos; Moovs cobra setup.
3. **Multi-tenant real con Stripe Connect** — plataforma con split de pagos y
   platform fee automático; LA/Moovs son single-tenant por cuenta.
4. **Cuentas corporativas con facturación automática** incluidas en el plan
   medio (LA lo fragmenta en add-ons; Moovs lo reserva a Enterprise).
5. **Policy engine** (cancelación/no-show con fees automáticos por hora local).
6. **Tracking público sin app** — Moovs cobra la passenger app a $499/mes;
   LuxeRide da tracking web elegante gratis.
7. **Pagos manuales conciliados** (cash/Zelle/transferencia) — flujo real de
   operadores pequeños que ambos competidores ignoran.
8. **Precio agresivo**: Starter $99 sin setup vs Core $99 + $0.25/viaje + $299.

## Oportunidades que NINGUNO explota
- **Mercado bilingüe/trilingüe** (arriba) — el diferenciador #1.
- **WhatsApp como canal de notificaciones** (vía Twilio) — los operadores
  latinos viven en WhatsApp; ni LA ni Moovs lo ofrecen nativo.
- **Onboarding self-service real** — ambos dependen de demos con ventas;
  LuxeRide puede activarse solo (signup → seed de tarifas → link de reservas).
- **Transparencia de precios total** en el landing (Moovs esconde el pricing
  detrás de "book a demo" en la home).
