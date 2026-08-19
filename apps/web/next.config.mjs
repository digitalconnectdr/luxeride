/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@plataforma/ui', '@plataforma/database'],

  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google Maps Static
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
      },
      // Fotografía del landing
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Endpoint de descarga por slug de Unsplash (redirige a images.unsplash.com)
      {
        protocol: 'https',
        hostname: 'unsplash.com',
        pathname: '/photos/**',
      },
    ],
  },

  // Security headers
  async headers() {
    // Directivas CSP comunes a todas las rutas. La única diferencia para /embed
    // es frame-ancestors (allow framing) y la ausencia de X-Frame-Options.
    const baseCsp = [
      "default-src 'self'",
      // https://connect.facebook.net — Meta Pixel (Fase 15, components/booking/meta-pixel-tracker.tsx)
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com https://www.googletagmanager.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // https://www.facebook.com — el pixel de Meta envía el evento vía beacon/img a facebook.com/tr
      "img-src 'self' data: blob: https://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://images.unsplash.com https://www.facebook.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://maps.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com",
    ]

    const commonHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
      },
    ]

    return [
      {
        // Todas las rutas EXCEPTO /embed/* — bloquea el framing por completo.
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          ...commonHeaders,
          {
            key: 'Content-Security-Policy',
            value: [...baseCsp, "frame-ancestors 'none'"].join('; '),
          },
        ],
      },
      {
        // Widget embebible: permite que cualquier sitio del operador lo incruste.
        // Sin X-Frame-Options (incompatible con allow-list); el control es frame-ancestors.
        source: '/embed/:path*',
        headers: [
          ...commonHeaders,
          {
            key: 'Content-Security-Policy',
            value: [...baseCsp, 'frame-ancestors *'].join('; '),
          },
        ],
      },
    ]
  },

  async redirects() {
    return []
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ],
    },
  },
}

export default nextConfig
