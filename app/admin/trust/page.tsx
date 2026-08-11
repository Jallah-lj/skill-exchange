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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Loader2, Search, RefreshCw, ShieldAlert, Flag, AlertTriangle,
  Ban, UserX, Bell, CheckCircle2, MessageSquare, Star,
  UserCheck, GraduationCap, Eye,
} from 'lucide-react'
import Link from 'next/link'

type ReportCategory = 'all' | 'fake_account' | 'spam' | 'harassment' | 'fraud' | 'inappropriate_content' | 'other'
type QueueTab = 'reports' | 'messages' | 'skills' | 'reviews'

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  fake_account:         { label: 'Fake Account',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', icon: UserX },
  spam:                 { label: 'Spam',                  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400', icon: AlertTriangle },
  harassment:           { label: 'Harassment',            color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', icon: Flag },
  fraud:                { label: 'Fraud',                 color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',           icon: ShieldAlert },
  inappropriate_content:{ label: 'Inappropriate Content', color: 'bg-pink-100 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400',       icon: Ban },
  other:                { label: 'Other',                 color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',          icon: Flag },
}

const QUEUE_TABS: { key: QueueTab; label: string; icon: React.ElementType }[] = [
  { key: 'reports',  label: 'User Reports', icon: Flag },
  { key: 'messages', label: 'Messages',     icon: MessageSquare },
  { key: 'skills',   label: 'Skills',       icon: GraduationCap },
  { key: 'reviews',  label: 'Reviews',      icon: Star },
]

const REFRESH_INTERVAL = 30_000

export default function TrustSafetyPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<any[]>([])
  const [flaggedMessages, setFlaggedMessages] = useState<any[]>([])
  const [flaggedSkills, setFlaggedSkills] = useState<any[]>([])
  const [flaggedReviews, setFlaggedReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [queueTab, setQueueTab] = useState<QueueTab>('reports')
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory>('all')
  const [query, setQuery] = useState('')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Action dialog
  const [actionTarget, setActionTarget] = useState<{ userId: string; name: string; reportId?: string } | null>(null)
  const [actionType, setActionType] = useState<'warning' | 'suspend' | 'ban'>('warning')
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: reportData }, { data: msgData }, { data: skillData }, { data: reviewData }] = await Promise.all([
      supabase.from('reports')
        .select('*, reporter:profiles!reporter_id(id,name,avatar_url), reported:profiles!reported_id(id,name,avatar_url)')
        .is('resolved_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('moderation_queue')
        .select('*').eq('target_type', 'message').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('moderation_queue')
        .select('*').eq('target_type', 'skill').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('moderation_queue')
        .select('*').eq('target_type', 'review').eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setReports(reportData ?? [])
    setFlaggedMessages(msgData ?? [])
    setFlaggedSkills(skillData ?? [])
    setFlaggedReviews(reviewData ?? [])
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

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (query) {
        const names = [r.reporter?.name, r.reported?.name, r.reason].join(' ').toLowerCase()
        if (!names.includes(query.toLowerCase())) return false
      }
      return true
    })
  }, [reports, query, categoryFilter])

  // Category counts
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of reports) {
      const cat = r.category ?? 'other'
      m[cat] = (m[cat] ?? 0) + 1
    }
    return m
  }, [reports])

  const dismissReport = async (id: string) => {
    const { error } = await supabase.from('reports').update({
      resolved_at: new Date().toISOString(),
      action_taken: 'dismissed',
    }).eq('id', id)
    if (error) { toast.error('Failed to dismiss'); return }
    setReports((prev) => prev.filter((r) => r.id !== id))
    toast.success('Report dismissed')
  }

  const dismissQueueItem = async (id: string, type: QueueTab) => {
    const { error } = await supabase.from('moderation_queue').update({
      status: 'approved', reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error('Failed'); return }
    if (type === 'messages') setFlaggedMessages((p) => p.filter((m) => m.id !== id))
    if (type === 'skills') setFlaggedSkills((p) => p.filter((s) => s.id !== id))
    if (type === 'reviews') setFlaggedReviews((p) => p.filter((r) => r.id !== id))
    toast.success('Item approved — removed from queue')
  }

  const handleAction = async () => {
    if (!actionTarget || !actionReason.trim()) return
    setActionLoading(true)

    if (actionType === 'warning') {
      // Send warning notification
      const { error } = await supabase.from('notifications').insert({
        user_id: actionTarget.userId,
        type: 'warning',
        title: 'Warning from SkillSwap',
        body: actionReason.trim(),
        href: null,
        entity_id: null,
      })
      if (error) { toast.error('Failed to send warning'); setActionLoading(false); return }
      toast.success(`Warning sent to ${actionTarget.name}`)
    }

    if (actionType === 'suspend') {
      const { error, data } = await supabase
        .from('profiles').update({ suspended: true }).eq('id', actionTarget.userId).select('id').single()
      if (error || !data) { toast.error('Failed to suspend — check admin RLS policy'); setActionLoading(false); return }
      await supabase.from('notifications').insert({
        user_id: actionTarget.userId,
        type: 'account_status',
        title: 'Your account has been suspended',
        body: actionReason.trim(),
      })
      toast.success(`${actionTarget.name} suspended`)
    }

    if (actionType === 'ban') {
      const { error, data } = await supabase
        .from('profiles').update({
          banned: true, banned_reason: actionReason.trim(), banned_at: new Date().toISOString(),
        }).eq('id', actionTarget.userId).select('id').single()
      if (error || !data) { toast.error('Failed to ban — check admin RLS policy'); setActionLoading(false); return }
      await supabase.from('notifications').insert({
        user_id: actionTarget.userId,
        type: 'account_status',
        title: 'Your account has been banned',
        body: actionReason.trim(),
      })
      toast.success(`${actionTarget.name} permanently banned`)
    }

    // Resolve the report if one is tied to this action, and let the reporter know
    if (actionTarget.reportId) {
      await supabase.from('reports').update({
        resolved_at: new Date().toISOString(),
        action_taken: actionType,
      }).eq('id', actionTarget.reportId)

      const report = reports.find((r) => r.id === actionTarget.reportId)
      if (report?.reporter_id) {
        await supabase.from('notifications').insert({
          user_id: report.reporter_id,
          type: 'report_resolved',
          title: 'Your report has been reviewed',
          body: actionType === 'warning' ? 'The user received a warning.'
            : actionType === 'suspend' ? 'The user was suspended.'
            : 'The user was banned.',
        })
      }
      setReports((prev) => prev.filter((r) => r.id !== actionTarget.reportId))
    }

    setActionLoading(false)
    setActionTarget(null)
    setActionReason('')
  }

  const pendingTotal = reports.length + flaggedMessages.length + flaggedSkills.length + flaggedReviews.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500" /> Trust & Safety Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Moderation queue and content safety enforcement.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 text-violet-500" />
            <span>Auto-refresh in <span className="font-semibold text-violet-600">{countdown}s</span></span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Alert banner */}
      {pendingTotal > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-5 py-3.5">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            {pendingTotal} item{pendingTotal > 1 ? 's' : ''} require moderation action
          </p>
        </div>
      )}

      {/* Category breakdown cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const count = categoryCounts[key] ?? 0
          const Icon = cfg.icon
          return (
            <button
              key={key}
              onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key as ReportCategory)}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                categoryFilter === key ? 'ring-2 ring-violet-500 border-violet-300' : ''
              }`}
            >
              <div className={`h-8 w-8 rounded-lg ${cfg.color} flex items-center justify-center mb-2`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-bold">{count}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Queue tabs */}
      <div className="flex gap-1 border-b">
        {QUEUE_TABS.map(({ key, label, icon: Icon }) => {
          const count = key === 'reports' ? reports.length
            : key === 'messages' ? flaggedMessages.length
            : key === 'skills' ? flaggedSkills.length
            : flaggedReviews.length
          return (
            <button
              key={key}
              onClick={() => setQueueTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                queueTab === key
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search (only for reports tab) */}
      {queueTab === 'reports' && (
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by user or reason…" className="pl-9" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          {categoryFilter !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => setCategoryFilter('all')} className="gap-2">
              Clear filter: {CATEGORY_CONFIG[categoryFilter]?.label}
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Reports Queue ── */}
          {queueTab === 'reports' && (
            <div className="space-y-3">
              {filteredReports.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  No pending reports{categoryFilter !== 'all' ? ' in this category' : ''}.
                </div>
              ) : filteredReports.map((report) => {
                const cat = CATEGORY_CONFIG[report.category ?? 'other']
                const CatIcon = cat?.icon ?? Flag
                return (
                  <div key={report.id}
                    className="rounded-xl border bg-white dark:bg-gray-900/50 p-4 flex flex-col sm:flex-row gap-4">
                    {/* Category badge */}
                    <div className={`h-9 w-9 rounded-lg ${cat?.color} flex items-center justify-center shrink-0`}>
                      <CatIcon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] border-0 ${cat?.color}`}>{cat?.label ?? 'Other'}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm mt-1.5 leading-relaxed">{report.reason}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Reporter</span>
                          <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">{report.reporter?.name?.slice(0,2)}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{report.reporter?.name ?? 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Reported</span>
                          <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">{report.reported?.name?.slice(0,2)}</AvatarFallback></Avatar>
                          <span className="text-xs font-medium">{report.reported?.name ?? 'Unknown'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col gap-2 items-start shrink-0">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5"
                        nativeButton={false} render={<Link href={`/admin/users/${report.reported_id}`} />}>
                        <Eye className="h-3 w-3" /> View User
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-yellow-600"
                        onClick={() => {
                          setActionTarget({ userId: report.reported_id, name: report.reported?.name, reportId: report.id })
                          setActionType('warning')
                        }}>
                        <Bell className="h-3 w-3" /> Warn
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-orange-600"
                        onClick={() => {
                          setActionTarget({ userId: report.reported_id, name: report.reported?.name, reportId: report.id })
                          setActionType('suspend')
                        }}>
                        <UserX className="h-3 w-3" /> Suspend
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-red-600"
                        onClick={() => {
                          setActionTarget({ userId: report.reported_id, name: report.reported?.name, reportId: report.id })
                          setActionType('ban')
                        }}>
                        <Ban className="h-3 w-3" /> Ban
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-muted-foreground"
                        onClick={() => dismissReport(report.id)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Messages / Skills / Reviews Queue ── */}
          {(['messages', 'skills', 'reviews'] as QueueTab[]).includes(queueTab) && (
            <div className="space-y-3">
              {(queueTab === 'messages' ? flaggedMessages
                : queueTab === 'skills' ? flaggedSkills
                : flaggedReviews
              ).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  No flagged {queueTab} pending review.
                </div>
              ) : (
                (queueTab === 'messages' ? flaggedMessages
                  : queueTab === 'skills' ? flaggedSkills
                  : flaggedReviews
                ).map((item) => (
                  <div key={item.id}
                    className="rounded-xl border bg-white dark:bg-gray-900/50 p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-[10px] capitalize">{item.target_type}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">ID: {item.target_id}</p>
                      {item.reason && <p className="text-sm mt-1">{item.reason}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-emerald-600"
                        onClick={() => dismissQueueItem(item.id, queueTab)}>
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5 text-red-600"
                        onClick={async () => {
                          await supabase.from('moderation_queue').update({ status: 'removed', reviewed_at: new Date().toISOString() }).eq('id', item.id)
                          if (queueTab === 'messages') setFlaggedMessages((p) => p.filter((m) => m.id !== item.id))
                          if (queueTab === 'skills') setFlaggedSkills((p) => p.filter((s) => s.id !== item.id))
                          if (queueTab === 'reviews') setFlaggedReviews((p) => p.filter((r) => r.id !== item.id))
                          toast.success('Content removed from platform')
                        }}>
                        <Ban className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={() => { setActionTarget(null); setActionReason('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${
              actionType === 'warning' ? 'text-yellow-600'
              : actionType === 'suspend' ? 'text-orange-600'
              : 'text-red-600'
            }`}>
              {actionType === 'warning' && <><Bell className="h-5 w-5" /> Send Warning</>}
              {actionType === 'suspend' && <><UserX className="h-5 w-5" /> Suspend Account</>}
              {actionType === 'ban' && <><Ban className="h-5 w-5" /> Permanently Ban</>}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'warning' && 'The user will receive an in-app notification with your message.'}
              {actionType === 'suspend' && 'The account will be restricted immediately. You can reinstate them later from User Management.'}
              {actionType === 'ban' && 'This is permanent. The user will not be able to log in or create a new account with this email.'}
            </DialogDescription>
          </DialogHeader>
          {actionTarget && (
            <p className="text-sm font-medium bg-muted px-3 py-2 rounded-lg">
              Target: <span className="text-violet-600">{actionTarget.name}</span>
            </p>
          )}
          <div className="space-y-2">
            <Label>
              {actionType === 'warning' ? 'Warning message' : 'Reason'}
              <span className="text-red-500 ml-0.5">*</span>
            </Label>
            <Textarea
              placeholder={
                actionType === 'warning'
                  ? 'e.g. Your recent behaviour violated our community guidelines…'
                  : actionType === 'suspend'
                  ? 'e.g. Multiple confirmed reports of harassment…'
                  : 'e.g. Fraud, confirmed scam activity…'
              }
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionTarget(null); setActionReason('') }}>Cancel</Button>
            <Button
              className={
                actionType === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : actionType === 'suspend' ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
              }
              onClick={handleAction}
              disabled={actionLoading || !actionReason.trim()}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionType === 'warning' ? 'Send Warning'
                : actionType === 'suspend' ? 'Suspend Account'
                : 'Permanently Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
