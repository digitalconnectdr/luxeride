// ── Notificaciones push (Expo) — nuevo viaje / chat / afiliados ────────────────
// Gratis, sin config de Firebase. El handler fuerza sonido incluso con la app
// abierta (por defecto expo-notifications lo suprime en foreground).
//
// Nota: requiere un projectId de EAS para pedir el token — si el proyecto
// todavía no se vinculó con `eas build`/`eas init`, el registro falla
// silenciosamente (try/catch) sin romper el resto de la app; una vez hecho
// el primer build esto empieza a funcionar solo.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return // los simuladores no reciben push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)

    await supabase
      .from('device_tokens')
      .upsert(
        {
          user_id: userId,
          expo_push_token: tokenResponse.data,
          platform: Platform.OS,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'expo_push_token' },
      )
  } catch (err) {
    console.error('[registerForPushNotifications]', err)
  }
}
