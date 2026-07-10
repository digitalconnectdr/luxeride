// ── Notificaciones push (Expo) — nuevo viaje / chat / afiliados ────────────────
// Gratis, sin config de Firebase. El handler fuerza sonido incluso con la app
// abierta (por defecto expo-notifications lo suprime en foreground).
//
// IMPORTANTE — dos requisitos que hoy NO se cumplen (por diseño, hasta que
// el usuario corra su primer build), así que el registro se omite del todo:
//
// 1. Pedir un token de Expo requiere un projectId de EAS en app.json — no
//    existe todavía porque no se corrió `eas build`/`eas init`. Se revisa
//    ESTO PRIMERO, antes de tocar cualquier función de Notifications, para
//    no disparar advertencias del módulo nativo por gusto.
// 2. Desde el SDK 53, Expo Go además dejó de soportar push remoto en
//    Android por completo (lo sacaron del cliente) — aunque hubiera
//    projectId, en Expo Go seguiría sin funcionar. Hace falta un
//    development build (`eas build --profile development`, perfil ya en
//    eas.json) o el APK final.
//
// En cuanto el usuario corra su primer `eas build`, el projectId queda
// escrito en app.json y este código empieza a intentar el registro solo
// (seguirá sin funcionar en Expo Go específicamente, sí en development
// build o APK).

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

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) {
      console.log(
        '[registerForPushNotifications] Sin projectId de EAS todavía (falta el primer `eas build`) — se omite el registro de push.',
      )
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

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId })

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
