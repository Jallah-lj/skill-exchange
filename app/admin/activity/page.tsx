'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Users, HandshakeIcon, Star, ThumbsUp, MessageSquare, Calendar, Flag } from 'lucide-react'

interface ActivityEvent {
  id: string
  type: 'signup' | 'match' | 'session' | 'review' | 'endorsement' | 'message' | 'report'
  description: string
  timestamp: string
  user?: string
  meta?: string
}

const EVENT_CONFIG = {
  signup: { icon: Users, color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600', label: 'Sign-up' },
  match: { icon: HandshakeIcon, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600', label: 'Match' },
  session: { icon: Calendar, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', label: 'Session' },
  review: { icon: Star, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600', label: 'Review' },
  endorsement: { icon: ThumbsUp, color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600', label: 'Endorsement' },
  message: { icon: MessageSquare, color: 'bg-gray-100 dark:bg-gray-800 text-gray-600', label: 'Message' },
  report: { icon: Flag, color: 'bg-red-100 dark:bg-red-900/30 text-red-600', label: 'Report' },
}

export default function AdminActivityPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [
        { data: profiles },
        { data: matches },
        { data: sessions },
        { data: reviews },
        { data: endorsements },
        { data: reports },
      ] = await Promise.all([
        supabase.from('profiles').select('id, name, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('match_requests')
          .select('id, status, created_at, from_profile:profiles!from_user_id(name), to_profile:profiles!to_user_id(name)')
          .eq('status', 'accepted').order('created_at', { ascending: false }).limit(15),
        supabase.from('sessions')
          .select('id, skill_focus, status, scheduled_at, created_at')
          .order('created_at', { ascending: false }).limit(15),
        supabase.from('reviews')
          .select('id, rating, created_at, reviewer:profiles!reviewer_id(name), reviewee:profiles!reviewee_id(name)')
          .order('created_at', { ascending: false }).limit(15),
        supabase.from('endorsements')
          .select('id, skill_name, created_at, endorser:profiles!endorser_id(name), endorsee:profiles!endorsee_id(name)')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('reports')
          .select('id, reason, created_at, reporter:profiles!reporter_id(name), reported:profiles!reported_id(name)')
          .order('created_at', { ascending: false }).limit(10),
      ])

      const allEvents: ActivityEvent[] = [
        ...(profiles ?? []).map((p: any) => ({
          id: `signup-${p.id}`,
          type: 'signup' as const,
          description: `${p.name} joined SkillSwap`,
          timestamp: p.created_at,
          user: p.name,
        })),
        ...(matches ?? []).map((m: any) => ({
          id: `match-${m.id}`,
          type: 'match' as const,
          description: `${(m.from_profile as any)?.name} and ${(m.to_profile as any)?.name} are now matched`,
          timestamp: m.created_at,
        })),
        ...(sessions ?? []).map((s: any) => ({
          id: `session-${s.id}`,
          type: 'session' as const,
          description: `Session scheduled: ${s.skill_focus}`,
          timestamp: s.created_at,
          meta: s.status,
        })),
        ...(reviews ?? []).map((r: any) => ({
          id: `review-${r.id}`,
          type: 'review' as const,
          description: `${(r.reviewer as any)?.name} left a ${r.rating}-star review for ${(r.reviewee as any)?.name}`,
          timestamp: r.created_at,
          meta: `${r.rating}/5`,
        })),
        ...(endorsements ?? []).map((e: any) => ({
          id: `endorse-${e.id}`,
          type: 'endorsement' as const,
          description: `${(e.endorser as any)?.name} endorsed ${(e.endorsee as any)?.name} for ${e.skill_name}`,
          timestamp: e.created_at,
        })),
        ...(reports ?? []).map((r: any) => ({
          id: `report-${r.id}`,
          type: 'report' as const,
          description: `${(r.reporter as any)?.name} reported ${(r.reported as any)?.name}`,
          timestamp: r.created_at,
          meta: r.reason.slice(0, 60) + (r.reason.length > 60 ? '…' : ''),
        })),
      ]

      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(allEvents.slice(0, 80))
      setLoading(false)
    }
    load()
  }, [])

  // Group by date
  const grouped = events.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, ActivityEvent[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">A real-time feed of all platform activity.</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{date}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const cfg = EVENT_CONFIG[event.type]
                  const Icon = cfg.icon
                  return (
                    <div key={event.id}
                      className="flex items-start gap-3 py-2.5 px-4 rounded-lg bg-white dark:bg-gray-900/50 border hover:shadow-sm transition-shadow">
                      <div className={`h-8 w-8 rounded-lg ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.description}</p>
                        {event.meta && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.meta}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`text-[10px] py-0 px-2 h-4 border-0 ${cfg.color}`}>{cfg.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">No activity recorded yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
