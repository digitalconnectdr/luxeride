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
  scheduled_at: string
  pickup_location: { address?: string } | null
  dropoff_location: { address?: string } | null
}

export const NEXT_ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  assigned: '🚗 Ir al punto de recogida',
  en_route: '📍 Marcar como llegué',
  arrived: '▶️ Iniciar viaje',
  in_progress: '✓ Completar viaje',
}

export const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
  assigned: 'Asignado',
  en_route: 'En ruta al pickup',
  arrived: 'En el punto de recogida',
  in_progress: 'Viaje en curso',
}
