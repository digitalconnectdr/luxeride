# LuxeRide Conductor (app nativa)

Esqueleto Expo/React Native de la app del conductor — login + una pantalla de
viaje activo con el botón de avance. Ver `docs/PHASE-2-MOBILE.md` en la raíz
para el plan completo y qué falta después de este primer slice.

## Requisitos para generar el primer APK

Esto necesita tu propia cuenta (gratis) de Expo — no algo que se pueda hacer
sin tu login.

1. Crea una cuenta en [expo.dev](https://expo.dev) (gratis).
2. Instala el CLI si no lo tienes: `npm install -g eas-cli` (o usa `npx eas-cli`).
3. Desde esta carpeta (`apps/driver-mobile`):
   ```
   eas login
   eas build --platform android --profile apk
   ```
4. EAS compila en la nube (no necesitas Android Studio ni un emulador local)
   y al terminar te da un link para descargar el `.apk`.
5. Sube ese `.apk` a donde quieras que los conductores lo descarguen (tu
   propio sitio, un link directo, etc.) — se instala con "permitir orígenes
   desconocidos" activado en el Android del conductor.

## Desarrollo local (iterar sin generar un APK cada vez)

Con la app **Expo Go** instalada en un Android real (o iPhone) desde su
tienda de apps:

```
npm install
npx expo start
```

Escanea el QR que aparece con la cámara (iOS) o la app Expo Go (Android).
Cambios en el código se reflejan al instante (hot reload), sin rebuild.

## Variables de entorno (`.env`)

- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`: mismos
  valores públicos que usa `apps/web` (no son secretos — el anon key ya
  viaja embebido en el bundle del sitio, la seguridad real la da RLS).
- `EXPO_PUBLIC_API_BASE_URL`: apunta a `https://getluxeride.vercel.app` por
  defecto (producción). Cambialo si quieres probar contra un despliegue de
  `develop` o un `next dev` local en tu red.

## Qué NO tiene todavía (fuera de alcance de este primer slice)

Ver docs/PHASE-2-MOBILE.md, sección "Sprint 1-2 — Driver App", para el resto
de pantallas planeadas (Hoy/timeline, registrar pago en efectivo + firma,
mis ganancias, documentos, disponibilidad, push notifications, etc.).
