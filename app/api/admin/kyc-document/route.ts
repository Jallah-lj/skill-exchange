import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/kyc-document?userId=xxx
// Returns a short-lived signed URL so the admin can view the uploaded ID document.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify caller is admin
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Get the application document path
  const { data: application } = await admin
    .from('kyc_applications')
    .select('document_url')
    .eq('user_id', userId)
    .single()

  if (!application?.document_url) {
    return NextResponse.json({ error: 'No document found for this user' }, { status: 404 })
  }

  // Generate a signed URL (1 hour expiry)
  const { data: signedUrl, error } = await admin.storage
    .from('kyc-docs')
    .createSignedUrl(application.document_url, 3600)

  if (error || !signedUrl) {
    return NextResponse.json({ error: 'Could not generate document URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signedUrl.signedUrl })
}
