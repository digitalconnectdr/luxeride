export type BookingStatus =
  | 'quote'
  | 'pending'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
  quote: 'Cotización',
  pending: 'Pendiente',
  assigned: 'Conductor asignado',
  en_route: 'Conductor en camino',
  arrived: 'Conductor esperando',
  in_progress: 'Viaje en curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No presentado',
}

// ── Selección de vehículo (respuesta de /api/mobile/passenger/quote) ──────
export interface VehicleQuote {
  vehicleType: {
    id: string
    name: string
    class: string
    capacity: number
    amenities: string[]
    imageUrl: string | null
  }
  quoteId: string
  baseAmount: number
  surchargeAmount: number
  totalAmount: number
  currency: string
  distanceMiles: number | null
  durationMinutes: number | null
  noPrice: boolean
}

export interface BookingDraft {
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  pickupPlaceId?: string
  pickupPostalCode?: string
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffPlaceId?: string
  dropoffPostalCode?: string
  scheduledAt: string
  passengerCount: number
}

export interface BookingResult {
  bookingId: string
  bookingNumber: string
}

// "Reservar de nuevo" desde Mis viajes — prefill parcial (solo lo que
// tenemos guardado de la reserva anterior: no hay placeId/código postal
// persistidos en bookings, así que el autocomplete no queda "seleccionado"
// pero el geocoder de respaldo ya funciona igual con solo texto).
export interface BookingPrefill {
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  passengerCount?: number
}

// ── Método de pago declarado al reservar ──────────────────────────────────
// 'pay_now' y 'card_later' comparten el mismo valor en el backend ('card')
// — la diferencia es únicamente CUÁNDO se cobra (ver payment_method_intent
// en bookings + autoChargeDeferredCardInBackground en apps/web).
export type PaymentChoice = 'pay_now' | 'card_later' | 'cash'

export interface TripMessage {
  id: string
  sender: 'client' | 'driver' | 'dispatcher'
  body: string
  created_at: string
  read_at: string | null
}

// ── Navegación ──────────────────────────────────────────────────────────
/**
 * Resumen que la pantalla de éxito muestra sin tener que volver a consultar
 * la reserva recién creada — todos estos datos ya están en memoria en el
 * paso de confirmación.
 */
export interface BookingSuccessSummary {
  pickupAddress: string
  dropoffAddress: string
  scheduledAt: string
  passengerCount: number
  vehicleName: string
}

export type BookingStackParamList = {
  NewBooking: { prefill?: BookingPrefill } | undefined
  VehicleSelect: { draft: BookingDraft }
  BookingConfirm: { draft: BookingDraft; quote: VehicleQuote }
  BookingSuccess: { bookingId: string; bookingNumber: string; summary?: BookingSuccessSummary }
  TripTracking: { bookingId: string }
  Chat: { bookingId: string }
}

export type HomeStackParamList = {
  HomeMain: undefined
  Notifications: undefined
}

export type RootTabParamList = {
  Inicio: undefined
  Reservar: undefined
  'Mis viajes': undefined
  Perfil: undefined
}
