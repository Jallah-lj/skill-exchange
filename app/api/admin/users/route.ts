import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/users
// Returns all profiles merged with badges and KYC applications for the admin panel.
// Uses the service-role client to bypass RLS entirely.
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the caller is an admin
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch profiles (no join — do it separately to avoid FK dependency issues)
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profilesError) {
    console.error('admin/users profiles error:', profilesError.message)
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  // Fetch badges — gracefully return empty if the table doesn't exist yet
  const { data: badges } = await admin
    .from('user_badges')
    .select('user_id, badge_type')

  // Fetch KYC applications — gracefully return empty if the table doesn't exist yet
  const { data: apps } = await admin
    .from('kyc_applications')
    .select('user_id, status, document_url, created_at, id_type')

  // Group badges by user_id
  const badgeMap = new Map<string, { badge_type: string }[]>()
  for (const b of badges ?? []) {
    const list = badgeMap.get(b.user_id) ?? []
    list.push({ badge_type: b.badge_type })
    badgeMap.set(b.user_id, list)
  }

  // Group applications by user_id
  const appMap = new Map<string, any>()
  for (const a of apps ?? []) appMap.set(a.user_id, a)

  // Merge
  const merged = (profiles ?? []).map((p: any) => ({
    ...p,
    user_badges: badgeMap.get(p.id) ?? [],
    _application: appMap.get(p.id) ?? null,
  }))

  return NextResponse.json({ profiles: merged, apps: apps ?? [] })
}
