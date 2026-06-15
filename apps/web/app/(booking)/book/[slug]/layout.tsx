import { MapsProvider } from '@/components/maps/maps-provider'

// El microsite del operador (page.tsx) maneja su propio header/footer premium.
// El layout solo provee MapsProvider para el AddressInput del wizard embebido.
export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <MapsProvider>{children}</MapsProvider>
}
