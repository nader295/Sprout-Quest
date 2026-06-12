import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RomX Platform - Custom ROM Community',
    short_name: 'RomX',
    description: 'The best place for Custom ROMs. Discover and share ROMs, kernels, and recoveries with the developer community.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07070b',
    theme_color: '#07070b',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
