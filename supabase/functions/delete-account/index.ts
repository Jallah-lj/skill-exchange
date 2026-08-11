import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Browser sends an OPTIONS preflight before the real POST — must respond 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
  const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the calling user's JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  // Delete via service role (cascades to all DB rows via FK)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Delete user error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
