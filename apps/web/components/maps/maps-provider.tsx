'use client'

import { useEffect, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface MapsProviderProps {
  children: React.ReactNode
}

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

/**
 * Carga la Google Maps JavaScript API una sola vez para toda la app.
 *
 * Maneja gm_authFailure: cuando la API key es rechazada (referrer no
 * autorizado, Places API deshabilitada o billing inactivo), Google
 * DESHABILITA los inputs de autocomplete. Aquí emitimos un evento para
 * que AddressInput se re-habilite y muestre un aviso útil en vez de
 * quedar bloqueado.
 */
export function MapsProvider({ children }: MapsProviderProps) {
  const [language, setLanguage] = useState('es')

  useEffect(() => {
    // Idioma del JS API según la cookie de locale
    const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`))
    if (match && isLocale(match[1])) setLanguage(match[1])

    // Hook global de fallo de autenticación de Google Maps
    window.gm_authFailure = () => {
      console.error(
        '[Maps] Google Maps rechazó la API key en este dominio. ' +
          'Revisa: restricciones de referrer del key, Places API habilitada y billing activo.',
      )
      window.dispatchEvent(new Event('luxeride:gm-auth-failure'))
    }
  }, [])

  return (
    <APIProvider
      apiKey={API_KEY}
      libraries={['places', 'routes', 'geometry']}
      language={language}
      region="DO"
    >
      {children}
    </APIProvider>
  )
}
