import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/badges/auto-award
// Body: { userId?: string }
// Admin-only. If no userId, evaluates all users.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { userId } = body

  let targetIds: string[]
  if (userId) {
    targetIds = [userId]
  } else {
    const { data } = await admin.from('profiles').select('id')
    targetIds = (data ?? []).map((p: any) => p.id)
  }

  // Get platform's earliest user to compute early_adopter cutoff
  const { data: earliest } = await admin
    .from('profiles')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const platformLaunch = earliest?.created_at ? new Date(earliest.created_at) : new Date()
  const earlyAdopterCutoff = new Date(platformLaunch.getTime() + 90 * 24 * 60 * 60 * 1000)

  const results = await Promise.all(targetIds.map((uid) => evaluateBadges(admin, uid, earlyAdopterCutoff)))

  const totalAwarded = results.reduce((s, r) => s + r.awarded.length, 0)
  const totalRevoked = results.reduce((s, r) => s + r.revoked.length, 0)

  return NextResponse.json({
    processed: results.length,
    totalAwarded,
    totalRevoked,
    results: userId ? results : undefined,
  })
}

async function evaluateBadges(admin: any, userId: string, earlyAdopterCutoff: Date) {
  const awarded: string[] = []
  const revoked: string[] = []

  const [
    { data: profile },
    { data: matches },
    { data: currentBadges },
    { data: endorsementsGiven },
    { data: endorsementsReceived },
    { data: reports },
  ] = await Promise.all([
    admin.from('profiles').select('created_at, banned, suspended').eq('id', userId).single(),
    admin.from('match_requests')
      .select('id')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('status', 'accepted'),
    admin.from('user_badges').select('badge_type').eq('user_id', userId),
    admin.from('endorsements').select('id', { count: 'exact', head: true }).eq('endorser_id', userId),
    admin.from('endorsements').select('id', { count: 'exact', head: true }).eq('endorsee_id', userId),
    admin.from('reports').select('id', { count: 'exact', head: true })
      .eq('reported_id', userId)
      .is('resolved_at', null),
  ])

  if (!profile) return { userId, awarded, revoked }

  const matchIds = (matches ?? []).map((m: any) => m.id)

  const [sessions, reviews] = await Promise.all([
    matchIds.length > 0
      ? admin.from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('match_id', matchIds)
          .eq('status', 'completed')
      : Promise.resolve({ count: 0 }),
    admin.from('reviews').select('rating').eq('reviewee_id', userId),
  ])

  const sessionCount: number = (sessions as any).count ?? 0
  const reviewList: { rating: number }[] = (reviews as any).data ?? []
  const avgRating = reviewList.length
    ? reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length
    : 0

  const endorsedCount: number = (endorsementsGiven as any).count ?? 0
  const receivedCount: number = (endorsementsReceived as any).count ?? 0
  const openReports: number = (reports as any).count ?? 0
  const hasNoReports = openReports === 0
  const isEarlyAdopter = new Date(profile.created_at) <= earlyAdopterCutoff

  // Badge criteria (deliberately excludes 'verified' — that's managed by KYC flow)
  const criteria: Record<string, boolean> = {
    early_adopter: isEarlyAdopter,
    top_teacher: sessionCount >= 15 && avgRating >= 4.5,
    top_learner: sessionCount >= 15,
    trusted: sessionCount >= 30 && hasNoReports,
    community_star: endorsedCount >= 10 && receivedCount >= 10,
  }

  const hasBadge = (type: string) => (currentBadges ?? []).some((b: any) => b.badge_type === type)

  for (const [badge, qualifies] of Object.entries(criteria)) {
    if (qualifies && !hasBadge(badge)) {
      const { error } = await admin.from('user_badges').upsert(
        { user_id: userId, badge_type: badge, awarded_by: null },
        { onConflict: 'user_id,badge_type' }
      )
      if (!error) awarded.push(badge)
    } else if (!qualifies && hasBadge(badge)) {
      // Only revoke performance badges — never revoke early_adopter
      if (['top_teacher', 'trusted'].includes(badge)) {
        const { error } = await admin.from('user_badges')
          .delete()
          .eq('user_id', userId)
          .eq('badge_type', badge)
        if (!error) revoked.push(badge)
      }
    }
  }

  return { userId, awarded, revoked }
}
