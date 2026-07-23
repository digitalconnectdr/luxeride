// ── Notificaciones push (Expo) — conductor asignado / en camino / llegó ────
// Gratis, sin config de Firebase — misma implementación exacta que ya usa
// apps/driver-mobile/lib/push.ts (Expo Push API directa, tabla device_tokens
// compartida). El pasajero YA tiene projectId de EAS desde el primer build
// (app.config.js), así que a diferencia del estado inicial del conductor,
// aquí el registro funciona de una vez en cuanto el usuario acepte el
// permiso — no hace falta esperar un build nuevo para que exista projectId.

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { LogBox, Platform } from 'react-native'
import { supabase } from './supabase'

// Mismo aviso informativo que ya se documentó en driver-mobile — el módulo
// nativo lo imprime solo al inicializarse en Expo Go / sin build propio, no
// rompe nada, solo se apaga el ruido en pantalla.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
])

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
      console.log('[registerForPushNotifications] Sin projectId de EAS — se omite el registro de push.')
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
