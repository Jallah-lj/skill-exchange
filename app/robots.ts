import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/terms', '/privacy', '/guidelines', '/login', '/signup'],
        // Everything behind auth or personal: no reason for crawlers to hit it.
        disallow: ['/admin', '/api', '/chat', '/settings', '/dashboard', '/matches', '/sessions', '/support', '/verify', '/onboarding'],
      },
    ],
  }
}
