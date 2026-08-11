import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const url = rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
  const key = rawKey.length > 10 ? rawKey : 'placeholder-anon-key'

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookies set in middleware
          }
        },
      },
    }
  )
}
