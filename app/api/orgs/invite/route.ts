import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/orgs/invite
// Body: { organizationId: string, email: string, role: 'admin' | 'member' }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { organizationId, email, role } = body

  if (!organizationId || !email || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Verify caller has permission (owner/admin of this org)
  const { data: member } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single()
  
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Create Invite
  const { data: invite, error } = await admin
    .from('organization_invites')
    .insert({
      organization_id: organizationId,
      email: email.toLowerCase().trim(),
      inviter_id: user.id,
      role: role,
      status: 'pending'
    })
    .select()
    .single()
  
  if (error) {
    if (error.message.includes('unique')) {
      return NextResponse.json({ error: 'User already invited to this organization' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // TODO: Send actual email invitation via Resend/Postmark/SendGrid
  // For now we just return success
  
  return NextResponse.json({ invite })
}
