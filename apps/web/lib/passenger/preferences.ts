// ── Preferencias de viaje del pasajero ─────────────────────────────────────
// Fuente única de las opciones válidas y de sus etiquetas en español, para que
// la app, la pantalla del conductor y el detalle de reserva del admin muestren
// exactamente lo mismo sin repetir el diccionario en tres lugares.
//
// Referencia de mercado (julio 2026): Uber Black expone temperatura,
// conversación ("Quiet mode") y ayuda con equipaje; Blacklane ajusta música y
// temperatura. Las notas fijas y el vehículo preferido son propios — resuelven
// que hoy el pasajero reescriba las mismas indicaciones en cada reserva.
//
// Migración 85 (agosto 2026): género del conductor y conductor favorito —
// las dos ideas realmente aprovechables de Empower (driveempower.com), un
// rideshare "propiedad del conductor" sin relación con el modelo de negocio
// de LuxeRide, pero con dos features de pasajero que sí valen la pena.

export type ConversationPref = 'no_preference' | 'quiet' | 'chatty'
export type TemperaturePref = 'no_preference' | 'cool' | 'mild' | 'warm'
export type MusicPref = 'no_preference' | 'none' | 'soft' | 'driver_choice'
export type DriverGenderPref = 'no_preference' | 'female' | 'male'

export interface PassengerPreferences {
  conversation: ConversationPref
  temperature: TemperaturePref
  music: MusicPref
  luggageHelp: boolean
  standingNotes: string | null
  preferredVehicleTypeId: string | null
  preferredDriverGender: DriverGenderPref
  favoriteDriverId: string | null
}

export const DEFAULT_PREFERENCES: PassengerPreferences = {
  conversation: 'no_preference',
  temperature: 'no_preference',
  music: 'no_preference',
  luggageHelp: false,
  standingNotes: null,
  preferredVehicleTypeId: null,
  preferredDriverGender: 'no_preference',
  favoriteDriverId: null,
}

export const CONVERSATION_LABEL: Record<ConversationPref, string> = {
  no_preference: 'Sin preferencia',
  quiet: 'Prefiere silencio',
  chatty: 'Abierto a conversar',
}

export const TEMPERATURE_LABEL: Record<TemperaturePref, string> = {
  no_preference: 'Sin preferencia',
  cool: 'Fresco',
  mild: 'Templado',
  warm: 'Cálido',
}

export const MUSIC_LABEL: Record<MusicPref, string> = {
  no_preference: 'Sin preferencia',
  none: 'Sin música',
  soft: 'Música suave',
  driver_choice: 'A elección del conductor',
}

export const DRIVER_GENDER_LABEL: Record<DriverGenderPref, string> = {
  no_preference: 'Sin preferencia',
  female: 'Prefiere conductora',
  male: 'Prefiere conductor',
}

/** Normaliza una fila de BD (o el JSON congelado en la reserva) al tipo del dominio. */
export function toPreferences(row: Record<string, unknown> | null | undefined): PassengerPreferences {
  if (!row) return DEFAULT_PREFERENCES
  // Acepta tanto snake_case (fila de BD) como camelCase (JSON ya normalizado),
  // porque la copia congelada en bookings se guarda ya en camelCase.
  const pick = (snake: string, camel: string) => row[snake] ?? row[camel]
  return {
    conversation: (pick('conversation', 'conversation') as ConversationPref) ?? 'no_preference',
    temperature: (pick('temperature', 'temperature') as TemperaturePref) ?? 'no_preference',
    music: (pick('music', 'music') as MusicPref) ?? 'no_preference',
    luggageHelp: Boolean(pick('luggage_help', 'luggageHelp')),
    standingNotes: (pick('standing_notes', 'standingNotes') as string | null) ?? null,
    preferredVehicleTypeId: (pick('preferred_vehicle_type_id', 'preferredVehicleTypeId') as string | null) ?? null,
    preferredDriverGender: (pick('preferred_driver_gender', 'preferredDriverGender') as DriverGenderPref) ?? 'no_preference',
    favoriteDriverId: (pick('favorite_driver_id', 'favoriteDriverId') as string | null) ?? null,
  }
}

/** ¿Vale la pena mostrarle esto al conductor, o es todo "sin preferencia"? */
export function hasAnyPreference(p: PassengerPreferences): boolean {
  return (
    p.conversation !== 'no_preference' ||
    p.temperature !== 'no_preference' ||
    p.music !== 'no_preference' ||
    p.luggageHelp ||
    Boolean(p.standingNotes?.trim()) ||
    p.preferredDriverGender !== 'no_preference' ||
    Boolean(p.favoriteDriverId)
  )
}

/**
 * Resumen legible para el conductor y el operador. Omite lo que está en
 * "sin preferencia" — una lista donde casi todo dice "sin preferencia" hace
 * que se ignore la línea entera, incluida la parte que sí importa.
 */
export function summarizePreferences(p: PassengerPreferences): string[] {
  const out: string[] = []
  if (p.conversation !== 'no_preference') out.push(CONVERSATION_LABEL[p.conversation])
  if (p.temperature !== 'no_preference') out.push(`Clima: ${TEMPERATURE_LABEL[p.temperature].toLowerCase()}`)
  if (p.music !== 'no_preference') out.push(MUSIC_LABEL[p.music])
  if (p.luggageHelp) out.push('Necesita ayuda con equipaje')
  if (p.preferredDriverGender !== 'no_preference') out.push(DRIVER_GENDER_LABEL[p.preferredDriverGender])
  return out
}
