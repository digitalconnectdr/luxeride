export type BookingStatus =
  | 'pending'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export interface DriverBooking {
  id: string
  booking_number: string
  status: BookingStatus
  passenger_name: string | null
  passenger_phone: string | null
  scheduled_at: string
  pickup_location: { address?: string; lat?: number; lng?: number } | null
  dropoff_location: { address?: string; lat?: number; lng?: number } | null
  flight_number: string | null
  flight_status: string | null
  flight_delay_minutes: number | null
  total_amount: number | null
  currency: string | null
  completed_at: string | null
}

export interface DriverRow {
  id: string
  is_available: boolean
  total_earnings: number
  total_trips: number
  license_number: string | null
  license_expiry: string | null
  license_photo_url: string | null
  insurance_photo_url: string | null
  chauffeur_permit_expires_at: string | null
}

export const NEXT_ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  assigned: '🚗 Ir al punto de recogida',
  en_route: '📍 Marcar como llegué',
  arrived: '▶️ Iniciar viaje',
  in_progress: '✓ Completar viaje',
}

export const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  en_route: 'En ruta al pickup',
  arrived: 'En el punto de recogida',
  in_progress: 'Viaje en curso',
  completed: 'Completado',
}

export const ACTIVE_STATUSES: BookingStatus[] = ['assigned', 'en_route', 'arrived', 'in_progress']

export type TripsStackParamList = {
  TripsList: undefined
  TripDetail: { tripId: string }
}
