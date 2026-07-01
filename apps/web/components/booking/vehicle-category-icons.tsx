// Iconos line-art de CATEGORÍA de vehículo (no representan unidades reales, solo
// el tipo de servicio). Estilo silueta lateral limpia para "Explora por categoría".
// Orden alineado con microsite.categories: sedan, suv, coupe, van, limo, chauffeur.

import type { CSSProperties } from 'react'

const base = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Wheel({ cx, cy, r = 4 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} {...base} />
      <circle cx={cx} cy={cy} r={r * 0.34} {...base} />
    </>
  )
}

function Svg({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 72 38" width="100%" height="100%" style={style} aria-hidden role="img">
      {children}
    </svg>
  )
}

const Sedan = (s?: CSSProperties) => (
  <Svg style={s}>
    <path d="M5 25 C5 21.5 6.5 20.5 10 20.5 L16 20.5 L22 13.8 C23 12.7 24 12.3 25.5 12.3 L40 12.3 C41.6 12.3 42.8 12.8 43.9 14 L49.5 20.5 L62 21 C65.5 21.2 67 22.3 67 25" {...base} />
    <path d="M23 13 L23 20.5 M42 13 L42 20.5" {...base} />
    <Wheel cx={18} cy={26} />
    <Wheel cx={52} cy={26} />
  </Svg>
)

const Suv = (s?: CSSProperties) => (
  <Svg style={s}>
    <path d="M5 24 C5 20 6.5 19 10 19 L15 19 L20 11.5 C21 10.6 22 10.2 23.5 10.2 L44 10.2 C45.6 10.2 46.6 10.7 47.5 11.8 L52 19 L63 19.2 C66.5 19.4 67 20.5 67 24" {...base} />
    <path d="M22 10.7 L22 19 M34 10.4 L34 19 M46 11 L46 19" {...base} />
    <Wheel cx={18} cy={25.5} r={4.5} />
    <Wheel cx={53} cy={25.5} r={4.5} />
  </Svg>
)

const Coupe = (s?: CSSProperties) => (
  <Svg style={s}>
    <path d="M5 25.5 C5 22.5 6.5 21.5 10 21.5 L17 21.5 L25 14.5 C26.5 13.2 28 12.8 30 12.8 L37 12.8 C40 12.8 42 14 44 16.5 L51 21.5 L62 22 C65.5 22.2 67 23 67 25.5" {...base} />
    <path d="M26 14 L26 21.5" {...base} />
    <Wheel cx={18} cy={26.5} />
    <Wheel cx={52} cy={26.5} />
  </Svg>
)

const Van = (s?: CSSProperties) => (
  <Svg style={s}>
    <path d="M5 24 C5 19 6.5 18 10 18 L13 18 L16.5 11 C17.1 9.9 18 9.4 19.4 9.4 L57 9.4 C60 9.4 61.5 10.6 61.5 13.6 L62 18.5 C65.3 18.7 67 19.8 67 24" {...base} />
    <path d="M24 9.6 L24 18 M35 9.4 L35 18 L62 18" {...base} />
    <Wheel cx={17} cy={25.5} r={4.3} />
    <Wheel cx={55} cy={25.5} r={4.3} />
  </Svg>
)

const Limo = (s?: CSSProperties) => (
  <Svg style={s}>
    <path d="M3 25.5 C3 22.7 4 21.7 7 21.7 L12 21.7 L17 15.2 C18 14.1 19 13.7 20.5 13.7 L52 13.7 C53.6 13.7 54.8 14.2 55.9 15.4 L60.5 21.7 L67 22.2 C69.3 22.4 70 23.2 70 25.5" {...base} />
    <path d="M24 14.2 L24 21.7 M33 14 L33 21.7 M42 14 L42 21.7 M51 14.2 L51 21.7" {...base} />
    <Wheel cx={15} cy={26.5} r={3.8} />
    <Wheel cx={59} cy={26.5} r={3.8} />
  </Svg>
)

const Chauffeur = (s?: CSSProperties) => (
  <Svg style={s}>
    {/* gorra */}
    <path d="M28.5 12 Q36 5.5 43.5 12" {...base} />
    <path d="M27 12.5 L33 12.5" {...base} />
    {/* cabeza */}
    <circle cx={36} cy={15.5} r={4.6} {...base} />
    {/* hombros / traje */}
    <path d="M23 33 C23 26 28.5 22 36 22 C43.5 22 49 26 49 33" {...base} />
    {/* solapas + corbata */}
    <path d="M36 22 L32.5 29 M36 22 L39.5 29 M36 24.5 L36 31" {...base} />
  </Svg>
)

const ICONS = [Sedan, Suv, Coupe, Van, Limo, Chauffeur]

export function CategoryIcon({ index, style }: { index: number; style?: CSSProperties }) {
  const Render = ICONS[index % ICONS.length]
  return Render(style)
}
