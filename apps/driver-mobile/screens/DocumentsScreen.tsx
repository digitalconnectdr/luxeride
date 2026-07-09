import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { uploadDriverDocumentPhoto } from '../lib/upload'
import type { DriverRow } from '../lib/types'

const DAY_MS = 86_400_000

function expiryInfo(dateStr: string | null): { label: string; alert: boolean } | null {
  if (!dateStr) return null
  const daysLeft = Math.floor((new Date(dateStr).getTime() - Date.now()) / DAY_MS)
  const dateLabel = new Date(dateStr).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
  if (daysLeft < 0) return { label: `Venció el ${dateLabel}`, alert: true }
  if (daysLeft <= 30) return { label: `Vence el ${dateLabel} (en ${daysLeft} días)`, alert: true }
  return { label: `Vence el ${dateLabel}`, alert: false }
}

async function pickAndUpload(userId: string, kind: 'license' | 'insurance'): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara para tomar la foto.')
    return null
  }

  const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
  if (result.canceled || !result.assets?.[0]) return null

  const { path, error } = await uploadDriverDocumentPhoto(userId, kind, result.assets[0].uri)
  if (error) {
    Alert.alert('Error', 'No se pudo subir la foto. Intenta de nuevo.')
    return null
  }
  return path ?? null
}

export function DocumentsScreen() {
  const [driver, setDriver] = useState<DriverRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<'license' | 'insurance' | null>(null)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('drivers')
      .select('id, is_available, total_earnings, total_trips, license_number, license_expiry, license_photo_url, insurance_photo_url, chauffeur_permit_expires_at')
      .eq('id', user.id)
      .maybeSingle()
    setDriver((data as DriverRow | null) ?? null)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function handleUpload(kind: 'license' | 'insurance') {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setUploading(kind)
    const path = await pickAndUpload(user.id, kind)
    if (path) {
      const column = kind === 'license' ? 'license_photo_url' : 'insurance_photo_url'
      await supabase.from('drivers').update({ [column]: path }).eq('id', user.id)
      await load()
    }
    setUploading(null)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e9c176" />
      </View>
    )
  }

  const licenseExpiry = expiryInfo(driver?.license_expiry ?? null)
  const permitExpiry = expiryInfo(driver?.chauffeur_permit_expires_at ?? null)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Licencia de conducir</Text>
        {driver?.license_number && <Text style={styles.detail}>N° {driver.license_number}</Text>}
        {licenseExpiry && (
          <Text style={[styles.detail, licenseExpiry.alert && styles.alertText]}>{licenseExpiry.label}</Text>
        )}
        <Text style={styles.detail}>{driver?.license_photo_url ? '✓ Foto subida' : 'Sin foto subida'}</Text>
        <Pressable style={styles.button} onPress={() => handleUpload('license')} disabled={uploading === 'license'}>
          {uploading === 'license' ? (
            <ActivityIndicator color="#1d1b18" />
          ) : (
            <Text style={styles.buttonText}>📷 {driver?.license_photo_url ? 'Actualizar foto' : 'Tomar foto'}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seguro / permiso de chofer</Text>
        {permitExpiry && (
          <Text style={[styles.detail, permitExpiry.alert && styles.alertText]}>{permitExpiry.label}</Text>
        )}
        <Text style={styles.detail}>{driver?.insurance_photo_url ? '✓ Foto subida' : 'Sin foto subida'}</Text>
        <Pressable style={styles.button} onPress={() => handleUpload('insurance')} disabled={uploading === 'insurance'}>
          {uploading === 'insurance' ? (
            <ActivityIndicator color="#1d1b18" />
          ) : (
            <Text style={styles.buttonText}>📷 {driver?.insurance_photo_url ? 'Actualizar foto' : 'Tomar foto'}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d1b18' },
  content: { padding: 20, paddingTop: 12, gap: 14, flexGrow: 1 },
  center: { flex: 1, backgroundColor: '#1d1b18', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#2a2723', borderRadius: 16, padding: 18, gap: 6 },
  cardTitle: { color: '#f5f2ec', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  detail: { color: '#a8a39a', fontSize: 13 },
  alertText: { color: '#e9a154', fontWeight: '600' },
  button: { backgroundColor: '#e9c176', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#1d1b18', fontWeight: '700', fontSize: 14 },
})
