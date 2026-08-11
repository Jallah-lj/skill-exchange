import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Auto-approval thresholds
const AUTO_MIN_ACCOUNT_AGE_DAYS = 14
const AUTO_MIN_SESSIONS = 5
const AUTO_MIN_RATING = 4.0

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fullName, idType, documentUrl, reason, notableWork, socialLinks } = body

  if (!fullName?.trim() || !reason?.trim()) {
    return NextResponse.json({ error: 'Full name and reason are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Gather data for auto-approval eligibility check ──────
  const [{ data: profile }, { data: matches }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('match_requests')
      .select('id')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .eq('status', 'accepted'),
  ])

  const matchIds = (matches ?? []).map((m: any) => m.id)

  const [sessions, reviews] = await Promise.all([
    matchIds.length > 0
      ? admin.from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('match_id', matchIds)
          .eq('status', 'completed')
      : Promise.resolve({ count: 0 }),
    admin.from('reviews').select('rating').eq('reviewee_id', user.id),
  ])

  const sessionCount: number = (sessions as any).count ?? 0
  const reviewList: { rating: number }[] = (reviews as any).data ?? []
  const avgRating = reviewList.length
    ? reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length
    : 0

  const accountAgeDays = profile?.created_at
    ? (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0

  // All 5 criteria must pass for instant approval
  const criteria = {
    profileComplete: !!(profile?.name && profile?.bio && profile?.avatar_url),
    accountAge:      accountAgeDays >= AUTO_MIN_ACCOUNT_AGE_DAYS,
    sessions:        sessionCount >= AUTO_MIN_SESSIONS,
    rating:          reviewList.length === 0 || avgRating >= AUTO_MIN_RATING,
    noRestrictions:  !profile?.banned && !profile?.suspended,
  }

  const autoApprove = Object.values(criteria).every(Boolean)

  const now = new Date().toISOString()

  // ── Upsert application ────────────────────────────────────
  const { error: appError } = await admin.from('kyc_applications').upsert(
    {
      user_id:          user.id,
      full_name:        fullName.trim(),
      id_type:          idType ?? 'other',
      document_url:     documentUrl ?? null,
      reason:           reason.trim(),
      notable_work:     notableWork?.trim() || null,
      social_links:     socialLinks ?? {},
      status:           autoApprove ? 'auto_approved' : 'pending',
      auto_approved:    autoApprove,
      reviewed_at:      autoApprove ? now : null,
      rejection_reason: null,
      updated_at:       now,
    },
    { onConflict: 'user_id' }
  )

  if (appError) {
    console.error('kyc_applications upsert:', appError.message)
    return NextResponse.json(
      { error: 'Failed to save application. Make sure the database migration has been run in Supabase.' },
      { status: 500 }
    )
  }

  // ── Update profile ────────────────────────────────────────
  if (autoApprove) {
    await admin.from('profiles').update({
      kyc_status:           'verified',
      identity_verified:    true,
      kyc_rejection_reason: null,
    }).eq('id', user.id)

    // Award verified badge
    await admin.from('user_badges').upsert(
      { user_id: user.id, badge_type: 'verified', awarded_by: null },
      { onConflict: 'user_id,badge_type' }
    )

    return NextResponse.json({
      autoApproved: true,
      criteria,
      message: 'Your account has been instantly verified.',
    })
  }

  await admin.from('profiles').update({
    kyc_status:           'pending',
    kyc_rejection_reason: null,
  }).eq('id', user.id)

  return NextResponse.json({
    autoApproved: false,
    criteria,
    message: 'Your application is under review.',
  })
}
