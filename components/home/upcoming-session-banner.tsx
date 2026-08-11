'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CalendarClock, ArrowRight } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface UpcomingSession {
  id: string
  scheduled_at: string
  duration_minutes: number
  skill_focus: string
  otherUser: Profile
}

function formatSessionTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (date.toDateString() === now.toDateString()) return `Today at ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
}

function isSoon(iso: string): boolean {
  const diffMs = new Date(iso).getTime() - Date.now()
  return diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000
}

export function UpcomingSessionBanner() {
  const supabase = createClient()
  const [session, setSession] = useState<UpcomingSession | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setSession(null); return }

      const { data: matches } = await supabase
        .from('match_requests')
        .select('id, from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
        .eq('status', 'accepted')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)

      const matchIds = (matches ?? []).map((m: any) => m.id)
      if (matchIds.length === 0) { if (!cancelled) setSession(null); return }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, match_id, scheduled_at, duration_minutes, skill_focus, status')
        .in('match_id', matchIds)
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(1)

      const next = sessions?.[0]
      if (!next) { if (!cancelled) setSession(null); return }

      const match = (matches ?? []).find((m: any) => m.id === next.match_id) as any
      const otherUser = match.from_user_id === user.id ? match.to_profile : match.from_profile

      if (!cancelled) {
        setSession({
          id: next.id,
          scheduled_at: next.scheduled_at,
          duration_minutes: next.duration_minutes,
          skill_focus: next.skill_focus,
          otherUser,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (!session) return null

  const soon = isSoon(session.scheduled_at)

  return (
    <Link
      href="/sessions"
      className="mb-6 flex items-center gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 transition-colors hover:border-violet-300 dark:border-violet-900/50 dark:from-violet-950/30 dark:to-fuchsia-950/20 dark:hover:border-violet-800"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <CalendarClock className="h-5 w-5" />
      </div>

      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={session.otherUser?.avatar_url ?? ''} />
        <AvatarFallback>{session.otherUser?.name?.slice(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          Session with {session.otherUser?.name ?? 'your match'} · {session.skill_focus}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatSessionTime(session.scheduled_at)} · {session.duration_minutes} min
          {soon && <span className="ml-1.5 font-medium text-violet-600 dark:text-violet-400">· starting soon</span>}
        </p>
      </div>

      <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1 text-xs">
        View <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  )
}
