import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─── FONT FAMILIES ──────────────────────────────────────────────────────
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      // ─── APPLE WHITE — Luxury Light Design System ───────────────────────────
      // sl-* tokens remapped to Luminous Editorial light palette.
      // All components use sl-* classes — only these values change, zero component edits needed.
      colors: {
        // ─── IVORY — tema aprobado (opción B) ──────────────────────────────
        // Fondo marfil + tarjetas BLANCAS con borde fino cálido. Todos los
        // componentes usan sl-* — cambiar estos valores re-tematiza todo.
        'sl-bg': '#f6f4ef',
        'sl-surface-lowest': '#ffffff',
        'sl-surface-low': '#faf8f3',
        'sl-surface': '#ffffff',
        'sl-surface-high': '#ffffff',
        'sl-surface-highest': '#faf8f3',
        'sl-surface-bright': '#f0ede5',
        // Text — tinta cálida sobre claro
        'sl-on-surface': '#1d1b18',
        'sl-on-surface-variant': '#4e4639',
        'sl-on-surface-muted': '#75716a',
        // Outline — bordes finos cálidos
        'sl-outline': '#75716a',
        'sl-outline-variant': '#e5e1d8',

        // Luminous Editorial — Light Design System
        'le-bg': '#faf9f6',
        'le-surface-lowest': '#ffffff',
        'le-surface-low': '#f4f3f0',
        'le-surface': '#efeeeb',
        'le-surface-high': '#e9e8e5',
        'le-surface-highest': '#e3e2df',
        // Light mode text
        'le-on-surface': '#1a1c1a',
        'le-on-surface-variant': '#4e4639',
        // Light mode outline
        'le-outline': '#7f7667',
        'le-outline-variant': '#d1c5b4',
        'le-hairline': '#e5e4e0',

        // ─── SHARED ACCENT — Champagne Gold ────────────────────────────────
        gold: {
          DEFAULT: '#e9c176',
          light: '#ffdea5',
          dark: '#775a19',
          container: '#604403',
          'on-dark': '#dab36a',
          'on-light': '#6a4e0c',
        },

        // Bronce — versión del dorado LEGIBLE sobre superficies claras.
        // text/border de acento en Ivory; bg-gold sigue champagne en botones.
        // DEFAULT lee de --color-bronze (fallback = dorado de LuxeRide) para
        // que /admin pueda re-temizar el acento con el primary_color de cada
        // operador sin tocar los ~50 archivos que ya usan text-bronze/
        // border-bronze/ring-bronze — ver app/admin/layout.tsx.
        bronze: {
          DEFAULT: 'var(--color-bronze, #8a6520)',
          dark: '#6e4f17',
          light: '#a87f33',
        },

        // Semantic status — desaturated for luxury context
        success: {
          DEFAULT: '#4a7c59',
          light: '#d1e8d8',
          dark: '#2d4f38',
        },
        warning: {
          DEFAULT: '#9c6e1a',
          light: '#fdecc8',
          dark: '#6b4b10',
        },
        error: {
          DEFAULT: '#ba1a1a',
          light: '#ffdad6',
          dark: '#93000a',
        },
        info: {
          DEFAULT: '#1a6291',
          light: '#d1e8f5',
          dark: '#0d3d5c',
        },
      },

      // ─── TYPOGRAPHY SCALE ────────────────────────────────────────────────────
      fontSize: {
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],         // 48px
        'display-lg-mobile': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],  // 32px
        'headline-md': ['2rem', { lineHeight: '1.2' }],                                   // 32px
        'headline-sm': ['1.5rem', { lineHeight: '1.3' }],                                 // 24px
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],                                   // 18px
        'body-md': ['1rem', { lineHeight: '1.5' }],                                       // 16px
        'label-md': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],         // 14px
        'label-sm': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.03em' }],          // 12px
        'label-caps': ['0.75rem', { lineHeight: '1', letterSpacing: '0.1em' }],           // 12px uppercase
      },

      // ─── SPACING ──────────────────────────────────────────────────────────────
      spacing: {
        // 8px base unit multiples
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '30': '7.5rem',   // 120px — section gap
        '120': '30rem',
      },

      maxWidth: {
        'container': '1280px',
        'container-sm': '1200px',
      },

      // ─── BORDER RADIUS ────────────────────────────────────────────────────────
      borderRadius: {
        'sm': '0.25rem',   // 4px
        DEFAULT: '0.5rem', // 8px — standard
        'md': '0.75rem',   // 12px — cards
        'lg': '1rem',      // 16px — large cards
        'xl': '1.5rem',    // 24px
        'full': '9999px',  // pill buttons
      },

      // ─── BOX SHADOW ───────────────────────────────────────────────────────────
      boxShadow: {
        // Dark mode — tonal layering
        'luxury': '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3)',
        'luxury-lg': '0 4px 32px rgba(0,0,0,0.5)',
        'gold-glow': '0 0 0 2px rgba(233,193,118,0.3)',
        'gold-glow-sm': '0 0 0 1px rgba(233,193,118,0.2)',
        // Light mode — minimal
        'editorial': '0 1px 4px rgba(26,28,26,0.03)',
        'editorial-md': '0 2px 12px rgba(26,28,26,0.06)',
      },

      // ─── TRANSITIONS ──────────────────────────────────────────────────────────
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },

      // ─── BACKDROP BLUR ────────────────────────────────────────────────────────
      backdropBlur: {
        'glass': '20px',
      },

      // ─── ANIMATION ────────────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(233,193,118,0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(233,193,118,0.15)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'fade-in-right': 'fade-in-right 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
