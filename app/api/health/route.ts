import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Liveness + dependency check for uptime monitors and load balancers.
// GET /api/health → 200 {status:'ok'} | 503 {status:'degraded'}
export async function GET() {
  const startedAt = Date.now()
  let database = 'ok'

  try {
    const supabase = await createClient()
    // Cheapest possible round-trip that still proves DB connectivity.
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
    if (error) database = 'error'
  } catch {
    database = 'error'
  }

  const healthy = database === 'ok'
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      database,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
