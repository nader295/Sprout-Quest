import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 320,
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1d9bf0',
          fontWeight: 900,
          borderRadius: '50%',
          border: '16px solid #1d9bf0',
        }}
      >
        RX
      </div>
    ),
    {
      ...size,
    }
  )
}
