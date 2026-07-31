'use client'
// ── Booking Wizard — Portal público, 4 pasos ──────────────────────────────────
// Paso 1: Ruta y fecha
// Paso 2: Selección de vehículo (con precios calculados server-side)
// Paso 3: Datos del pasajero
// Paso 4: Confirmación + creación

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AddressInput } from '@/components/maps/address-input'
import {
  getPublicVehicleQuotesAction,
  createPublicBookingAction,
  lookupReturningPassengerAction,
  type VehicleQuote,
  type BookingResult,
} from '@/app/actions/bookings'
import { validatePromoCodeAction } from '@/app/actions/promo-codes'
import {
  createPublicCheckoutAction,
  getSavedWhopCardAction,
  chargeWithSavedWhopCardAction,
  type SavedWhopCard,
} from '@/app/actions/payments'
import type { BookingType } from '@/lib/supabase/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { ConversionTracker } from '@/components/booking/conversion-tracker'

type WizardDict = Dictionary['wizard']

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Company {
  id: string
  name: string
  slug: string
  currency: string
  primaryColor: string
  phone: string | null
  email: string | null
}

interface VehicleTypeInfo {
  id: string
  name: string
  class: string
  capacity: number
  amenities: string[]
  imageUrl: string | null
  luggageCarryOnCapacity: number
  luggageCheckedCapacity: number
  luggageExtraLargeCapacity: number
}

interface GratuityConfig {
  enabled: boolean
  options: number[]
  defaultPct: number
}

interface Props {
  company: Company
  vehicleTypes: VehicleTypeInfo[]
  onlinePaymentsEnabled?: boolean
  gratuity?: GratuityConfig
  dict: WizardDict
  localeTag: string
  /** Partner Portals — cuando la reserva viene del link privado de un partner. */
  partnerSlug?: string
  /** Google Ads: GA4 Measurement ID propio del operador (companies.settings.tracking). */
  gaMeasurementId?: string
}

