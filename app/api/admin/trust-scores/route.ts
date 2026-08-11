import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { userId } = await req.json().catch(() => ({ userId: null }))

  if (userId) {
    // Calculate for a single user
    const score = await calculateTrustScore(adminClient, userId)
    return NextResponse.json({ userId, ...score })
  }

  // Recalculate for all users
  const { data: profiles } = await adminClient.from('profiles').select('id')
  const results: { userId: string; score: number }[] = []

  for (const p of profiles ?? []) {
    const score = await calculateTrustScore(adminClient, p.id)
    results.push({ userId: p.id, score: score.total })
  }

  return NextResponse.json({ recalculated: results.length, results })
}

async function calculateTrustScore(
  client: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<{ total: number; breakdown: Record<string, number> }> {
  const breakdown: Record<string, number> = {}

  // 1. Verification score (max 30)
  const { data: profile } = await client
    .from('profiles')
    .select('identity_verified, phone_verified, kyc_status')
    .eq('id', userId)
    .single()

  let verificationScore = 0
  if (profile?.identity_verified) verificationScore += 15
  if (profile?.phone_verified) verificationScore += 10
  if (profile?.kyc_status === 'verified') verificationScore += 5
  breakdown.verification = verificationScore

  // 2. Completed swaps (max 30, 5 pts each swap up to 6)
  const { count: completedSessions } = await client
    .from('sessions')
    .select('*, match_requests!inner(*)', { count: 'exact', head: true })
    .eq('status', 'completed')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`, { foreignTable: 'match_requests' })

  const swapScore = Math.min(30, (completedSessions ?? 0) * 5)
  breakdown.completed_swaps = swapScore

  // 3. Average rating (max 25)
  const { data: reviewData } = await client
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', userId)

  let ratingScore = 0
  if (reviewData && reviewData.length > 0) {
    const avg = reviewData.reduce((s, r) => s + r.rating, 0) / reviewData.length
    ratingScore = Math.round((avg / 5) * 25)
  }
  breakdown.ratings = ratingScore

  // 4. Badge bonus (max 10, ~2pts per badge)
  const { count: badgeCount } = await client
    .from('user_badges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  const badgeScore = Math.min(10, (badgeCount ?? 0) * 2)
  breakdown.badges = badgeScore

  // 5. Reports penalty (-5 per resolved report with action taken)
  const { count: reportCount } = await client
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('reported_id', userId)
    .not('resolved_at', 'is', null)
    .not('action_taken', 'is', null)

  const reportsPenalty = Math.min(25, (reportCount ?? 0) * 5)
  breakdown.reports_penalty = -reportsPenalty

  const total = Math.max(0, Math.min(100, verificationScore + swapScore + ratingScore + badgeScore - reportsPenalty))
  breakdown.total = total

  // Update profile
  await client
    .from('profiles')
    .update({
      trust_score: total,
      trust_score_breakdown: breakdown,
      trust_score_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  return { total, breakdown }
}
