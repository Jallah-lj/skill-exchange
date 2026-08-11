import { createClient } from '@supabase/supabase-js'

// Server-only — never import this on the client side
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