// ─── Progreso ────────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-start mb-6">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex-1 flex flex-col items-center relative min-w-0">
            {/* Línea de progreso hacia el siguiente paso */}
            {i < steps.length - 1 && (
              <div className="absolute top-[17px] left-1/2 w-full h-[3px] rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: done ? '100%' : '0%', backgroundColor: 'var(--brand)' }}
                />
              </div>
            )}
            {/* Círculo del paso */}
            <div
              className={`relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                done || active ? 'text-white' : 'text-gray-400 bg-gray-100 border border-gray-200'
              }`}
              style={
                done || active
                  ? {
                      backgroundColor: 'var(--brand)',
                      boxShadow: active ? '0 0 0 4px color-mix(in srgb, var(--brand) 20%, transparent)' : 'none',
                    }
                  : undefined
              }
            >
              {done ? '✓' : i + 1}
            </div>
            {/* Etiqueta */}
            <p className={`mt-2.5 text-xs font-medium text-center px-1 leading-tight ${active ? 'text-[#1d1d1f]' : done ? 'text-gray-500' : 'text-gray-400'}`}>
              {label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Clases de vehículo ───────────────────────────────────────────────────────

const CLASS_ICONS: Record<string, string> = {
  sedan: '🚗', suv: '🚙', van: '🚐', limousine: '🚘', sprinter: '🚌', bus: '🚌', exotic: '🏎️',
}

// Tope fijo de equipaje "extra" cobrable por categoría más allá de la
// capacidad incluida del vehículo — debe coincidir con
// MAX_LUGGAGE_EXTRA_PER_CATEGORY en app/actions/bookings.ts (el server es
// quien realmente lo hace cumplir; este límite en la UI solo evita que el
// pasajero declare algo que de todos modos se va a recortar).
const MAX_LUGGAGE_EXTRA_PER_CATEGORY = 1

// ─── Componente principal ─────────────────────────────────────────────────────

export function BookingWizard({ company, vehicleTypes, onlinePaymentsEnabled = false, gratuity, dict, localeTag, partnerSlug, gaMeasurementId }: Props) {
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [gratuityPct, setGratuityPct] = useState(0)

  // Estado del wizard
  const [routeData, setRouteData] = useState({
    pickupAddress: '', pickupLat: 0, pickupLng: 0,
    dropoffAddress: '', dropoffLat: 0, dropoffLng: 0,
    scheduledAt: '', bookingType: 'one_way' as BookingType,
    requestedHours: undefined as number | undefined,
    stops: [] as { address: string; lat: number; lng: number }[],
  })
  // Multi-stop: cantidad de inputs de parada visibles (máx. 3)
  const [stopCount, setStopCount] = useState(0)
  // Controla el select de tipo de servicio para mostrar "Horas solicitadas"
  // solo cuando el tipo es 'hourly' (ver lib/pricing/engine.ts).
  const [bookingTypeSel, setBookingTypeSel] = useState<BookingType>('one_way')
  const [vehicleQuotes, setVehicleQuotes] = useState<VehicleQuote[]>([])
  const [selectedQuote, setSelectedQuote] = useState<VehicleQuote | null>(null)
  const [passengerData, setPassengerData] = useState({
    name: '', phone: '', email: '', count: 1,
    luggageCarryOn: 0, luggageChecked: 0, luggageExtraLarge: 0,
    instructions: '', flightNumber: '', meetAndGreet: false,
  })
  const [confirmation, setConfirmation] = useState<BookingResult | null>(null)

  // Panel de equipaje colapsado por defecto (como el dropdown de Blacklane)
  // — solo se expande cuando el pasajero toca "Agregar equipaje".
  const [luggageOpen, setLuggageOpen] = useState(false)
  // Los 3 números de capacidad del vehículo (mano/facturada/extragrande) son
  // formas ALTERNAS de medir el mismo espacio del baúl, no capacidades que se
  // suman — el pasajero solo puede declarar UNA categoría a la vez (igual
  // que Blacklane), nunca las 3 simultáneamente.
  const [luggageCategory, setLuggageCategory] = useState<'luggageCarryOn' | 'luggageChecked' | 'luggageExtraLarge' | null>(null)
  const LUGGAGE_CATEGORIES = [
    ['luggageCarryOn', dict.luggageCarryOnShort, selectedQuote?.vehicleType.luggageCarryOnCapacity] as const,
    ['luggageChecked', dict.luggageCheckedShort, selectedQuote?.vehicleType.luggageCheckedCapacity] as const,
    ['luggageExtraLarge', dict.luggageExtraLargeShort, selectedQuote?.vehicleType.luggageExtraLargeCapacity] as const,
  ] as const
  function selectLuggageCategory(field: 'luggageCarryOn' | 'luggageChecked' | 'luggageExtraLarge') {
    if (luggageCategory === field) {
      // Tocar la misma categoría otra vez la quita.
      setLuggageCategory(null)
      setPassengerData((p) => ({ ...p, luggageCarryOn: 0, luggageChecked: 0, luggageExtraLarge: 0 }))
      return
    }
    setLuggageCategory(field)
    setPassengerData((p) => ({ ...p, luggageCarryOn: 0, luggageChecked: 0, luggageExtraLarge: 0, [field]: 1 }))
  }
  const luggageTotal = passengerData.luggageCarryOn + passengerData.luggageChecked + passengerData.luggageExtraLarge
  // "3 × Equipaje de mano, 1 × Maleta facturada" — legible en el resumen de
  // confirmación, en vez del formato crudo "3/1/0" que no dice a qué
  // categoría corresponde cada número.
  const luggageSummaryText = [
    passengerData.luggageCarryOn > 0    ? `${passengerData.luggageCarryOn} × ${dict.luggageCarryOnShort}` : null,
    passengerData.luggageChecked > 0    ? `${passengerData.luggageChecked} × ${dict.luggageCheckedShort}` : null,
    passengerData.luggageExtraLarge > 0 ? `${passengerData.luggageExtraLarge} × ${dict.luggageExtraLargeShort}` : null,
  ].filter(Boolean).join(', ')

  // ─── Exceso de equipaje — preview antes de confirmar ──────────────────────
  // Solo un estimado en el cliente para informar al pasajero; el cargo real
  // y autoritativo se calcula server-side en createPublicBookingAction, con
  // el MISMO cálculo (capacidad del vehicle_type vs. lo declarado). Vive aquí
  // (no solo en el paso de confirmación) porque también se usa en vivo dentro
  // del panel de equipaje del paso "Pasajero".
  const luggageOverageQty = selectedQuote
    ? Math.max(0, passengerData.luggageCarryOn - selectedQuote.vehicleType.luggageCarryOnCapacity) +
      Math.max(0, passengerData.luggageChecked - selectedQuote.vehicleType.luggageCheckedCapacity) +
      Math.max(0, passengerData.luggageExtraLarge - selectedQuote.vehicleType.luggageExtraLargeCapacity)
    : 0
  const luggageOverageFee = selectedQuote && luggageOverageQty > 0
    ? Math.round(selectedQuote.extraLuggageFee * luggageOverageQty * 100) / 100
    : 0

  // Código promocional (add-on de pago — ver lib/billing/addons.ts). El
  // descuento mostrado aquí es solo una vista previa; createPublicBookingAction
  // SIEMPRE revalida el código server-side antes de aplicarlo de verdad.
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoState, setPromoState] = useState<{ code: string; discountAmount: number } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [isPromoPending, startPromoTransition] = useTransition()

  function applyPromoCode() {
    const code = promoCodeInput.trim()
    if (!code || !selectedQuote) return
    setPromoError('')
    startPromoTransition(async () => {
      const result = await validatePromoCodeAction({
        slug: company.slug,
        code,
        bookingAmount: selectedQuote.totalAmount,
        customerPhone: passengerData.phone,
      })
      if (!result.success || !result.data) {
        setPromoError(result.error ?? 'Código no válido')
        setPromoState(null)
        return
      }
      setPromoState({ code: code.toUpperCase(), discountAmount: result.data.discountAmount })
    })
  }

  function removePromoCode() {
    setPromoState(null)
    setPromoCodeInput('')
    setPromoError('')
  }

  // Viajero recurrente — capa 1: autocompletar desde este navegador (sin
  // cuenta, sin backend). Capa 2: reconocer por teléfono en otro dispositivo,
  // ofreciendo sus datos con un clic explícito (nunca automático).
  const prefillKey = `luxeride:passenger:${company.slug}`
  const attributionKey = `luxeride:attribution:${company.slug}`
  function getStoredAttribution(): Record<string, string> | undefined {
    try {
      const raw = sessionStorage.getItem(attributionKey)
      return raw ? (JSON.parse(raw) as Record<string, string>) : undefined
    } catch {
      return undefined
    }
  }
  const [returningMatch, setReturningMatch] = useState<{ name: string; email?: string } | null>(null)
  const [returningDismissed, setReturningDismissed] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Siempre lee los valores más recientes dentro del setTimeout debounced,
  // sin importar cuál de los dos campos (teléfono/nombre) disparó el timer.
  const latestPassenger = useRef(passengerData)
  useEffect(() => { latestPassenger.current = passengerData }, [passengerData])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefillKey)
      if (!raw) return
      const saved = JSON.parse(raw) as { name?: string; phone?: string; email?: string }
      setPassengerData((p) => ({
        ...p,
        name: saved.name ?? p.name,
        phone: saved.phone ?? p.phone,
        email: saved.email ?? p.email,
      }))
      // eslint-disable-next-line no-empty
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atribución de marketing (UTM/gclid) — "primer toque": se guarda solo la
  // primera vez que se ve un parámetro en esta sesión, nunca se sobreescribe
  // en visitas posteriores sin params (ej. el pasajero vuelve directo a
  // terminar su reserva). Se lee de vuelta al confirmar — ver
  // getStoredAttribution() y su uso en handleConfirm.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(attributionKey)) return
      const params = new URLSearchParams(window.location.search)
      const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid']
      const attribution: Record<string, string> = {}
      for (const f of fields) {
        const v = params.get(f)
        if (v) attribution[f] = v
      }
      if (Object.keys(attribution).length === 0) return
      attribution.landing_path = window.location.pathname
      sessionStorage.setItem(attributionKey, JSON.stringify(attribution))
      // eslint-disable-next-line no-empty
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Requiere AMBOS factores (teléfono con dígitos suficientes + al menos 2
  // letras del nombre) antes de siquiera intentar la búsqueda — reduce la
  // superficie de enumeración por teléfono solo.
  function scheduleReturningLookup() {
    setReturningDismissed(false)
    setReturningMatch(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(() => {
      const { phone, name } = latestPassenger.current
      if (phone.replace(/[^0-9]/g, '').length < 7 || name.trim().length < 2) return
      lookupReturningPassengerAction(company.slug, phone, name.trim()).then((r) => {
        if (r.found && r.name) setReturningMatch({ name: r.name, email: r.email })
      })
    }, 600)
  }

  function handlePhoneChange(value: string) {
    setPassengerData((p) => ({ ...p, phone: value }))
    scheduleReturningLookup()
  }

  function handleNameChange(value: string) {
    setPassengerData((p) => ({ ...p, name: value }))
    scheduleReturningLookup()
  }

  function acceptReturningMatch() {
    if (!returningMatch) return
    setPassengerData((p) => ({ ...p, name: returningMatch.name, email: returningMatch.email ?? p.email }))
    setReturningMatch(null)
    setReturningDismissed(true)
  }

  // Hora local de hoy (para el min del input de fecha)
  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Intervalos de 15 min (00:00 → 23:45), etiquetas en el idioma del cliente
  const timeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const label = new Date(2000, 0, 1, h, m).toLocaleTimeString(localeTag, {
          hour: 'numeric', minute: '2-digit',
        })
        opts.push({ value, label })
      }
    }
    return opts
  }, [localeTag])

  // ─── PASO 1: Ruta ─────────────────────────────────────────────────────────

  function handleRouteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const fd = new FormData(e.currentTarget)
    const pickupLat  = parseFloat(fd.get('pickup_lat')  as string)
    const pickupLng  = parseFloat(fd.get('pickup_lng')  as string)
    const dropoffLat = parseFloat(fd.get('dropoff_lat') as string)
    const dropoffLng = parseFloat(fd.get('dropoff_lng') as string)

    if (!pickupLat || !pickupLng) {
      setError(dict.selectPickup)
      return
    }
    if (!dropoffLat || !dropoffLng) {
      setError(dict.selectDropoff)
      return
    }

    const dateStr = (fd.get('date') as string)?.trim()
    const timeStr = (fd.get('time') as string)?.trim()
    if (!dateStr) { setError(dict.selectDateTime); return }
    if (!timeStr) { setError(dict.selectTime); return }
    const scheduledAt = `${dateStr}T${timeStr}`

    // Multi-stop: recolectar paradas (cada una debe venir del autocomplete)
    const stops: { address: string; lat: number; lng: number }[] = []
    for (let i = 0; i < stopCount; i++) {
      const address = (fd.get(`stop_${i}`) as string)?.trim()
      if (!address) continue // parada vacía — se ignora
      const sLat = parseFloat(fd.get(`stop_${i}_lat`) as string)
      const sLng = parseFloat(fd.get(`stop_${i}_lng`) as string)
      if (!sLat || !sLng) {
        setError(dict.selectStop)
        return
      }
      stops.push({ address, lat: sLat, lng: sLng })
    }

    const requestedHoursRaw = parseFloat(fd.get('requested_hours') as string)
    const requestedHours = Number.isFinite(requestedHoursRaw) && requestedHoursRaw > 0 ? requestedHoursRaw : undefined

    const newRouteData = {
      pickupAddress:  fd.get('pickup')  as string,
      pickupLat, pickupLng,
      dropoffAddress: fd.get('dropoff') as string,
      dropoffLat, dropoffLng,
      scheduledAt,
      bookingType: (fd.get('booking_type') as BookingType) || 'one_way',
      requestedHours,
      stops,
    }
    setRouteData(newRouteData)

    const pickupPostalCode = (fd.get('pickup_postal_code') as string) || null
    const dropoffPostalCode = (fd.get('dropoff_postal_code') as string) || null

    startTransition(async () => {
      const result = await getPublicVehicleQuotesAction(company.slug, {
        pickupLat:    newRouteData.pickupLat,
        pickupLng:    newRouteData.pickupLng,
        pickupAddress: newRouteData.pickupAddress,
        pickupPostalCode,
        dropoffLat:   newRouteData.dropoffLat,
        dropoffLng:   newRouteData.dropoffLng,
        dropoffAddress: newRouteData.dropoffAddress,
        dropoffPostalCode,
        scheduledAt:  newRouteData.scheduledAt,
        bookingType:  newRouteData.bookingType,
        requestedHours: newRouteData.requestedHours,
        stops:        newRouteData.stops,
        partnerSlug,
      })

      if (!result.success || !result.data) {
        setError(result.error ?? 'Error al obtener precios')
        return
      }

      setVehicleQuotes(result.data)
      setStep(1)
    })
  }

  // ─── PASO 2: Vehículo ─────────────────────────────────────────────────────

  function handleSelectVehicle(q: VehicleQuote) {
    if (q.noPrice) return
    setSelectedQuote(q)
    // Si el pasajero ya había declarado equipaje con OTRO vehículo (más
    // grande) y ahora elige uno con menos capacidad, recortar a lo que este
    // nuevo vehículo permite (capacidad + tope de exceso) — evita que quede
    // un valor "atascado" que el stepper ya no deja subir pero tampoco baja solo.
    setPassengerData((p) => ({
      ...p,
      luggageCarryOn:    Math.min(p.luggageCarryOn,    q.vehicleType.luggageCarryOnCapacity    + MAX_LUGGAGE_EXTRA_PER_CATEGORY),
      luggageChecked:    Math.min(p.luggageChecked,    q.vehicleType.luggageCheckedCapacity     + MAX_LUGGAGE_EXTRA_PER_CATEGORY),
      luggageExtraLarge: Math.min(p.luggageExtraLarge, q.vehicleType.luggageExtraLargeCapacity  + MAX_LUGGAGE_EXTRA_PER_CATEGORY),
    }))
    setStep(2)
  }

  // ─── PASO 3: Pasajero ─────────────────────────────────────────────────────

  function handlePassengerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const fd = new FormData(e.currentTarget)
    const name = (fd.get('name') as string)?.trim()
    const phone = (fd.get('phone') as string)?.trim()

    if (!name)  { setError(dict.nameRequired); return }
    if (!phone) { setError(dict.phoneRequired); return }

    setPassengerData((p) => ({
      ...p,
      name,
      phone,
      email:        (fd.get('email') as string)?.trim() ?? '',
      count:        parseInt(fd.get('count') as string) || 1,
      // El equipaje ya vive en vivo en passengerData (steppers del panel
      // "Agregar equipaje" lo actualizan directamente) — no hay inputs de
      // formulario que releer aquí.
      instructions: (fd.get('instructions') as string)?.trim() ?? '',
      flightNumber: (fd.get('flight_number') as string)?.trim() ?? '',
    }))
    setStep(3)
  }

  // ─── PASO 4: Confirmar ────────────────────────────────────────────────────

  function handleConfirm(payNow = false) {
    if (!selectedQuote) return
    setError('')

    startTransition(async () => {
      const result = await createPublicBookingAction({
        quoteId:             selectedQuote.quoteId,
        slug:                company.slug,
        bookingType:         routeData.bookingType,
        passengerName:       passengerData.name,
        passengerPhone:      passengerData.phone,
        passengerEmail:      passengerData.email || undefined,
        passengerCount:      passengerData.count,
        luggageCarryOn:      passengerData.luggageCarryOn,
        luggageChecked:      passengerData.luggageChecked,
        luggageExtraLarge:   passengerData.luggageExtraLarge,
        specialInstructions: passengerData.instructions || undefined,
        flightNumber:        passengerData.flightNumber || undefined,
        meetAndGreet:        passengerData.meetAndGreet,
        scheduledAt:         routeData.scheduledAt,
        pickupAddress:       routeData.pickupAddress,
        pickupLat:           routeData.pickupLat,
        pickupLng:           routeData.pickupLng,
        dropoffAddress:      routeData.dropoffAddress,
        dropoffLat:          routeData.dropoffLat,
        dropoffLng:          routeData.dropoffLng,
        stops:               routeData.stops,
        promoCode:           promoState?.code,
        partnerSlug,
        attribution:         getStoredAttribution(),
      })

      if (!result.success || !result.data) {
        setError(result.error ?? 'Error al crear reservación')
        return
      }

      // Viajero recurrente: recordar datos en este navegador para la próxima
      // reserva (capa 1 — nunca sale del dispositivo, sin cuenta ni backend).
      try {
        localStorage.setItem(prefillKey, JSON.stringify({
          name: passengerData.name, phone: passengerData.phone, email: passengerData.email,
        }))
        // eslint-disable-next-line no-empty
      } catch {}

      // Pago al momento de reservar: crea la reserva y va directo a Stripe Checkout
      if (payNow && onlinePaymentsEnabled) {
        const pay = await createPublicCheckoutAction(company.slug, result.data.bookingId, gratuityPct || undefined)
        if (pay.success && pay.data) {
          window.location.href = pay.data.url
          return
        }
        // Si falla el pago online, igual confirmamos la reserva (pagará después)
      }

      setConfirmation(result.data)
    })
  }

  // ─── Tarjeta guardada de Whop (Sección I, capa 3) ─────────────────────────
  // El bookingId ya creado es el capability token — misma lógica de seguridad
  // que /track/[id]. Se ofrece solo si el pasajero pagó antes con Whop en esta
  // misma empresa (por su teléfono).
  const [savedCard, setSavedCard] = useState<SavedWhopCard | null>(null)
  const [savedCardCharged, setSavedCardCharged] = useState(false)

  useEffect(() => {
    if (!confirmation || !onlinePaymentsEnabled) return
    getSavedWhopCardAction(confirmation.bookingId).then((r) => {
      if (r.found && r.card) setSavedCard(r.card)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmation?.bookingId, onlinePaymentsEnabled])

  function handlePaySavedCard() {
    if (!confirmation) return
    setError('')
    startTransition(async () => {
      const result = await chargeWithSavedWhopCardAction(confirmation.bookingId, gratuityPct || undefined)
      if (!result.success) {
        setError(result.error ?? 'No se pudo cobrar con la tarjeta guardada')
        return
      }
      setSavedCardCharged(true)
    })
  }

  // ─── Pago online (post-confirmación) ─────────────────────────────────────

  function handlePayOnline() {
    if (!confirmation) return
    setError('')
    startTransition(async () => {
      const result = await createPublicCheckoutAction(
        company.slug,
        confirmation.bookingId,
        gratuityPct || undefined,
      )
      if (!result.success || !result.data) {
        setError(result.error ?? 'No se pudo iniciar el pago online')
        return
      }
      window.location.href = result.data.url
    })
  }

  // ─── ÉXITO ────────────────────────────────────────────────────────────────

  if (confirmation) {
    return (
      <div className="text-center py-12 space-y-4">
        {/* Reserva confirmada sin pago online — la conversión se dispara acá.
            El flujo con pago online nunca llega a este punto (redirige a
            Stripe/Whop antes); ese caso lo cubre payment/success/page.tsx. */}
        <ConversionTracker
          gaMeasurementId={gaMeasurementId}
          transactionId={confirmation.bookingNumber}
          value={selectedQuote ? selectedQuote.totalAmount - (promoState?.discountAmount ?? 0) + luggageOverageFee : 0}
          currency={selectedQuote?.currency ?? company.currency}
        />
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <h2 className="font-semibold text-2xl text-[#1d1d1f]">{dict.confirmed}</h2>
        <p className="text-gray-500">{dict.yourNumber}</p>
        <p className="font-mono text-2xl font-bold text-[var(--brand)] bg-[var(--brand)]/10 rounded-2xl px-8 py-4 inline-block">
          {confirmation.bookingNumber}
        </p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          {dict.contactSoon.replace('{company}', company.name)}
        </p>
        <p className="text-sm">
          <a
            href={`/track/${confirmation.bookingId}`}
            className="text-[var(--brand)] hover:underline font-medium"
          >
            {dict.trackTrip}
          </a>
        </p>
        {onlinePaymentsEnabled && (
          <div className="pt-2 space-y-3">
            {gratuity?.enabled && (
              <div className="max-w-sm mx-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                  {dict.addTip}
                </p>
                <div className="flex justify-center gap-2">
                  {[0, ...gratuity.options].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setGratuityPct(pct)}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-colors ${
                        gratuityPct === pct
                          ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                          : 'bg-white text-[#1d1d1f] border-gray-200 hover:border-[var(--brand)]'
                      }`}
                    >
                      {pct === 0 ? dict.noTip : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {savedCardCharged ? (
              <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 max-w-sm mx-auto">
                {dict.savedCardSuccess}
              </p>
            ) : savedCard ? (
              <div className="space-y-2">
                <button
                  onClick={handlePaySavedCard}
                  disabled={isPending}
                  className="px-8 py-3.5 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm"
                >
                  {isPending
                    ? dict.redirecting
                    : dict.savedCardPay
                        .replace('{brand}', savedCard.brand ?? '')
                        .replace('{last4}', savedCard.last4 ?? '····')}
                </button>
                <p>
                  <button
                    type="button"
                    onClick={() => setSavedCard(null)}
                    disabled={isPending}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    {dict.savedCardUseOther}
                  </button>
                </p>
              </div>
            ) : (
              <button
                onClick={handlePayOnline}
                disabled={isPending}
                className="px-8 py-3.5 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm"
              >
                {isPending ? dict.redirecting : dict.payOnline}
              </button>
            )}
            <p className="text-xs text-gray-400">{dict.securePayment}</p>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 max-w-sm mx-auto">
                {error}
              </p>
            )}
          </div>
        )}
        {(company.phone || company.email) && (
          <div className="text-sm text-gray-500 space-y-1 pt-2">
            {company.phone && <p>📞 {company.phone}</p>}
            {company.email && <p>✉️ {company.email}</p>}
          </div>
        )}
      </div>
    )
  }

  // ─── LAYOUT BASE ─────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] leading-snug">
          {dict.bookWith} {company.name}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{dict.premiumService}</p>
      </div>

      <StepIndicator current={step} steps={dict.steps} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
      {/* ─── PASO 0: Ruta ──────────────────────────────────────────────────── */}
      {step === 0 && (
        <form onSubmit={handleRouteSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.serviceType}
            </label>
            <select
              name="booking_type"
              value={bookingTypeSel}
              onChange={(e) => setBookingTypeSel(e.target.value as BookingType)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            >
              <option value="one_way">{dict.types.one_way}</option>
              <option value="airport_pickup">{dict.types.airport_pickup}</option>
              <option value="airport_dropoff">{dict.types.airport_dropoff}</option>
              <option value="round_trip">{dict.types.round_trip}</option>
              <option value="hourly">{dict.types.hourly}</option>
            </select>
          </div>

          {bookingTypeSel === 'hourly' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                {dict.requestedHours}
              </label>
              <input
                type="number"
                name="requested_hours"
                min={0.5}
                step={0.5}
                placeholder={dict.requestedHoursPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                {dict.date}
              </label>
              <input
                type="date"
                name="date"
                required
                min={todayStr}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                {dict.time}
              </label>
              <select
                name="time"
                required
                defaultValue=""
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              >
                <option value="" disabled>—:—</option>
                {timeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.pickupLabel}
            </label>
            <AddressInput
              name="pickup"
              placeholder={dict.pickupPlaceholder}
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          {/* Multi-stop: paradas intermedias (máx. 3) */}
          {Array.from({ length: stopCount }).map((_, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
                  {dict.stop} {i + 1}
                </label>
                {i === stopCount - 1 && (
                  <button
                    type="button"
                    onClick={() => setStopCount((c) => c - 1)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    ✕ {dict.remove}
                  </button>
                )}
              </div>
              <AddressInput
                name={`stop_${i}`}
                placeholder={dict.stopPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
          ))}

          {stopCount < 3 && (
            <button
              type="button"
              onClick={() => setStopCount((c) => c + 1)}
              className="w-full py-2.5 text-sm font-medium text-[var(--brand)] border border-dashed border-gray-300 rounded-xl hover:border-[var(--brand)] hover:bg-[var(--brand)]/5 transition-colors"
            >
              {dict.addStop}
            </button>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.dropoffLabel}
            </label>
            <AddressInput
              name="dropoff"
              placeholder={dict.dropoffPlaceholder}
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm"
          >
            {isPending ? dict.calculating : dict.seePrices}
          </button>
        </form>
      )}

      {/* ─── PASO 1: Vehículo ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-base">📍</span>
              <div>
                <p className="font-medium text-[#1d1d1f]">{routeData.pickupAddress}</p>
                {routeData.stops.map((s, i) => (
                  <p key={i} className="text-gray-400 text-xs">
                    ◆ {dict.stop} {i + 1}: {s.address}
                  </p>
                ))}
                <p className="text-gray-400">→ {routeData.dropoffAddress}</p>
                {vehicleQuotes[0]?.distanceMiles != null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {vehicleQuotes[0].distanceMiles.toFixed(1)} mi · {vehicleQuotes[0].durationMinutes} {dict.estimate}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-[#1d1d1f]">{dict.selectVehicle}</p>

          <div className="space-y-3">
            {vehicleQuotes.map((q) => (
              <button
                key={q.vehicleType.id}
                onClick={() => handleSelectVehicle(q)}
                disabled={q.noPrice}
                className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${
                  q.noPrice
                    ? 'border-gray-200 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-[var(--brand)] hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Caja horizontal (no cuadrada): las fotos subidas en
                        /admin/fleet son landscape (~1.45:1, misma proporción
                        que la miniatura h-11 w-16 de esa página) — un
                        cuadrado con object-cover recortaba el vehículo casi
                        por completo. */}
                    {q.vehicleType.imageUrl ? (
                      <img
                        src={q.vehicleType.imageUrl}
                        alt={q.vehicleType.name}
                        className="w-16 h-11 rounded-lg object-cover shrink-0 bg-gray-100"
                      />
                    ) : (
                      <span className="text-3xl w-16 h-11 flex items-center justify-center shrink-0">
                        {CLASS_ICONS[q.vehicleType.class] ?? '🚗'}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold text-[#1d1d1f]">{q.vehicleType.name}</p>
                      <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-1.5">
                        <span>👤 {q.vehicleType.capacity}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {/* "o"/"or"/"ou" (no "·") — estos 3 números son formas
                              ALTERNAS de medir la misma capacidad del baúl, nunca
                              se suman entre sí (igual que el picker de equipaje). */}
                          🧳 {q.vehicleType.luggageCarryOnCapacity} {dict.luggageCarryOnAbbrev} {dict.luggageOrWord} {q.vehicleType.luggageCheckedCapacity} {dict.luggageCheckedAbbrev} {dict.luggageOrWord} {q.vehicleType.luggageExtraLargeCapacity} {dict.luggageExtraLargeAbbrev}
                        </span>
                        {q.vehicleType.amenities.length > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{q.vehicleType.amenities.slice(0, 2).join(', ')}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {q.noPrice ? (
                      <p className="text-xs text-gray-400">{dict.noPrice}</p>
                    ) : (
                      <>
                        <p className="font-bold text-xl text-[#1d1d1f]">
                          ${q.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">{q.currency}</p>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setStep(0); setError('') }}
            className="text-sm text-gray-500 hover:text-[var(--brand)] mt-2"
          >
            {dict.changeRoute}
          </button>
        </div>
      )}

      {/* ─── PASO 2: Pasajero ──────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handlePassengerSubmit} className="space-y-4">
          {selectedQuote && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedQuote.vehicleType.imageUrl ? (
                  <img
                    src={selectedQuote.vehicleType.imageUrl}
                    alt={selectedQuote.vehicleType.name}
                    className="w-12 h-8 rounded-md object-cover shrink-0 bg-gray-100"
                  />
                ) : (
                  <span className="text-2xl w-12 h-8 flex items-center justify-center shrink-0">
                    {CLASS_ICONS[selectedQuote.vehicleType.class] ?? '🚗'}
                  </span>
                )}
                <p className="font-semibold text-[#1d1d1f] text-sm">{selectedQuote.vehicleType.name}</p>
              </div>
              <p className="font-bold text-lg text-[#1d1d1f]">
                ${selectedQuote.totalAmount.toFixed(2)} {selectedQuote.currency}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.fullName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              value={passengerData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.phone} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              required
              value={passengerData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+1 809 000 0000"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
            {returningMatch && !returningDismissed && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-3 py-2">
                <p className="text-xs text-[#1d1d1f]">
                  {dict.returningMatch.replace('{name}', returningMatch.name)}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={acceptReturningMatch}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    {dict.returningMatchUse}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturningDismissed(true)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {dict.returningMatchDismiss}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.email} <span className="font-normal normal-case text-gray-400">{dict.optional}</span>
            </label>
            <input
              type="email"
              name="email"
              value={passengerData.email}
              onChange={(e) => setPassengerData((p) => ({ ...p, email: e.target.value }))}
              placeholder="juan@example.com"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.passengerCount}
            </label>
            <input
              type="number"
              name="count"
              defaultValue={1}
              min={1}
              max={selectedQuote?.vehicleType.capacity ?? 20}
              className="w-28 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              🧳 {dict.luggageLabel}
            </label>

            {!luggageOpen ? (
              <button
                type="button"
                onClick={() => setLuggageOpen(true)}
                className="w-full flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm hover:border-[var(--brand)] transition-colors"
              >
                {luggageTotal > 0 ? (
                  <>
                    <span className="text-[#1d1d1f]">{luggageSummaryText}</span>
                    <span className="text-xs font-medium text-[var(--brand)]">{dict.luggageEdit}</span>
                  </>
                ) : (
                  <span className="text-gray-500">+ {dict.luggageAddButton}</span>
                )}
              </button>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                {/* Una sola categoría a la vez — los 3 números del vehículo
                    (mano/facturada/extragrande) son formas ALTERNAS de medir
                    el mismo espacio del baúl, no capacidades que se suman.
                    Elegir una categoría reemplaza cualquier otra ya elegida. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LUGGAGE_CATEGORIES.map(([field, label, included]) => {
                    const selected = luggageCategory === field
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => selectLuggageCategory(field)}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                          selected ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-sm ${selected ? 'font-semibold' : ''} text-[#1d1d1f]`}>{label}</p>
                        {selectedQuote && (
                          <p className="text-[11px] text-gray-400">
                            {dict.luggageIncluded.replace('{n}', String(included ?? 0))}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>

                {luggageCategory && (() => {
                  const included = LUGGAGE_CATEGORIES.find(([f]) => f === luggageCategory)?.[2]
                  const max = (included ?? 20) + MAX_LUGGAGE_EXTRA_PER_CATEGORY
                  const value = passengerData[luggageCategory]
                  const atMax = value >= max
                  return (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                      <p className="text-sm text-[#1d1d1f]">
                        {LUGGAGE_CATEGORIES.find(([f]) => f === luggageCategory)?.[1]}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPassengerData((p) => ({ ...p, [luggageCategory]: Math.max(1, p[luggageCategory] - 1) }))}
                          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-[#1d1d1f]">{value}</span>
                        <button
                          type="button"
                          disabled={atMax}
                          onClick={() => setPassengerData((p) => ({ ...p, [luggageCategory]: Math.min(max, p[luggageCategory] + 1) }))}
                          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {luggageOverageFee > 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    🧳 {dict.luggageOverageWarning.replace('{amount}', `$${luggageOverageFee.toFixed(2)} ${selectedQuote?.currency ?? ''}`)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setLuggageOpen(false)}
                  className="text-xs font-medium text-[var(--brand)] hover:underline"
                >
                  {dict.luggageDone}
                </button>
              </div>
            )}
          </div>

          {(routeData.bookingType === 'airport_pickup' || routeData.bookingType === 'airport_dropoff') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                {dict.flightNumber} <span className="font-normal normal-case text-gray-400">{dict.recommended}</span>
              </label>
              <input
                type="text"
                name="flight_number"
                placeholder="AA1234"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
          )}

          {routeData.bookingType === 'airport_pickup' && (
            <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                checked={passengerData.meetAndGreet}
                onChange={(e) => setPassengerData((p) => ({ ...p, meetAndGreet: e.target.checked }))}
                className="w-4 h-4 rounded accent-[var(--brand)]"
              />
              <span className="text-sm text-[#1d1d1f]">{dict.meetAndGreet}</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {dict.specialInstructions} <span className="font-normal normal-case text-gray-400">{dict.optional}</span>
            </label>
            <textarea
              name="instructions"
              rows={2}
              placeholder={dict.instructionsPlaceholder}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1d1d1f] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 resize-none"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep(1); setError('') }}
              className="px-5 py-3 border border-gray-200 text-sm font-medium rounded-xl hover:border-[var(--brand)] transition-colors text-[#1d1d1f]"
            >
              {dict.back}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 transition-colors text-sm"
            >
              {dict.continue}
            </button>
          </div>
        </form>
      )}

      {/* ─── PASO 3: Confirmación ──────────────────────────────────────────── */}
      {step === 3 && selectedQuote && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              {dict.summary}
            </p>

            {/* Ruta */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.pickup}</span>
                <span className="text-[#1d1d1f] font-medium">{routeData.pickupAddress}</span>
              </div>
              {routeData.stops.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{dict.stop} {i + 1}</span>
                  <span className="text-[#1d1d1f]">{s.address}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.destination}</span>
                <span className="text-[#1d1d1f] font-medium">{routeData.dropoffAddress}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.date}</span>
                <span className="text-[#1d1d1f]">
                  {new Date(routeData.scheduledAt).toLocaleString(localeTag, {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.vehicle}</span>
                <span className="text-[#1d1d1f]">{selectedQuote.vehicleType.name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.passenger}</span>
                <span className="text-[#1d1d1f]">{passengerData.name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-20 shrink-0">{dict.phone}</span>
                <span className="text-[#1d1d1f]">{passengerData.phone}</span>
              </div>
              {passengerData.count > 1 && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Pax</span>
                  <span className="text-[#1d1d1f]">{passengerData.count}</span>
                </div>
              )}
              {luggageSummaryText && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">🧳 {dict.luggageLabel}</span>
                  <span className="text-[#1d1d1f]">{luggageSummaryText}</span>
                </div>
              )}
              {passengerData.instructions && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{dict.notes}</span>
                  <span className="text-[#1d1d1f]">{passengerData.instructions}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {!promoState ? (
                <div className="flex gap-2">
                  <input
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder={dict.promoCodePlaceholder}
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase placeholder:normal-case"
                  />
                  <button
                    type="button"
                    onClick={applyPromoCode}
                    disabled={isPromoPending || !promoCodeInput.trim()}
                    className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:border-[var(--brand)] disabled:opacity-50 transition-colors text-[#1d1d1f]"
                  >
                    {isPromoPending ? '...' : dict.promoCodeApply}
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600">{dict.promoCodeApplied.replace('{code}', promoState.code)}</span>
                  <button type="button" onClick={removePromoCode} className="text-xs text-gray-400 hover:underline">
                    {dict.promoCodeRemove}
                  </button>
                </div>
              )}
              {promoError && <p className="text-xs text-red-600">{promoError}</p>}

              {promoState && (
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{dict.promoCodeDiscount}</span>
                  <span>-${promoState.discountAmount.toFixed(2)}</span>
                </div>
              )}

              {luggageOverageFee > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  🧳 {dict.luggageOverageWarning.replace('{amount}', `$${luggageOverageFee.toFixed(2)} ${selectedQuote.currency}`)}
                </p>
              )}

              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold text-[#1d1d1f]">{dict.totalToPay}</span>
                <span className="font-bold text-2xl text-[#1d1d1f]">
                  ${(selectedQuote.totalAmount - (promoState?.discountAmount ?? 0) + luggageOverageFee).toFixed(2)}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    {selectedQuote.currency}
                  </span>
                </span>
              </div>
              <p className="text-xs text-gray-400 text-right">{dict.payToDriver}</p>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {onlinePaymentsEnabled ? (
            <div className="space-y-2.5">
              <button
                onClick={() => handleConfirm(true)}
                disabled={isPending}
                className="w-full py-3.5 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm"
              >
                {isPending ? dict.confirming : dict.confirmAndPay}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep(2); setError('') }}
                  disabled={isPending}
                  className="px-5 py-3 border border-gray-200 text-sm font-medium rounded-xl hover:border-[var(--brand)] transition-colors text-[#1d1d1f]"
                >
                  {dict.back}
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={isPending}
                  className="flex-1 py-3 border border-gray-200 text-[#1d1d1f] font-medium rounded-2xl hover:border-[var(--brand)] disabled:opacity-50 transition-colors text-sm"
                >
                  {dict.reserveOnly}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => { setStep(2); setError('') }}
                className="px-5 py-3 border border-gray-200 text-sm font-medium rounded-xl hover:border-[var(--brand)] transition-colors text-[#1d1d1f]"
              >
                {dict.back}
              </button>
              <button
                onClick={() => handleConfirm(false)}
                disabled={isPending}
                className="flex-1 py-3.5 bg-[var(--brand)] text-white font-semibold rounded-2xl hover:opacity-90 disabled:opacity-50 transition-colors text-sm"
              >
                {isPending ? dict.confirming : dict.confirmBooking}
              </button>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">
            {onlinePaymentsEnabled ? dict.confirmNoteOnline : dict.confirmNote}
          </p>
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
