import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// POST /api/admin/users/[userId]?action=force-logout|delete|reset-password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { userId } = await params
  const { action } = await req.json()

  const adminClient = createAdminClient()

  if (action === 'force-logout') {
    // auth.admin.signOut() takes a session's own JWT, not a user id — there is no
    // admin endpoint to invalidate a user's sessions by id. Rotating their password
    // is the standard workaround: GoTrue revokes all of that user's refresh tokens
    // on a password change, so their session dies the next time it tries to refresh
    // (the client SDK does this proactively, so it happens within minutes, not on
    // its own natural ~1h access-token expiry).
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: randomUUID(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    // profiles.id references auth.users ON DELETE CASCADE, so deleting the auth
    // user alone removes the profile (and everything cascading from it) atomically —
    // no separate profile delete needed, and no window for orphaned state on failure.
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reset-password') {
    const { data: profile } = await adminClient
      .from('profiles').select('id').eq('id', userId).single()
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    // Get email from auth.users
    const { data: authUser } = await adminClient.auth.admin.getUserById(userId)
    if (!authUser?.user?.email) return NextResponse.json({ error: 'No email on record' }, { status: 400 })
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const { error } = await adminClient.auth.resetPasswordForEmail(authUser.user.email, {
      redirectTo: `${origin}/reset-password`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, email: authUser.user.email })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
