'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Sparkles, UserPlus, Clock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProfileWithSkills } from '@/lib/types'

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected'

type SuggestedProfile = ProfileWithSkills & {
  matchedSkills: string[]
  connectionStatus: ConnectionStatus
}

const AVAILABILITY_DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  busy: 'bg-amber-500',
  unavailable: 'bg-red-500',
}

const MAX_SUGGESTIONS = 4
const CANDIDATE_POOL = 60

export function SuggestedMatches() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<SuggestedProfile[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hasSkills, setHasSkills] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setProfiles([]); return }

      const [{ data: mySkillsData }, { data: blockedData }, { data: matchesData }] = await Promise.all([
        supabase.from('user_skills').select('skill_name, type').eq('user_id', user.id),
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
        supabase.from('match_requests')
          .select('from_user_id, to_user_id, status')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
      ])

      const mySkills = mySkillsData ?? []
      if (cancelled) return
      setHasSkills(mySkills.length > 0)

      const myLearnNames = new Set(mySkills.filter(s => s.type === 'learn').map(s => s.skill_name.toLowerCase()))
      const myTeachNames = new Set(mySkills.filter(s => s.type === 'teach').map(s => s.skill_name.toLowerCase()))
      const blockedIds = new Set((blockedData ?? []).map(b => b.blocked_id as string))

      // Anyone already connected (or with a pending request either way) isn't a "suggestion" anymore.
      const excludedIds = new Set<string>()
      for (const m of matchesData ?? []) {
        excludedIds.add(m.from_user_id === user.id ? m.to_user_id : m.from_user_id)
      }

      const { data: candidates } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .eq('appear_offline', false)
        .neq('profile_visibility', 'matched_only')
        .limit(CANDIDATE_POOL)

      const pool = (candidates ?? []).filter(p => !blockedIds.has(p.id) && !excludedIds.has(p.id))
      if (pool.length === 0) { if (!cancelled) setProfiles([]); return }

      const poolIds = pool.map(p => p.id)
      const [{ data: skillsData }, { data: reviewsData }] = await Promise.all([
        supabase.from('user_skills').select('user_id, skill_name, category, type, level, id, description').in('user_id', poolIds),
        supabase.from('reviews').select('reviewee_id, rating').in('reviewee_id', poolIds),
      ])

      const scored: SuggestedProfile[] = pool.map((p) => {
        const userSkills = (skillsData ?? []).filter(s => s.user_id === p.id)
        const teachSkills = userSkills.filter(s => s.type === 'teach')
        const learnSkills = userSkills.filter(s => s.type === 'learn')
        const userReviews = (reviewsData ?? []).filter(r => r.reviewee_id === p.id)

        const matchedSkills = [
          ...teachSkills.filter(s => myLearnNames.has(s.skill_name.toLowerCase())).map(s => s.skill_name),
          ...learnSkills.filter(s => myTeachNames.has(s.skill_name.toLowerCase())).map(s => s.skill_name),
        ]

        return {
          ...p,
          teach_skills: teachSkills,
          learn_skills: learnSkills,
          avg_rating: userReviews.length ? userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length : undefined,
          review_count: userReviews.length,
          matchedSkills,
          connectionStatus: 'none',
        }
      })

      // Skill-matched profiles first (best overlap first), then backfill with
      // available + highly-rated profiles so the strip is never empty just
      // because the viewer hasn't set up skills yet.
      const withMatch = scored.filter(p => p.matchedSkills.length > 0).sort((a, b) => b.matchedSkills.length - a.matchedSkills.length)
      const withoutMatch = scored
        .filter(p => p.matchedSkills.length === 0)
        .sort((a, b) => {
          if (a.availability === 'available' && b.availability !== 'available') return -1
          if (b.availability === 'available' && a.availability !== 'available') return 1
          return (b.avg_rating ?? 0) - (a.avg_rating ?? 0)
        })

      const combined = [...withMatch, ...withoutMatch].slice(0, MAX_SUGGESTIONS)
      if (!cancelled) setProfiles(combined)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const connect = async (profile: SuggestedProfile) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sign in to connect'); return }

    setBusyId(profile.id)
    const { error } = await supabase.from('match_requests').upsert(
      { from_user_id: user.id, to_user_id: profile.id, status: 'pending' },
      { onConflict: 'from_user_id,to_user_id' },
    )
    if (error) {
      toast.error('Failed to send request')
    } else {
      toast.success(`Connection request sent to ${profile.name}!`)
      setProfiles((prev) => prev?.map(p => p.id === profile.id ? { ...p, connectionStatus: 'pending_sent' } : p) ?? prev)
    }
    setBusyId(null)
  }

  if (profiles === null) {
    return (
      <div className="mb-6">
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 w-44 shrink-0 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (profiles.length === 0) return null

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Suggested for you
        </h2>
        <Link href="/browse" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Browse all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {!hasSkills && (
        <Link
          href="/profile"
          className="mb-3 block rounded-lg border border-dashed p-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Add skills to your profile to get suggestions tailored to what you teach and want to learn →
        </Link>
      )}

      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1">
        {profiles.map((p) => (
          <div key={p.id} className="flex w-44 shrink-0 flex-col rounded-xl border bg-card p-3">
            <Link href={`/profile/${p.id}`} className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={p.avatar_url ?? ''} />
                  <AvatarFallback>{p.name?.slice(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                {p.availability && (
                  <span className={cn('absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card', AVAILABILITY_DOT[p.availability])} />
                )}
              </div>
              <p className="mt-2 w-full truncate text-sm font-medium">{p.name}</p>
              <p className="w-full truncate text-[11px] text-muted-foreground">
                {p.headline || p.location || 'SkillSwap member'}
              </p>
            </Link>

            {p.matchedSkills.length > 0 ? (
              <Badge variant="secondary" className="mt-2 w-full justify-center truncate text-[10px] font-normal">
                {p.matchedSkills[0]}
              </Badge>
            ) : (
              <div className="mt-2 h-[21px]" />
            )}

            <Button
              size="sm"
              variant={p.connectionStatus === 'pending_sent' ? 'outline' : 'default'}
              disabled={busyId === p.id || p.connectionStatus === 'pending_sent'}
              onClick={() => connect(p)}
              className="mt-2.5 h-7 w-full gap-1 text-xs"
            >
              {p.connectionStatus === 'pending_sent' ? (
                <><Clock className="h-3 w-3" /> Requested</>
              ) : (
                <><UserPlus className="h-3 w-3" /> Connect</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
