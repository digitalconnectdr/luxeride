// ── Notificaciones push (Expo) — nuevo viaje / chat / afiliados ────────────────
// Gratis, sin config de Firebase. El handler fuerza sonido incluso con la app
// abierta (por defecto expo-notifications lo suprime en foreground).
//
// Nota 1: requiere un projectId de EAS para pedir el token — si el proyecto
// todavía no se vinculó con `eas build`/`eas init`, el registro falla
// silenciosamente (try/catch) sin romper el resto de la app; una vez hecho
// el primer build esto empieza a funcionar solo.
//
// Nota 2 (importante): desde el SDK 53, Expo Go YA NO soporta push remoto
// en Android (lo sacaron del cliente). Mientras se pruebe con Expo Go esto
// SIEMPRE va a fallar al pedir el token — no es un bug, es una limitación
// de la plataforma. Para probar push de verdad hace falta un development
// build (`eas build --profile development`, perfil ya en eas.json) o el
// APK real de producción, no Expo Go.

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

    if (Constants.appOwnership === 'expo') {
      // Expo Go (SDK 53+) no soporta push remoto — ver nota arriba. Se sale
      // temprano en vez de dejar que getExpoPushTokenAsync tire un error.
      console.log('[registerForPushNotifications] Expo Go no soporta push remoto — probar con un development build.')
      return
    }

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
