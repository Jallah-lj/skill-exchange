'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Loader2, Search, RefreshCw, ArrowLeftRight, CheckCircle2,
  XCircle, Clock, AlertTriangle, Eye, Flag, TrendingUp,
  Star, Users, Activity,
} from 'lucide-react'
import Link from 'next/link'

type SwapStatus = 'all' | 'pending' | 'accepted' | 'declined' | 'unmatched'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' },
  accepted:  { label: 'Accepted',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  declined:  { label: 'Declined',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  unmatched: { label: 'Unmatched', color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
}

const TABS: { key: SwapStatus; label: string; icon: React.ElementType }[] = [
  { key: 'all',       label: 'All Swaps', icon: ArrowLeftRight },
  { key: 'pending',   label: 'Pending',   icon: Clock },
  { key: 'accepted',  label: 'Accepted',  icon: CheckCircle2 },
  { key: 'declined',  label: 'Declined',  icon: XCircle },
  { key: 'unmatched', label: 'Unmatched', icon: AlertTriangle },
]

const REFRESH_INTERVAL = 30_000

export default function AdminSwapsPage() {
  const supabase = createClient()
  const [swaps, setSwaps] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<SwapStatus>('all')
  const [query, setQuery] = useState('')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Dispute dialog
  const [disputeSwap, setDisputeSwap] = useState<any>(null)
  const [disputeNotes, setDisputeNotes] = useState('')
  const [disputeLoading, setDisputeLoading] = useState(false)

  // Force complete dialog
  const [forceSwap, setForceSwap] = useState<any>(null)
  const [forceLoading, setForceLoading] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: swapData }, { data: sessionData }] = await Promise.all([
      supabase.from('match_requests')
        .select('*, from_profile:profiles!from_user_id(id,name,avatar_url), to_profile:profiles!to_user_id(id,name,avatar_url)')
        .order('created_at', { ascending: false }),
      supabase.from('sessions').select('match_id, status, skill_focus, scheduled_at'),
    ])
    setSwaps(swapData ?? [])
    setSessions(sessionData ?? [])
    setLastRefreshed(new Date())
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    intervalRef.current = setInterval(loadData, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => setCountdown((c) => c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [loadData])

  const filtered = useMemo(() => {
    return swaps.filter((s) => {
      if (tab !== 'all' && s.status !== tab) return false
      if (query) {
        const names = [s.from_profile?.name, s.to_profile?.name].join(' ').toLowerCase()
        if (!names.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [swaps, tab, query])

  // Stats
  const total     = swaps.length
  const pending   = swaps.filter((s) => s.status === 'pending').length
  const accepted  = swaps.filter((s) => s.status === 'accepted').length
  const declined  = swaps.filter((s) => s.status === 'declined').length
  const unmatched = swaps.filter((s) => s.status === 'unmatched').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const successRate = total > 0 ? Math.round((accepted / total) * 100) : 0

  // Sessions lookup by match_id
  const sessionMap = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const s of sessions) {
      if (!m.has(s.match_id)) m.set(s.match_id, [])
      m.get(s.match_id)!.push(s)
    }
    return m
  }, [sessions])

  const handleForceComplete = async () => {
    if (!forceSwap) return
    setForceLoading(true)
    // Mark all scheduled sessions for this match as completed
    const matchSessions = sessionMap.get(forceSwap.id) ?? []
    const scheduledIds = matchSessions.filter((s) => s.status === 'scheduled').map((s: any) => s.id)

    if (scheduledIds.length === 0) {
      // No sessions — just note it
      toast.info('No scheduled sessions found for this swap')
      setForceLoading(false)
      setForceSwap(null)
      return
    }

    const { error } = await supabase
      .from('sessions').update({ status: 'completed' }).in('id', scheduledIds)
    if (error) {
      toast.error('Failed to force complete')
    } else {
      toast.success(`${scheduledIds.length} session(s) marked as completed`)
      await loadData()
    }
    setForceLoading(false)
    setForceSwap(null)
  }

  const handleDisputeSubmit = async () => {
    if (!disputeSwap || !disputeNotes.trim()) return
    setDisputeLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('disputes').insert({
      match_id: disputeSwap.id,
      reporter_id: user?.id,
      reason: disputeNotes.trim(),
      status: 'investigating',
    })
    if (error) {
      toast.error('Failed to open dispute')
    } else {
      toast.success('Dispute opened — marked as investigating')
    }
    setDisputeLoading(false)
    setDisputeSwap(null)
    setDisputeNotes('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skill Swap Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor and manage all skill swaps on the platform.</p>
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
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total',       value: total,       color: 'bg-violet-600',  icon: ArrowLeftRight },
          { label: 'Pending',     value: pending,     color: 'bg-yellow-500',  icon: Clock },
          { label: 'Accepted',    value: accepted,    color: 'bg-emerald-600', icon: CheckCircle2 },
          { label: 'Declined',    value: declined,    color: 'bg-gray-500',    icon: XCircle },
          { label: 'Unmatched',   value: unmatched,   color: 'bg-red-500',     icon: AlertTriangle },
          { label: 'Sessions Done', value: completed, color: 'bg-blue-600',   icon: Activity },
          { label: 'Success Rate', value: `${successRate}%`, color: 'bg-indigo-600', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="py-3 px-4 flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ key, label, icon: Icon }) => {
          const count = key === 'all' ? total
            : swaps.filter((s) => s.status === key).length
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === key ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' : 'bg-muted text-muted-foreground'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by user name…" className="pl-9" value={query}
          onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* Table */}
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
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Sessions</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((swap) => {
                const swapSessions = sessionMap.get(swap.id) ?? []
                const doneCount = swapSessions.filter((s: any) => s.status === 'completed').length
                return (
                  <tr key={swap.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={swap.from_profile?.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px]">{swap.from_profile?.name?.slice(0,2)}</AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:block">
                          <p className="text-xs font-medium leading-none">{swap.from_profile?.name}</p>
                        </div>
                        <ArrowLeftRight className="h-3 w-3 text-muted-foreground mx-1 shrink-0" />
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={swap.to_profile?.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px]">{swap.to_profile?.name?.slice(0,2)}</AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:block">
                          <p className="text-xs font-medium leading-none">{swap.to_profile?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs">
                        <span className="font-medium">{swapSessions.length}</span>
                        <span className="text-muted-foreground"> total · </span>
                        <span className="text-emerald-600 font-medium">{doneCount}</span>
                        <span className="text-muted-foreground"> done</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(swap.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border-0 ${STATUS_CONFIG[swap.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_CONFIG[swap.status]?.label ?? swap.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* View user profiles */}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="View sender"
                          nativeButton={false} render={<Link href={`/admin/users/${swap.from_user_id}`} />}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {/* Force complete */}
                        {swap.status === 'accepted' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                            title="Force complete sessions" onClick={() => setForceSwap(swap)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Force Complete
                          </Button>
                        )}
                        {/* Investigate dispute */}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                          title="Open dispute investigation" onClick={() => setDisputeSwap(swap)}>
                          <Flag className="h-3.5 w-3.5 mr-1" /> Dispute
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No swaps match your filters.</div>
          )}
        </div>
      )}

      {/* Swap History / Monitoring */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground mb-1">of swap requests accepted</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${successRate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Failed / Dropped Swaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Declined by recipient', value: declined, color: 'text-gray-600' },
              { label: 'Unmatched after acceptance', value: unmatched, color: 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`text-sm font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Session Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Sessions scheduled', value: sessions.filter((s) => s.status === 'scheduled').length },
              { label: 'Sessions completed', value: completed },
              { label: 'Sessions cancelled', value: sessions.filter((s) => s.status === 'cancelled').length },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-bold">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Force Complete Dialog */}
      <Dialog open={!!forceSwap} onOpenChange={() => setForceSwap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Force Complete Swap
            </DialogTitle>
            <DialogDescription>
              This will mark all <strong>scheduled sessions</strong> for this swap as completed. Only use this to resolve stuck or disputed swaps.
            </DialogDescription>
          </DialogHeader>
          {forceSwap && (
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">{forceSwap.from_profile?.name?.slice(0,2)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{forceSwap.from_profile?.name}</span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">{forceSwap.to_profile?.name?.slice(0,2)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{forceSwap.to_profile?.name}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceSwap(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleForceComplete} disabled={forceLoading}>
              {forceLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Force Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={!!disputeSwap} onOpenChange={() => { setDisputeSwap(null); setDisputeNotes('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Flag className="h-5 w-5" /> Investigate Dispute
            </DialogTitle>
            <DialogDescription>
              Open a dispute investigation for this swap. Add your admin notes below.
            </DialogDescription>
          </DialogHeader>
          {disputeSwap && (
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted mb-1">
              <span className="text-sm font-medium">{disputeSwap.from_profile?.name}</span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{disputeSwap.to_profile?.name}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Investigation notes</Label>
            <Textarea
              placeholder="Describe the issue, evidence gathered, parties contacted…"
              value={disputeNotes}
              onChange={(e) => setDisputeNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeSwap(null); setDisputeNotes('') }}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleDisputeSubmit}
              disabled={disputeLoading || !disputeNotes.trim()}>
              {disputeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Open Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
