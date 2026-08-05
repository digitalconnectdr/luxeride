import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Switch, Image, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { uploadDriverAvatar } from '../lib/upload'
import { PressableScale } from '../components/PressableScale'
import { Button, Card, ScreenLoader, TabHeader } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'

async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para actualizar tu foto de perfil.')
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1],
  })
  if (result.canceled || !result.assets?.[0]) return null

  const { url, error } = await uploadDriverAvatar(userId, result.assets[0].uri)
  if (error || !url) {
    Alert.alert('Error', 'No se pudo subir la foto. Intenta de nuevo.')
    return null
  }
  return url
}

export function ProfileScreen() {
  const [email, setEmail] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await supabase.from('drivers').select('is_available, photo_url').eq('id', user.id).maybeSingle()
    setIsAvailable(data?.is_available ?? false)
    setPhotoUrl(data?.photo_url ?? null)
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function toggleAvailability(value: boolean) {
    setIsAvailable(value) // optimista
    setSaving(true)
    const result = await callDriverApi('set-availability', { isAvailable: value })
    setSaving(false)
    if (!result.success) setIsAvailable(!value) // revertir si falla
  }

  async function handleChangePhoto() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setUploadingPhoto(true)
    const url = await pickAndUploadAvatar(user.id)
    if (url) {
      await supabase.from('drivers').update({ photo_url: url }).eq('id', user.id)
      setPhotoUrl(url)
    }
    setUploadingPhoto(false)
  }

  if (loading) return <ScreenLoader />

  const initial = email.trim().charAt(0).toUpperCase() || '?'

  return (
    <View style={styles.container}>
      <TabHeader title="Perfil" />

      <Card style={styles.identityCard}>
        <PressableScale style={styles.avatarWrap} onPress={handleChangePhoto} disabled={uploadingPhoto}>
          {uploadingPhoto ? (
            <View style={styles.avatar}>
              <ActivityIndicator color={color.gold} size="small" />
            </View>
          ) : photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={12} color={color.bg} />
          </View>
        </PressableScale>
        <View style={styles.identityText}>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.roleChip}>
            <Ionicons name="car-sport" size={11} color={color.gold} />
            <Text style={styles.role}>Conductor</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={[styles.rowIconWrap, isAvailable && styles.rowIconWrapActive]}>
            <Ionicons name={isAvailable ? 'radio-button-on' : 'radio-button-off'} size={18} color={isAvailable ? color.success : color.inkFaint} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>En servicio</Text>
            <Text style={styles.rowSubtitle}>
              {isAvailable ? 'Puedes recibir nuevas asignaciones' : 'No recibirás nuevas asignaciones'}
            </Text>
          </View>
          {saving ? (
            <ActivityIndicator color={color.gold} />
          ) : (
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: color.borderStrong, true: color.bronze }}
              thumbColor={isAvailable ? color.gold : color.inkFaint}
            />
          )}
        </View>
      </Card>

      <View style={styles.spacer} />

      <Button
        label="Cerrar sesión"
        icon="log-out-outline"
        variant="danger"
        onPress={() => supabase.auth.signOut()}
        haptic="medium"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg, padding: space.xl, paddingTop: space.lg, gap: space.md },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: `${color.gold}18`,
    borderWidth: 1,
    borderColor: `${color.gold}55`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: `${color.gold}55` },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: color.gold,
    borderWidth: 2,
    borderColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: color.gold, fontFamily: font.display, fontSize: 20 },
  identityText: { flex: 1 },
  email: { color: color.ink, fontFamily: font.bodySemi, fontSize: 15 },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  role: { color: color.gold, fontFamily: font.bodyMedium, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  rowIconWrapActive: { backgroundColor: color.successSoft },
  rowText: { flex: 1, marginRight: space.md },
  rowTitle: { color: color.ink, fontFamily: font.bodySemi, fontSize: 14 },
  rowSubtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 12, marginTop: 2 },
  spacer: { flex: 1 },
})
