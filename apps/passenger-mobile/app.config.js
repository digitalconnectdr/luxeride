// ── Config dinámica (reemplaza app.json) ───────────────────────────────────
// Se necesita JS (no JSON estático) para poder leer la API key nativa de
// Google Maps Android desde el entorno en vez de comprometerla en un
// archivo versionado — Expo CLI carga .env automáticamente antes de
// evaluar este archivo (SDK 49+), así que process.env ya trae el valor de
// GOOGLE_MAPS_ANDROID_API_KEY cuando el usuario lo agregue a su .env.
//
// Esta key es DISTINTA de NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (web, restringida
// por HTTP referrer) y de GOOGLE_MAPS_SERVER_KEY (servidor, sin referrer) —
// el Maps SDK nativo de Android necesita su propia key, restringida por
// package name (com.jprsdigitalconnect.luxeride.passenger) + huella SHA-1
// del keystore de firma. Ver .env.example para cómo generarla. Sin esta
// key, react-native-maps simplemente no renderiza el mapa (resto de la app
// funciona igual).

module.exports = {
  expo: {
    name: 'LuxeRide',
    slug: 'luxeride-passenger',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#faf9f6',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.jprsdigitalconnect.luxeride.passenger',
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY ?? undefined,
      },
    },
    android: {
      package: 'com.jprsdigitalconnect.luxeride.passenger',
      adaptiveIcon: {
        backgroundColor: '#faf9f6',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? undefined,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-font'],
  },
}
