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

// ── Navegación ──────────────────────────────────────────────────────────
export type BookingStackParamList = {
  NewBooking: { prefill?: BookingPrefill } | undefined
  VehicleSelect: { draft: BookingDraft }
  BookingConfirm: { draft: BookingDraft; quote: VehicleQuote }
  BookingSuccess: { bookingId: string; bookingNumber: string }
  TripTracking: { bookingId: string }
}

export type RootTabParamList = {
  Inicio: undefined
  Reservar: undefined
  'Mis viajes': undefined
  Perfil: undefined
}
