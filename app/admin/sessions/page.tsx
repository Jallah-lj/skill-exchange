'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Search, Calendar, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const REFRESH_INTERVAL = 30_000

export default function AdminSessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadSessions = useCallback(async () => {
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('*, match_requests!inner(from_user_id, to_user_id, from_profile:profiles!from_user_id(id,name,avatar_url), to_profile:profiles!to_user_id(id,name,avatar_url))')
      .order('scheduled_at', { ascending: false })
    setSessions(sessionsData ?? [])
    setLastRefreshed(new Date())
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSessions()
    intervalRef.current = setInterval(loadSessions, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [loadSessions])

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (query) {
        const m = s.match_requests as any
        const names = [m?.from_profile?.name, m?.to_profile?.name, s.skill_focus].join(' ').toLowerCase()
        if (!names.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [sessions, query, statusFilter])

  const total = sessions.length
  const scheduled = sessions.filter((s) => s.status === 'scheduled').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const cancelled = sessions.filter((s) => s.status === 'cancelled').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions Oversight</h1>
          <p className="text-sm text-muted-foreground mt-1">All skill-swap sessions across the platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 text-violet-500" />
            <span>Auto-refresh in <span className="font-semibold text-violet-600">{countdown}s</span></span>
            {lastRefreshed && (
              <span className="text-muted-foreground/60 hidden sm:inline">
                · {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh now
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, color: 'bg-violet-100 dark:bg-violet-900/30', icon: Calendar, iconColor: 'text-violet-600' },
          { label: 'Upcoming', value: scheduled, color: 'bg-blue-100 dark:bg-blue-900/30', icon: Clock, iconColor: 'text-blue-600' },
          { label: 'Completed', value: completed, color: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle, iconColor: 'text-emerald-600' },
          { label: 'Cancelled', value: cancelled, color: 'bg-gray-100 dark:bg-gray-800', icon: XCircle, iconColor: 'text-gray-500' },
        ].map(({ label, value, color, icon: Icon, iconColor }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 py-4 px-5">
              <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user or skill…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v) }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white dark:bg-gray-900/50">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Participants</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Skill Focus</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Scheduled</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Duration</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((session) => {
                const m = session.match_requests as any
                return (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={m?.from_profile?.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px]">{m?.from_profile?.name?.slice(0,2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mx-1">↔</span>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={m?.to_profile?.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px]">{m?.to_profile?.name?.slice(0,2)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-2 hidden sm:block">
                          <p className="text-xs font-medium leading-none">{m?.from_profile?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m?.to_profile?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{session.skill_focus}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                      <div>{new Date(session.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div>{new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs hidden lg:table-cell">
                      {session.duration_minutes}min
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border-0 capitalize ${
                        session.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : session.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>{session.status}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No sessions match your filters.</div>
          )}
        </div>
      )}
    </div>
  )
}
