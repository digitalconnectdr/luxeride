import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Switch } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callDriverApi } from '../lib/api'
import { Button, Card, ScreenLoader } from '../components/ui'
import { color, font, radius, space } from '../lib/theme'

export function ProfileScreen() {
  const [email, setEmail] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await supabase.from('drivers').select('is_available').eq('id', user.id).maybeSingle()
    setIsAvailable(data?.is_available ?? false)
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

  if (loading) return <ScreenLoader />

  const initial = email.trim().charAt(0).toUpperCase() || '?'

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Perfil</Text>

      <Card style={styles.identityCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
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
  headerTitle: { color: color.ink, fontFamily: font.display, fontSize: 28, marginBottom: -space.xs },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
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
