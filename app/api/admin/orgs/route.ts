import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getCallerAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return null
  return { user, admin }
}

// GET — list all organizations with member count and owner name
export async function GET() {
  const ctx = await getCallerAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin } = ctx

  const [{ data: orgs, error }, { data: members }, { data: owners }] = await Promise.all([
    admin.from('organizations').select('*').order('created_at', { ascending: false }),
    admin.from('organization_members').select('organization_id, user_id'),
    admin.from('profiles').select('id, name'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const memberCounts = new Map<string, number>()
  for (const m of (members ?? [])) {
    memberCounts.set(m.organization_id, (memberCounts.get(m.organization_id) ?? 0) + 1)
  }
  const ownerMap = new Map((owners ?? []).map((p: any) => [p.id, p.name]))

  const enriched = (orgs ?? []).map((o: any) => ({
    ...o,
    _member_count: memberCounts.get(o.id) ?? 0,
    _owner_name: o.owner_id ? (ownerMap.get(o.owner_id) ?? null) : null,
  }))

  return NextResponse.json({ orgs: enriched })
}

// PATCH — update org fields (e.g., is_verified)
export async function PATCH(req: NextRequest) {
  const ctx = await getCallerAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin } = ctx

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const allowed = ['is_verified', 'internal_only_swapping', 'name', 'bio', 'website']
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const { error } = await admin.from('organizations').update(safeUpdates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE — delete an organization
export async function DELETE(req: NextRequest) {
  const ctx = await getCallerAdmin()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { admin } = ctx

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await admin.from('organizations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
