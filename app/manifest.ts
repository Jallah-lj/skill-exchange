import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SkillSwap — Exchange Skills, Grow Together',
    short_name: 'SkillSwap',
    description:
      'Connect with people who can teach what you want to learn, and teach what they want to know. Pure skill barter.',
    start_url: '/browse',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#2563EB',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
