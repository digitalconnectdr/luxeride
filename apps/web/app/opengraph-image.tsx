import { ImageResponse } from 'next/og'
import { brand } from '@/lib/brand'

export const runtime = 'edge'
export const alt = `${brand.name} — Premium Transportation Software`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background: '#0c0b0a',
          backgroundImage:
            'radial-gradient(ellipse 60% 60% at 20% 20%, rgba(233,193,118,0.16), transparent 60%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: 'linear-gradient(135deg, #f3d9a4, #c89b4f)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#141313',
            }}
          >
            {brand.name.charAt(0)}
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, color: '#ffffff' }}>{brand.name}</div>
        </div>
        <div style={{ fontSize: 60, fontWeight: 600, color: '#ffffff', lineHeight: 1.15, maxWidth: 980, display: 'flex' }}>
          Premium software for luxury ground transportation
        </div>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.6)', marginTop: 28, maxWidth: 900, display: 'flex' }}>
          Online bookings, live dispatch, payments and corporate accounts — in one platform.
        </div>
      </div>
    ),
    { ...size },
  )
}
