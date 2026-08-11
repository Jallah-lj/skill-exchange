'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Loader2, CheckCheck, UserX, ExternalLink, Flag, Search,
  AlertTriangle, ShieldCheck, Clock, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import type { NotificationType, Report } from '@/lib/types'

type Priority = 'high' | 'medium' | 'low'

function getPriority(reportedCount: Map<string, number>, reportedId: string): Priority {
  const count = reportedCount.get(reportedId) ?? 1
  if (count >= 3) return 'high'
  if (count >= 2) return 'medium'
  return 'low'
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400', dot: 'bg-red-500' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', dot: 'bg-amber-500' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
}

export default function AdminReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { loadReports() }, [])

  const loadReports = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('*, reporter:profiles!reporter_id(id,name,avatar_url), reported:profiles!reported_id(id,name,avatar_url)')
      .order('created_at', { ascending: false })
    setReports((data as Report[]) ?? [])
    setLoading(false)
  }

  // Count reports per reported user (for priority)
  const reportedCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of reports.filter((r) => !r.resolved_at)) {
      m.set(r.reported_id, (m.get(r.reported_id) ?? 0) + 1)
    }
    return m
  }, [reports])

  const resolve = async (report: Report, action: 'dismissed' | 'warned' | 'suspended') => {
    setActingId(report.id)
    try {
      if (action === 'suspended') {
        const { error } = await supabase.from('profiles').update({ suspended: true }).eq('id', report.reported_id)
        if (error) throw error
      }
      const { error } = await supabase.from('reports').update({
        resolved_at: new Date().toISOString(),
        action_taken: action,
      }).eq('id', report.id)
      if (error) throw error

      const notifications: { user_id: string; type: NotificationType; title: string; body: string }[] = [
        { user_id: report.reporter_id, type: 'report_resolved', title: 'Your report has been reviewed', body: {
          dismissed: 'No action was taken.',
          warned: 'The user received a warning.',
          suspended: 'The user was suspended.',
        }[action] },
      ]
      if (action === 'warned') {
        notifications.push({ user_id: report.reported_id, type: 'warning', title: 'Warning from SkillSwap', body: `Related to a report: ${report.reason}` })
      } else if (action === 'suspended') {
        notifications.push({ user_id: report.reported_id, type: 'account_status', title: 'Your account has been suspended', body: `Related to a report: ${report.reason}` })
      }
      await supabase.from('notifications').insert(notifications)

      setReports((prev) => prev.map((r) => r.id === report.id
        ? { ...r, resolved_at: new Date().toISOString(), action_taken: action } : r
      ))
      toast.success({
        dismissed: 'Report dismissed.',
        warned: 'Warning recorded.',
        suspended: 'User suspended and report resolved.',
      }[action])
    } catch {
      toast.error('Action failed. Try again.')
    }
    setActingId(null)
  }

  const bulkDismiss = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('reports').update({
      resolved_at: new Date().toISOString(), action_taken: 'dismissed',
    }).in('id', ids)
    if (error) { toast.error('Bulk dismiss failed'); setBulkLoading(false); return }
    setReports((prev) => prev.map((r) => ids.includes(r.id)
      ? { ...r, resolved_at: new Date().toISOString(), action_taken: 'dismissed' } : r
    ))
    toast.success(`${ids.length} reports dismissed`)
    setSelectedIds(new Set())
    setBulkLoading(false)
  }

  const pending  = reports.filter((r) => !r.resolved_at)
  const resolved = reports.filter((r) => !!r.resolved_at)

  const filteredPending = pending.filter((r) => {
    if (!query) return true
    const rep = (r.reporter as any)?.name?.toLowerCase() ?? ''
    const rpd = (r.reported as any)?.name?.toLowerCase() ?? ''
    return rep.includes(query.toLowerCase()) || rpd.includes(query.toLowerCase()) || r.reason.toLowerCase().includes(query.toLowerCase())
  })

  const highPriority = filteredPending.filter((r) => getPriority(reportedCount, r.reported_id) === 'high')

  const ReportCard = ({ report }: { report: Report }) => {
    const reporter = report.reporter as any
    const reported = report.reported as any
    const isResolved = !!report.resolved_at
    const isBusy = actingId === report.id
    const priority = getPriority(reportedCount, report.reported_id)
    const pConfig = PRIORITY_CONFIG[priority]

    return (
      <div className={`rounded-xl border bg-white dark:bg-gray-900/50 p-5 space-y-4 transition-all ${
        !isResolved && priority === 'high' ? 'border-red-200 dark:border-red-800' : ''
      } ${selectedIds.has(report.id) ? 'ring-2 ring-violet-500/30' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {!isResolved && (
              <input type="checkbox" className="mt-0.5 rounded"
                checked={selectedIds.has(report.id)}
                onChange={() => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    next.has(report.id) ? next.delete(report.id) : next.add(report.id)
                    return next
                  })
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {!isResolved && (
                  <Badge className={`text-[10px] py-0 px-2 h-4 border-0 ${pConfig.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pConfig.dot} mr-1.5`} />
                    {pConfig.label} priority
                  </Badge>
                )}
                {isResolved && (
                  <Badge className={`text-[10px] py-0 px-2 h-4 border-0 capitalize ${
                    report.action_taken === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-950/30'
                    : report.action_taken === 'warned' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
                  }`}>
                    <CheckCheck className="h-2.5 w-2.5 mr-1" />
                    {report.action_taken}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{report.reason}</p>
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Reporter</p>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={reporter?.avatar_url ?? ''} />
                <AvatarFallback className="text-[10px]">{reporter?.name?.slice(0,2) ?? '?'}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate flex-1">{reporter?.name ?? 'Unknown'}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                nativeButton={false} render={<Link href={`/admin/users/${report.reporter_id}`} />}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${priority === 'high' && !isResolved ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10' : 'bg-muted/30'}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Reported User</p>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={reported?.avatar_url ?? ''} />
                <AvatarFallback className="text-[10px]">{reported?.name?.slice(0,2) ?? '?'}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate flex-1">{reported?.name ?? 'Unknown'}</span>
              {reportedCount.get(report.reported_id) && reportedCount.get(report.reported_id)! > 1 && !isResolved && (
                <Badge className="text-[10px] h-4 px-1.5 bg-red-100 text-red-700 border-0 shrink-0">
                  ×{reportedCount.get(report.reported_id)}
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                nativeButton={false} render={<Link href={`/admin/users/${report.reported_id}`} />}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isResolved && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-muted-foreground h-8"
              disabled={isBusy} onClick={() => resolve(report, 'dismissed')}>
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Dismiss
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs text-amber-600 border-amber-200 h-8"
              disabled={isBusy} onClick={() => resolve(report, 'warned')}>
              <AlertTriangle className="h-3 w-3" /> Warn User
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5 text-xs h-8"
              disabled={isBusy} onClick={() => resolve(report, 'suspended')}>
              <UserX className="h-3 w-3" /> Suspend User
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Moderation</h1>
          <p className="text-sm text-muted-foreground mt-1">Review user-submitted reports and take enforcement action.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Flag className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{highPriority.length}</p>
              <p className="text-xs text-muted-foreground">High priority</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4 px-5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{resolved.length}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + bulk */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by user or reason…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {selectedIds.size > 0 && (
          <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={bulkLoading} onClick={bulkDismiss}>
            {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Dismiss {selectedIds.size} selected
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Pending
              {pending.length > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-5 space-y-3">
            {filteredPending.length === 0 ? (
              <div className="text-center py-20 space-y-3 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto opacity-20" />
                <p className="font-medium">All clear — no pending reports.</p>
              </div>
            ) : (
              filteredPending
                .sort((a, b) => {
                  const pa = getPriority(reportedCount, a.reported_id)
                  const pb = getPriority(reportedCount, b.reported_id)
                  const order = { high: 0, medium: 1, low: 2 }
                  return order[pa] - order[pb]
                })
                .map((r) => <ReportCard key={r.id} report={r} />)
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-5 space-y-3">
            {resolved.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">No resolved reports yet.</p>
            ) : (
              resolved.map((r) => <ReportCard key={r.id} report={r} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
