import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { uploadDriverDocumentPhoto } from '../lib/upload'
import { Button, Card, ScreenLoader, SectionLabel } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'
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

function DocumentCard({
  icon,
  title,
  number,
  expiry,
  hasPhoto,
  uploading,
  onUpload,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  number?: string | null
  expiry: { label: string; alert: boolean } | null
  hasPhoto: boolean
  uploading: boolean
  onUpload: () => void
}) {
  return (
    <Card>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, expiry?.alert && styles.iconWrapAlert]}>
          <Ionicons name={icon} size={18} color={expiry?.alert ? color.warning : color.gold} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          {number && <Text style={styles.detail}>N° {number}</Text>}
        </View>
        {hasPhoto && (
          <View style={styles.statusPill}>
            <Ionicons name="checkmark-circle" size={13} color={color.success} />
          </View>
        )}
      </View>

      {expiry && (
        <View style={styles.expiryRow}>
          <Ionicons name={expiry.alert ? 'warning' : 'time-outline'} size={13} color={expiry.alert ? color.warning : color.inkFaint} />
          <Text style={[styles.expiryText, expiry.alert && styles.expiryTextAlert]}>{expiry.label}</Text>
        </View>
      )}

      <Button
        label={hasPhoto ? 'Actualizar foto' : 'Tomar foto'}
        icon="camera-outline"
        variant="secondary"
        loading={uploading}
        onPress={onUpload}
        style={styles.uploadButton}
      />
    </Card>
  )
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

  if (loading) return <ScreenLoader />

  const licenseExpiry = expiryInfo(driver?.license_expiry ?? null)
  const permitExpiry = expiryInfo(driver?.chauffeur_permit_expires_at ?? null)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Documentos</Text>
      <SectionLabel>Mantenlos vigentes para seguir recibiendo viajes</SectionLabel>

      <DocumentCard
        icon="card-outline"
        title="Licencia de conducir"
        number={driver?.license_number}
        expiry={licenseExpiry}
        hasPhoto={!!driver?.license_photo_url}
        uploading={uploading === 'license'}
        onUpload={() => handleUpload('license')}
      />

      <DocumentCard
        icon="shield-checkmark-outline"
        title="Seguro / permiso de chofer"
        expiry={permitExpiry}
        hasPhoto={!!driver?.insurance_photo_url}
        uploading={uploading === 'insurance'}
        onUpload={() => handleUpload('insurance')}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, paddingTop: space.lg, gap: space.md, flexGrow: 1 },
  headerTitle: { color: color.ink, fontFamily: font.display, fontSize: 28, marginBottom: -space.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: `${color.gold}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAlert: { backgroundColor: color.warningSoft },
  cardHeaderText: { flex: 1 },
  cardTitle: { color: color.ink, fontFamily: font.bodySemi, fontSize: 15 },
  detail: { color: color.inkFaint, fontFamily: font.body, fontSize: 12, marginTop: 2 },
  statusPill: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: color.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  expiryText: { color: color.inkFaint, fontFamily: font.body, fontSize: 12 },
  expiryTextAlert: { color: color.warning, fontFamily: font.bodyMedium },
  uploadButton: { marginTop: space.lg, paddingVertical: 12 },
})
