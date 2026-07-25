// ── Perfil — cuenta, direcciones, seguridad y apariencia ───────────────────
// user_profiles ya tiene una policy RLS "users_update_own_profile" que deja
// a cualquier usuario actualizar su propia fila (WITH CHECK bloquea cambiar
// role/company_id). Se actualiza directo desde aquí, solo los 4 campos que
// este formulario expone (nunca avatar_url/metadata/is_active, aunque la
// policy los permitiría).
// Direcciones guardadas: tabla `passenger_saved_addresses`, RLS propia por
// customer_id — mismo patrón de acceso directo (sin ruta de servidor).
//
// La pantalla pasó de ser un formulario largo (todo abierto a la vez,
// obligando a desplazarse por campos que casi nunca se editan) a un menú de
// secciones colapsables. Nada de la funcionalidad anterior se quitó: cada
// bloque vive ahora detrás de su propia fila.

import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, Modal, Platform, ScrollView, Alert, Linking } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { PressableScale } from '../components/PressableScale'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import { Button, Card, Field, FieldButton, SectionLabel, ScreenLoader, MenuRow } from '../components/ui'
import {
  font,
  radius,
  space,
  useThemedStyles,
  useTheme,
  type Palette,
  type ThemeMode,
} from '../lib/theme'
import type { PlaceDetails } from '../lib/places'

interface SavedAddress {
  id: string
  label: string
  address: string
  lat: number
  lng: number
}

const LABEL_PRESETS = [
  { key: 'home', label: 'Casa', icon: 'home-outline' as const },
  { key: 'work', label: 'Trabajo', icon: 'briefcase-outline' as const },
  { key: 'other', label: 'Otro', icon: 'location-outline' as const },
]

const THEME_OPTIONS: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Claro', icon: 'sunny-outline' },
  { key: 'dark', label: 'Oscuro', icon: 'moon-outline' },
  { key: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
]

/** Secciones colapsables del menú — solo una abierta a la vez. */
type Panel = 'personal' | 'payment' | 'addresses' | 'preferences' | 'security' | 'appearance'

// ── Preferencias de viaje ──────────────────────────────────────────────────
// Referencia de mercado: Uber Black deja fijar temperatura, nivel de
// conversación y ayuda con equipaje; Blacklane ajusta música y temperatura.
// Las notas fijas son propias — hoy el pasajero reescribe "portón azul, no
// tocar bocina" en cada reserva.
interface TripPreferences {
  conversation: string
  temperature: string
  music: string
  luggageHelp: boolean
  standingNotes: string | null
  preferredVehicleTypeId: string | null
}

const PREF_OPTIONS: {
  key: 'conversation' | 'temperature' | 'music'
  label: string
  options: { value: string; label: string }[]
}[] = [
  {
    key: 'conversation',
    label: 'Conversación',
    options: [
      { value: 'no_preference', label: 'Sin preferencia' },
      { value: 'quiet', label: 'Prefiero silencio' },
      { value: 'chatty', label: 'Me gusta conversar' },
    ],
  },
  {
    key: 'temperature',
    label: 'Temperatura',
    options: [
      { value: 'no_preference', label: 'Sin preferencia' },
      { value: 'cool', label: 'Fresco' },
      { value: 'mild', label: 'Templado' },
      { value: 'warm', label: 'Cálido' },
    ],
  },
  {
    key: 'music',
    label: 'Música',
    options: [
      { value: 'no_preference', label: 'Sin preferencia' },
      { value: 'none', label: 'Sin música' },
      { value: 'soft', label: 'Suave' },
      { value: 'driver_choice', label: 'El conductor elige' },
    ],
  },
]

const SETUP_REDIRECT_URL = 'luxeride-passenger://payment-setup-complete'

