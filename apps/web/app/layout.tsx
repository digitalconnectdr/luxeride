import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import Script from 'next/script'
import '@/styles/globals.css'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'

// Google Analytics 4 — solo se inyecta si hay measurement ID configurado
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

// Search Console — tolera que se pegue la etiqueta <meta .../> completa en la
// env var: extraemos solo el valor de content="..."
const RAW_VERIFICATION = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '').trim()
const GOOGLE_VERIFICATION =
  RAW_VERIFICATION.match(/content=["']([^"']+)["']/)?.[1] ?? RAW_VERIFICATION

// Bing Webmaster Tools — mismo patrón tolerante que Google (msvalidate.01)
const RAW_BING_VERIFICATION = (process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '').trim()
const BING_VERIFICATION =
  RAW_BING_VERIFICATION.match(/content=["']([^"']+)["']/)?.[1] ?? RAW_BING_VERIFICATION

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: `${brand.name} | Premium Transportation Platform`,
    template: `%s | ${brand.name}`,
  },
  description:
    'The professional platform for luxury ground transportation companies. Manage bookings, fleet, drivers, and corporate accounts in one place.',
  keywords: [
    'luxury transportation',
    'chauffeur service',
    'ground transportation',
    'airport transfer',
    'executive travel',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Search Console + Bing Webmaster Tools — metas de verificación (solo si están configuradas)
  verification: {
    google: GOOGLE_VERIFICATION || undefined,
    other: BING_VERIFICATION ? { 'msvalidate.01': BING_VERIFICATION } : undefined,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: brand.name,
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  themeColor: '#141313',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-le-bg font-sans text-le-on-surface dark:bg-sl-bg dark:text-sl-on-surface antialiased">
        {/* Google Analytics 4 (placeholder-safe: sin GA_ID no carga nada) */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
          </>
        )}
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast:
                  'font-sans text-body-md border border-sl-outline-variant bg-sl-surface-high text-sl-on-surface',
                success: '!border-success/30',
                error: '!border-error/30',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
