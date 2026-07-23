// ── Perfil — editar datos + direcciones guardadas ──────────────────────────
// user_profiles ya tiene una policy RLS "users_update_own_profile" que deja
// a cualquier usuario actualizar su propia fila (WITH CHECK bloquea cambiar
// role/company_id) — nunca se había usado desde ningún cliente. Se actualiza
// directo desde aquí, solo los 4 campos que este formulario expone (nunca
// avatar_url/metadata/is_active, aunque la policy los permitiría).
// Direcciones guardadas: tabla nueva `passenger_saved_addresses`, RLS propia
// por customer_id — mismo patrón de acceso directo (sin ruta de servidor).

import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Modal, Platform, ScrollView, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { supabase } from '../lib/supabase'
import { useBranding } from '../lib/branding'
import { BrandMark } from '../components/BrandMark'
import { PressableScale } from '../components/PressableScale'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import { Button, Card, Field, FieldButton, SectionLabel, ScreenLoader } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
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
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

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

  if (loading) return <ScreenLoader />

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <BrandMark size={64} />
        <Text style={styles.name}>{firstName || 'Pasajero'} {lastName}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <Card style={styles.brandCard}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={18} color={color.inkFaint} />
          <Text style={styles.infoText}>Viajando con {branding.name}</Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionLabel>Tus datos</SectionLabel>
        <View style={styles.formGap}>
          <View style={styles.row}>
            <Field
              icon="person-outline"
              placeholder="Nombre"
              value={firstName}
              onChangeText={(v) => { setFirstName(v); markDirty() }}
              focused={focusedField === 'firstName'}
              onFocus={() => setFocusedField('firstName')}
              onBlur={() => setFocusedField(null)}
              style={styles.rowItem}
            />
            <Field
              icon="person-outline"
              placeholder="Apellido"
              value={lastName}
              onChangeText={(v) => { setLastName(v); markDirty() }}
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
            onChangeText={(v) => { setPhone(v); markDirty() }}
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
              <Ionicons name="checkmark-circle" size={14} color={color.success} />
              <Text style={styles.savedText}>Cambios guardados</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <SectionLabel>Direcciones guardadas</SectionLabel>
          {!addingAddress && (
            <PressableScale onPress={() => setAddingAddress(true)} hitSlop={8}>
              <View style={styles.addRow}>
                <Ionicons name="add-circle-outline" size={16} color={color.gold} />
                <Text style={styles.addRowText}>Agregar</Text>
              </View>
            </PressableScale>
          )}
        </View>

        {addresses && addresses.length === 0 && !addingAddress && (
          <Text style={styles.emptyAddresses}>Guarda tus direcciones frecuentes para reservar más rápido.</Text>
        )}

        {(addresses ?? []).map((item) => (
          <Card key={item.id} style={styles.addressCard}>
            <View style={styles.addressIconWrap}>
              <Ionicons
                name={LABEL_PRESETS.find((p) => p.label === item.label)?.icon ?? 'location-outline'}
                size={16}
                color={color.gold}
              />
            </View>
            <View style={styles.addressTextWrap}>
              <Text style={styles.addressLabel}>{item.label}</Text>
              <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
            </View>
            <PressableScale onPress={() => confirmDeleteAddress(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={color.inkFaint} />
            </PressableScale>
          </Card>
        ))}

        {addingAddress && (
          <Card style={styles.newAddressCard}>
            <View style={styles.chipRow}>
              {LABEL_PRESETS.map((p) => (
                <PressableScale key={p.key} onPress={() => setNewLabel(p.label)} haptic="light">
                  <View style={[styles.chip, newLabel === p.label && styles.chipActive]}>
                    <Ionicons name={p.icon} size={12} color={newLabel === p.label ? '#fff' : color.ink} />
                    <Text style={[styles.chipText, newLabel === p.label && styles.chipTextActive]}>{p.label}</Text>
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
                onChangeText={(text) => { setNewAddressText(text); setNewResolved(null) }}
                onSelect={setNewResolved}
              />
            </View>
            <View style={styles.newAddressActions}>
              <PressableScale onPress={() => { setAddingAddress(false); setNewLabel(''); setNewAddressText(''); setNewResolved(null) }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </PressableScale>
              <Button
                label="Guardar dirección"
                icon="checkmark"
                onPress={saveAddress}
                loading={savingAddress}
                disabled={!newLabel.trim() || !newResolved}
                style={styles.saveAddressBtn}
              />
            </View>
          </Card>
        )}
      </View>

      <Button
        label="Cerrar sesión"
        variant="secondary"
        icon="log-out-outline"
        onPress={() => supabase.auth.signOut()}
        style={styles.signOut}
      />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  name: { color: color.ink, fontFamily: font.display, fontSize: 22 },
  email: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  brandCard: { flexDirection: 'row' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoText: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 14 },
  section: { gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formGap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  rowItem: { flex: 1 },
  error: { color: color.danger, fontFamily: font.bodyMedium, fontSize: 12 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  savedText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addRowText: { color: color.gold, fontFamily: font.bodySemi, fontSize: 12 },
  emptyAddresses: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextWrap: { flex: 1 },
  addressLabel: { color: color.ink, fontFamily: font.bodySemi, fontSize: 13 },
  addressText: { color: color.inkFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  newAddressCard: { gap: space.md },
  chipRow: { flexDirection: 'row', gap: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  chipActive: { backgroundColor: color.gold, borderColor: color.gold },
  chipText: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 12 },
  chipTextActive: { color: '#fff' },
  addressAutocompleteWrap: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surfaceRaised,
  },
  newAddressActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cancelText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 13 },
  saveAddressBtn: { flex: 1 },
  signOut: { marginTop: space.md },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: color.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
})