function formatDob(d: Date): string {
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function parseDob(iso: string | null): Date | null {
  if (!iso) return null
  return new Date(`${iso}T12:00:00Z`)
}

const DEFAULT_DOB = new Date(new Date().getFullYear() - 25, 0, 1)

export function ProfileScreen() {
  const { branding } = useBranding()
  const styles = useThemedStyles(makeStyles)
  const { c, mode, setMode } = useTheme()
  // any: navegación cruzada entre pestañas del Tab.Navigator raíz, sin tipo
  // compartido (mismo patrón que HomeScreen/MyTripsScreen).
  const navigation = useNavigation<any>()

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null)
  const [showDobPicker, setShowDobPicker] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const [ratingAvg, setRatingAvg] = useState<number | null>(null)
  const [ratingCount, setRatingCount] = useState(0)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  // Tarjeta guardada — mismo mecanismo que ya usa el checkout al reservar
  // (setup-card de Whop + búsqueda por teléfono), aquí expuesto como una
  // sección propia para poder guardarla ANTES de reservar.
  const [savedCard, setSavedCard] = useState<{ last4: string | null; brand: string | null } | null>(null)
  const [cardChecked, setCardChecked] = useState(false)
  const [settingUpCard, setSettingUpCard] = useState(false)
  const [cardError, setCardError] = useState('')

  const [prefs, setPrefs] = useState<TripPreferences | null>(null)
  const [vehicleTypes, setVehicleTypes] = useState<{ id: string; name: string }[]>([])
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null)
  const [addingAddress, setAddingAddress] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newAddressText, setNewAddressText] = useState('')
  const [newResolved, setNewResolved] = useState<(PlaceDetails & { placeId: string }) | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)

  const loadAddresses = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('passenger_saved_addresses')
      .select('id, label, address, lat, lng')
      .eq('customer_id', uid)
      .order('created_at', { ascending: true })
    setAddresses((data ?? []) as SavedAddress[])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      setUserId(auth.user.id)
      setEmail(auth.user.email ?? '')
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, phone, date_of_birth')
        .eq('id', auth.user.id)
        .single()
      if (profile) {
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setPhone(profile.phone ?? '')
        setDateOfBirth(parseDob(profile.date_of_birth))
      }

      // Calificación del pasajero: no existe una columna agregada (a
      // diferencia de drivers.rating, que sí tiene trigger) — se promedia
      // en el momento sobre bookings.driver_rating, la misma columna que ya
      // usa /driver/trips para que el conductor califique al pasajero.
      const { data: ratedTrips } = await supabase
        .from('bookings')
        .select('driver_rating')
        .eq('customer_id', auth.user.id)
        .not('driver_rating', 'is', null)
      if (ratedTrips && ratedTrips.length) {
        const sum = ratedTrips.reduce((acc, r) => acc + (r.driver_rating ?? 0), 0)
        setRatingAvg(sum / ratedTrips.length)
        setRatingCount(ratedTrips.length)
      }

      await loadAddresses(auth.user.id)
      setLoading(false)
    }
    load()
  }, [loadAddresses])

  // Refresca direcciones si el usuario agregó una desde "Reservar de nuevo"
  // en otra pestaña y vuelve a Perfil.
  useFocusEffect(
    useCallback(() => {
      if (userId) loadAddresses(userId)
    }, [userId, loadAddresses]),
  )

  function togglePanel(panel: Panel) {
    setOpenPanel((cur) => {
      const next = cur === panel ? null : panel
      // La tarjeta se consulta al abrir la sección, no al montar la pantalla:
      // es una llamada de red que la mayoría de visitas a Perfil no necesita.
      if (next === 'payment' && !cardChecked) checkSavedCard()
      if (next === 'preferences' && !prefs) loadPreferences()
      return next
    })
  }

  async function loadPreferences() {
    const result = await callPassengerApi<{
      preferences?: TripPreferences
      vehicleTypes?: { id: string; name: string }[]
    }>('preferences', { companySlug: process.env.EXPO_PUBLIC_COMPANY_SLUG ?? '' })
    if (result.success && result.preferences) {
      setPrefs(result.preferences)
      setVehicleTypes(result.vehicleTypes ?? [])
    }
  }

  function setPref<K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) {
    setPrefs((cur) => (cur ? { ...cur, [key]: value } : cur))
    setPrefsSaved(false)
  }

  async function savePreferences() {
    if (!prefs) return
    setPrefsSaving(true)
    const result = await callPassengerApi('preferences', { save: true, ...prefs })
    setPrefsSaving(false)
    if (result.success) setPrefsSaved(true)
  }

  async function checkSavedCard() {
    if (!phone.trim()) {
      setCardChecked(true)
      return
    }
    const result = await callPassengerApi<{ found: boolean; card?: { last4: string | null; brand: string | null } }>(
      'saved-card-by-phone',
      { companySlug: process.env.EXPO_PUBLIC_COMPANY_SLUG ?? '', phone: phone.trim() },
    )
    setCardChecked(true)
    setSavedCard(result.found ? (result.card ?? null) : null)
  }

  async function setupCard() {
    setCardError('')
    setSettingUpCard(true)
    const companySlug = process.env.EXPO_PUBLIC_COMPANY_SLUG ?? ''
    const result = await callPassengerApi<{ data?: { url: string } }>('setup-card', {
      companySlug,
      phone: phone.trim(),
    })
    if (!result.success || !result.data?.url) {
      setSettingUpCard(false)
      setCardError(result.error ?? 'No se pudo iniciar el guardado de la tarjeta.')
      return
    }
    await WebBrowser.openAuthSessionAsync(result.data.url, SETUP_REDIRECT_URL)

    // Se consulta el estado real en Whop en vez de asumir: el pasajero
    // necesita saber POR QUÉ no quedó guardada (rechazada, cancelada, el
    // banco pidió un paso extra).
    const status = await callPassengerApi<{ status?: string; errorMessage?: string | null }>('card-setup-status', {
      companySlug,
      phone: phone.trim(),
    })
    if (status.status === 'succeeded') {
      await checkSavedCard()
    } else {
      setCardError(
        status.errorMessage ||
          (status.status === 'canceled'
            ? 'Cancelaste el guardado de la tarjeta.'
            : 'No se pudo confirmar el guardado. Intenta de nuevo.'),
      )
    }
    setSettingUpCard(false)
  }

  function markDirty() {
    setDirty(true)
    setSaved(false)
  }

  function handleDobChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDobPicker(false)
    if (event.type === 'dismissed' || !selected) return
    setDateOfBirth(selected)
    markDirty()
  }

  async function saveProfile() {
    if (!userId) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase
      .from('user_profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
      })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setSaveError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    setDirty(false)
    setSaved(true)
  }

  async function saveAddress() {
    if (!userId || !newResolved || !newLabel.trim()) return
    setSavingAddress(true)
    const { error } = await supabase.from('passenger_saved_addresses').insert({
      customer_id: userId,
      label: newLabel.trim(),
      address: newAddressText,
      lat: newResolved.lat,
      lng: newResolved.lng,
      place_id: newResolved.placeId,
    })
    setSavingAddress(false)
    if (error) return
    setNewLabel('')
    setNewAddressText('')
    setNewResolved(null)
    setAddingAddress(false)
    await loadAddresses(userId)
  }

  async function changePassword() {
    setPasswordError('')
    setPasswordSaved(false)
    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) {
      setPasswordError('No se pudo cambiar la contraseña. Intenta de nuevo.')
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setOpenPanel(null)
    setPasswordSaved(true)
  }

  function confirmDeleteAddress(item: SavedAddress) {
    Alert.alert('Eliminar dirección', `¿Eliminar "${item.label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('passenger_saved_addresses').delete().eq('id', item.id)
          if (userId) loadAddresses(userId)
        },
      },
    ])
  }

  function confirmSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  if (loading) return <ScreenLoader />

  const addressCount = addresses?.length ?? 0
  const themeLabel = THEME_OPTIONS.find((o) => o.key === mode)?.label ?? 'Sistema'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Cabecera de identidad */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <Text style={styles.avatarInitials}>
            {(firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'P'}
          </Text>
        </View>
        <Text style={styles.name}>
          {firstName || 'Pasajero'} {lastName}
        </Text>
        <Text style={styles.email}>{email}</Text>
        {phone ? <Text style={styles.email}>{phone}</Text> : null}
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={ratingAvg != null && n <= Math.round(ratingAvg) ? 'star' : 'star-outline'}
              size={15}
              color={c.gold}
            />
          ))}
          <Text style={styles.ratingText}>
            {ratingAvg != null
              ? `${ratingAvg.toFixed(1)} · ${ratingCount} viaje${ratingCount === 1 ? '' : 's'} calificado${ratingCount === 1 ? '' : 's'}`
              : 'Aún sin calificaciones'}
          </Text>
        </View>
      </View>

      {/* Empresa con la que viaja */}
      <View style={styles.brandRow}>
        <BrandMark size={38} />
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandLabel}>Viajando con</Text>
          <Text style={styles.brandName}>{branding.name}</Text>
        </View>
      </View>

      {/* ── CUENTA ── */}
      <View style={styles.section}>
        <SectionLabel>Cuenta</SectionLabel>

        <MenuRow
          icon="person-outline"
          label="Información personal"
          onPress={() => togglePanel('personal')}
          expanded={openPanel === 'personal'}
        />
        {openPanel === 'personal' && (
          <Card style={styles.panel}>
            <View style={styles.row}>
              <Field
                icon="person-outline"
                placeholder="Nombre"
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v)
                  markDirty()
                }}
                focused={focusedField === 'firstName'}
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
                style={styles.rowItem}
              />
              <Field
                icon="person-outline"
                placeholder="Apellido"
                value={lastName}
                onChangeText={(v) => {
                  setLastName(v)
                  markDirty()
                }}
                focused={focusedField === 'lastName'}
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
                style={styles.rowItem}
              />
            </View>
            <Field
              icon="call-outline"
              placeholder="Teléfono (opcional)"
              value={phone}
              onChangeText={(v) => {
                setPhone(v)
                markDirty()
              }}
              keyboardType="phone-pad"
              focused={focusedField === 'phone'}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
            <FieldButton
              icon="gift-outline"
              label={dateOfBirth ? formatDob(dateOfBirth) : null}
              placeholder="Fecha de nacimiento"
              active={showDobPicker}
              onPress={() => setShowDobPicker(true)}
            />

            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

            {dirty ? (
              <Button label="Guardar cambios" icon="checkmark" onPress={saveProfile} loading={saving} />
            ) : saved ? (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={14} color={c.success} />
                <Text style={styles.savedText}>Cambios guardados</Text>
              </View>
            ) : null}
          </Card>
        )}

        <MenuRow
          icon="card-outline"
          label="Métodos de pago"
          value={savedCard ? `•••• ${savedCard.last4 ?? '····'}` : undefined}
          onPress={() => togglePanel('payment')}
          expanded={openPanel === 'payment'}
        />
        {openPanel === 'payment' && (
          <Card style={styles.panel}>
            {!phone.trim() ? (
              <Text style={styles.panelHint}>
                Agrega tu teléfono en Información personal para poder guardar una tarjeta — es el dato con el que se
                identifica tu método de pago.
              </Text>
            ) : savedCard ? (
              <>
                <View style={styles.cardRow}>
                  <Ionicons name="card" size={18} color={c.gold} />
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardBrand}>
                      {savedCard.brand ?? 'Tarjeta'} •••• {savedCard.last4 ?? '····'}
                    </Text>
                    <Text style={styles.panelHint}>Se usa para cobrar al terminar tus viajes.</Text>
                  </View>
                </View>
                <Button
                  label="Cambiar tarjeta"
                  icon="swap-horizontal"
                  variant="secondary"
                  onPress={setupCard}
                  loading={settingUpCard}
                />
              </>
            ) : (
              <>
                <Text style={styles.panelHint}>
                  Guarda una tarjeta para pagar más rápido y poder elegir &quot;Tarjeta al finalizar&quot; al reservar.
                </Text>
                <Button label="Guardar tarjeta" icon="add" onPress={setupCard} loading={settingUpCard} />
              </>
            )}
            {cardError ? <Text style={styles.error}>{cardError}</Text> : null}
          </Card>
        )}

        <MenuRow
          icon="location-outline"
          label="Direcciones guardadas"
          value={addressCount > 0 ? String(addressCount) : undefined}
          onPress={() => togglePanel('addresses')}
          expanded={openPanel === 'addresses'}
        />
        {openPanel === 'addresses' && (
          <View style={styles.panelStack}>
            {addressCount === 0 && !addingAddress && (
              <Text style={styles.emptyAddresses}>
                Guarda tus direcciones frecuentes para reservar más rápido.
              </Text>
            )}

            {(addresses ?? []).map((item) => (
              <Card key={item.id} style={styles.addressCard}>
                <View style={styles.addressIconWrap}>
                  <Ionicons
                    name={LABEL_PRESETS.find((p) => p.label === item.label)?.icon ?? 'location-outline'}
                    size={16}
                    color={c.gold}
                  />
                </View>
                <View style={styles.addressTextWrap}>
                  <Text style={styles.addressLabel}>{item.label}</Text>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
                <PressableScale onPress={() => confirmDeleteAddress(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={c.inkFaint} />
                </PressableScale>
              </Card>
            ))}

            {addingAddress ? (
              <Card style={styles.panel}>
                <View style={styles.chipRow}>
                  {LABEL_PRESETS.map((p) => (
                    <PressableScale key={p.key} onPress={() => setNewLabel(p.label)} haptic="light">
                      <View style={[styles.chip, newLabel === p.label && styles.chipActive]}>
                        <Ionicons name={p.icon} size={12} color={newLabel === p.label ? c.onGold : c.ink} />
                        <Text style={[styles.chipText, newLabel === p.label && styles.chipTextActive]}>
                          {p.label}
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
                <Field
                  icon="pricetag-outline"
                  placeholder="Nombre (ej. Casa de mamá)"
                  value={newLabel}
                  onChangeText={setNewLabel}
                  focused={focusedField === 'newLabel'}
                  onFocus={() => setFocusedField('newLabel')}
                  onBlur={() => setFocusedField(null)}
                />
                <View style={styles.addressAutocompleteWrap}>
                  <AddressAutocomplete
                    icon="location-outline"
                    placeholder="Buscar dirección"
                    value={newAddressText}
                    onChangeText={(text) => {
                      setNewAddressText(text)
                      setNewResolved(null)
                    }}
                    onSelect={setNewResolved}
                  />
                </View>
                <View style={styles.panelActions}>
                  <PressableScale
                    onPress={() => {
                      setAddingAddress(false)
                      setNewLabel('')
                      setNewAddressText('')
                      setNewResolved(null)
                    }}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </PressableScale>
                  <Button
                    label="Guardar dirección"
                    icon="checkmark"
                    onPress={saveAddress}
                    loading={savingAddress}
                    disabled={!newLabel.trim() || !newResolved}
                    style={styles.flexButton}
                  />
                </View>
              </Card>
            ) : (
              <Button
                label="Agregar dirección"
                icon="add"
                variant="secondary"
                onPress={() => setAddingAddress(true)}
              />
            )}
          </View>
        )}

        <MenuRow
          icon="options-outline"
          label="Preferencias de viaje"
          onPress={() => togglePanel('preferences')}
          expanded={openPanel === 'preferences'}
        />
        {openPanel === 'preferences' && (
          <Card style={styles.panel}>
            {!prefs ? (
              <Text style={styles.panelHint}>Cargando…</Text>
            ) : (
              <>
                <Text style={styles.panelHint}>
                  Tu conductor las ve antes de recogerte. Se aplican a cada viaje que reserves.
                </Text>

                {PREF_OPTIONS.map((group) => (
                  <View key={group.key} style={styles.prefGroup}>
                    <Text style={styles.prefLabel}>{group.label}</Text>
                    <View style={styles.prefChips}>
                      {group.options.map((opt) => {
                        const active = prefs[group.key] === opt.value
                        return (
                          <PressableScale
                            key={opt.value}
                            onPress={() => setPref(group.key, opt.value)}
                            haptic="light"
                          >
                            <View style={[styles.chip, active && styles.chipActive]}>
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                            </View>
                          </PressableScale>
                        )
                      })}
                    </View>
                  </View>
                ))}

                <PressableScale onPress={() => setPref('luggageHelp', !prefs.luggageHelp)} haptic="light">
                  <View style={styles.toggleRow}>
                    <Ionicons
                      name={prefs.luggageHelp ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={prefs.luggageHelp ? c.gold : c.inkFaint}
                    />
                    <Text style={styles.toggleText}>Suelo necesitar ayuda con el equipaje</Text>
                  </View>
                </PressableScale>

                {vehicleTypes.length > 0 && (
                  <View style={styles.prefGroup}>
                    <Text style={styles.prefLabel}>Vehículo preferido</Text>
                    <View style={styles.prefChips}>
                      <PressableScale onPress={() => setPref('preferredVehicleTypeId', null)} haptic="light">
                        <View style={[styles.chip, !prefs.preferredVehicleTypeId && styles.chipActive]}>
                          <Text style={[styles.chipText, !prefs.preferredVehicleTypeId && styles.chipTextActive]}>
                            Sin preferencia
                          </Text>
                        </View>
                      </PressableScale>
                      {vehicleTypes.map((vt) => {
                        const active = prefs.preferredVehicleTypeId === vt.id
                        return (
                          <PressableScale
                            key={vt.id}
                            onPress={() => setPref('preferredVehicleTypeId', vt.id)}
                            haptic="light"
                          >
                            <View style={[styles.chip, active && styles.chipActive]}>
                              <Text style={[styles.chipText, active && styles.chipTextActive]}>{vt.name}</Text>
                            </View>
                          </PressableScale>
                        )
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.prefGroup}>
                  <Text style={styles.prefLabel}>Notas fijas para el conductor</Text>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Ej. portón azul, no tocar bocina, llamar al llegar…"
                    placeholderTextColor={c.inkFaint}
                    value={prefs.standingNotes ?? ''}
                    onChangeText={(v) => setPref('standingNotes', v)}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                  />
                  <Text style={styles.panelHint}>
                    Se agregan al inicio de las instrucciones de cada viaje, para que no las escribas cada vez.
                  </Text>
                </View>

                {prefsSaved ? (
                  <View style={styles.savedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={c.success} />
                    <Text style={styles.savedText}>Preferencias guardadas</Text>
                  </View>
                ) : (
                  <Button label="Guardar preferencias" icon="checkmark" onPress={savePreferences} loading={prefsSaving} />
                )}
              </>
            )}
          </Card>
        )}

        {/* Notificaciones — el centro vive en la pestaña Inicio (su propio
        stack), así que desde aquí se navega cruzando pestañas. */}
        <MenuRow
          icon="notifications-outline"
          label="Notificaciones"
          onPress={() => navigation.navigate('Inicio', { screen: 'Notifications' })}
        />

        <MenuRow
          icon="shield-checkmark-outline"
          label="Seguridad"
          onPress={() => togglePanel('security')}
          expanded={openPanel === 'security'}
        />
        {openPanel === 'security' && (
          <Card style={styles.panel}>
            <Field
              icon="lock-closed-outline"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              focused={focusedField === 'newPassword'}
              onFocus={() => setFocusedField('newPassword')}
              onBlur={() => setFocusedField(null)}
            />
            <Field
              icon="lock-closed-outline"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              focused={focusedField === 'confirmPassword'}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField(null)}
            />
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            <Button
              label="Guardar contraseña"
              icon="checkmark"
              onPress={changePassword}
              loading={changingPassword}
              disabled={!newPassword || !confirmPassword}
            />
          </Card>
        )}
        {passwordSaved && openPanel !== 'security' ? (
          <View style={styles.savedRow}>
            <Ionicons name="checkmark-circle" size={14} color={c.success} />
            <Text style={styles.savedText}>Contraseña actualizada</Text>
          </View>
        ) : null}
      </View>

      {/* ── PREFERENCIAS ── */}
      <View style={styles.section}>
        <SectionLabel>Preferencias</SectionLabel>
        <MenuRow
          icon="color-palette-outline"
          label="Apariencia"
          value={themeLabel}
          onPress={() => togglePanel('appearance')}
          expanded={openPanel === 'appearance'}
        />
        {openPanel === 'appearance' && (
          <Card style={styles.panel}>
            <Text style={styles.panelHint}>
              Elige cómo se ve la app. &quot;Sistema&quot; sigue el ajuste de tu teléfono.
            </Text>
            <View style={styles.themeRow}>
              {THEME_OPTIONS.map((opt) => {
                const active = mode === opt.key
                return (
                  <PressableScale
                    key={opt.key}
                    onPress={() => setMode(opt.key)}
                    haptic="light"
                    style={styles.themeItem}
                  >
                    <View style={[styles.themeOption, active && styles.themeOptionActive]}>
                      <Ionicons name={opt.icon} size={18} color={active ? c.gold : c.inkFaint} />
                      <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={14} color={c.gold} />}
                    </View>
                  </PressableScale>
                )
              })}
            </View>
          </Card>
        )}
      </View>

      {/* ── SOPORTE ── */}
      <View style={styles.section}>
        <SectionLabel>Soporte</SectionLabel>
        <MenuRow
          icon="help-circle-outline"
          label="Centro de ayuda"
          onPress={() => navigation.navigate('Inicio', { screen: 'Help' })}
        />
        {/* Contacto directo con la EMPRESA OPERADORA — el detalle de a quién
        escribir según el caso vive en el Centro de ayuda. */}
        {branding.supportPhone ? (
          <MenuRow
            icon="call-outline"
            label={`Llamar a ${branding.name}`}
            onPress={() => Linking.openURL(`tel:${branding.supportPhone}`)}
          />
        ) : null}
      </View>

      <MenuRow icon="log-out-outline" label="Cerrar sesión" onPress={confirmSignOut} danger />

      {showDobPicker &&
        (Platform.OS === 'android' ? (
          <DateTimePicker
            value={dateOfBirth ?? DEFAULT_DOB}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={handleDobChange}
          />
        ) : (
          <Modal transparent animationType="fade">
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerSheet}>
                <DateTimePicker
                  value={dateOfBirth ?? DEFAULT_DOB}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={handleDobChange}
                />
                <Button label="Listo" onPress={() => setShowDobPicker(false)} />
              </View>
            </View>
          </Modal>
        ))}
    </ScrollView>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: space.lg, gap: space.lg, paddingTop: space.xxl + space.lg, paddingBottom: space.xxxl },
    header: { alignItems: 'center', gap: space.xs },
    avatarRing: {
      width: 76,
      height: 76,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceRaised,
      borderWidth: 2,
      borderColor: c.borderGold,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.sm,
    },
    avatarInitials: { color: c.gold, fontFamily: font.display, fontSize: 26 },
    name: { color: c.ink, fontFamily: font.display, fontSize: 23 },
    email: { color: c.inkFaint, fontFamily: font.body, fontSize: 12.5 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: space.xs },
    ratingText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 11.5, marginLeft: 5 },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    brandTextWrap: { flex: 1 },
    brandLabel: { color: c.inkFaint, fontFamily: font.body, fontSize: 11 },
    brandName: { color: c.ink, fontFamily: font.bodySemi, fontSize: 14 },
    section: { gap: space.sm },
    panel: { gap: space.md },
    panelStack: { gap: space.sm },
    panelHint: { color: c.inkFaint, fontFamily: font.body, fontSize: 12.5, lineHeight: 18 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    cardTextWrap: { flex: 1, gap: 2 },
    cardBrand: { color: c.ink, fontFamily: font.bodySemi, fontSize: 14 },
    prefGroup: { gap: space.sm },
    prefLabel: { color: c.ink, fontFamily: font.bodySemi, fontSize: 13 },
    prefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    toggleText: { flex: 1, color: c.ink, fontFamily: font.body, fontSize: 13.5 },
    textarea: {
      color: c.ink,
      fontFamily: font.body,
      fontSize: 14,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: space.md,
      minHeight: 72,
      textAlignVertical: 'top',
    },
    panelActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    flexButton: { flex: 1 },
    row: { flexDirection: 'row', gap: space.md },
    rowItem: { flex: 1 },
    error: { color: c.danger, fontFamily: font.bodyMedium, fontSize: 12 },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    savedText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
    emptyAddresses: { color: c.inkFaint, fontFamily: font.body, fontSize: 13, paddingHorizontal: space.xs },
    addressCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
    addressIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressTextWrap: { flex: 1 },
    addressLabel: { color: c.ink, fontFamily: font.bodySemi, fontSize: 13 },
    addressText: { color: c.inkFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
    chipRow: { flexDirection: 'row', gap: space.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceRaised,
    },
    chipActive: { backgroundColor: c.gold, borderColor: c.gold },
    chipText: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 12 },
    chipTextActive: { color: c.onGold },
    addressAutocompleteWrap: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      backgroundColor: c.surfaceRaised,
    },
    cancelText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 13 },
    themeRow: { gap: space.sm },
    themeItem: { width: '100%' },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceRaised,
    },
    themeOptionActive: { borderColor: c.borderGold, backgroundColor: c.goldWash },
    themeOptionText: { flex: 1, color: c.ink, fontFamily: font.bodyMedium, fontSize: 14 },
    themeOptionTextActive: { color: c.gold, fontFamily: font.bodySemi },
    pickerOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    pickerSheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      gap: space.md,
    },
  })
