'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Clock, CheckCircle2, XCircle, MessageSquare, Undo2, History } from 'lucide-react'
import type { Organization, OrganizationJoinRequest } from '@/lib/types'
import { sendOrgNotifications, cooldownDaysLeft } from '@/lib/org-notifications'

const COOLDOWN_OPTIONS = [7, 14, 30, 60, 90]

interface OrgRequestsTabProps {
  org: Organization
  requests: OrganizationJoinRequest[]
  memberCount: number
  onRequestsChanged: (updater: (prev: OrganizationJoinRequest[]) => OrganizationJoinRequest[]) => void
  onApproved: () => void
  onContact: (userId: string, name?: string) => void
}

export function OrgRequestsTab({ org, requests, memberCount, onRequestsChanged, onApproved, onContact }: OrgRequestsTabProps) {
  const supabase = createClient()

  const [declining, setDeclining] = useState<OrganizationJoinRequest | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [cooldownDays, setCooldownDays] = useState(String(org.reapply_cooldown_days ?? 30))
  const [busy, setBusy] = useState(false)
  const [waivingId, setWaivingId] = useState<string | null>(null)

  const pending = requests.filter((r) => r.status === 'pending')
  const history = requests.filter((r) => r.status !== 'pending')

  const approve = async (req: OrganizationJoinRequest) => {
    if (org.max_members != null && memberCount >= org.max_members) {
      toast.error(`Member limit reached (${org.max_members}) — increase it in settings first`)
      return
    }
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const reviewedAt = new Date().toISOString()
      const { error } = await supabase
        .from('organization_join_requests')
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: reviewedAt })
        .eq('id', req.id)
      if (error) throw error

      const { error: memberErr } = await supabase
        .from('organization_members')
        .upsert(
          { organization_id: org.id, user_id: req.user_id, role: org.default_member_role ?? 'member' },
          { onConflict: 'organization_id,user_id' }
        )
      if (memberErr) throw memberErr

      await sendOrgNotifications([{
        userId: req.user_id,
        type: 'org_request_approved',
        title: `Welcome to ${org.name}!`,
        body: 'Your join request was approved.',
        href: `/orgs/${org.slug}`,
      }])

      onRequestsChanged((prev) => prev.map((r) => r.id === req.id ? { ...r, status: 'approved', reviewed_at: reviewedAt } : r))
      onApproved()
      toast.success(`${req.profile?.name ?? 'User'} approved and added as ${org.default_member_role ?? 'member'}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setBusy(false)
    }
  }

  const openDecline = (req: OrganizationJoinRequest) => {
    setDeclining(req)
    setDeclineReason('')
    setCooldownDays(String(org.reapply_cooldown_days ?? 30))
  }

  const confirmDecline = async () => {
    if (!declining || !declineReason.trim()) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const days = parseInt(cooldownDays, 10)
      const reviewedAt = new Date().toISOString()
      const cooldownUntil = new Date(Date.now() + days * 86_400_000).toISOString()

      const { error } = await supabase
        .from('organization_join_requests')
        .update({
          status: 'declined',
          reviewed_by: user?.id,
          reviewed_at: reviewedAt,
          decline_reason: declineReason.trim(),
          cooldown_days: days,
          cooldown_until: cooldownUntil,
        })
        .eq('id', declining.id)
      if (error) throw error

      await sendOrgNotifications([{
        userId: declining.user_id,
        type: 'org_request_declined',
        title: `${org.name} declined your join request`,
        body: `Reason: ${declineReason.trim()} — you can reapply in ${days} days.`,
        href: `/orgs/${org.slug}`,
      }])

      onRequestsChanged((prev) => prev.map((r) => r.id === declining.id
        ? { ...r, status: 'declined', reviewed_at: reviewedAt, decline_reason: declineReason.trim(), cooldown_days: days, cooldown_until: cooldownUntil }
        : r))
      toast.success('Request declined')
      setDeclining(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline')
    } finally {
      setBusy(false)
    }
  }

  const waiveCooldown = async (req: OrganizationJoinRequest) => {
    setWaivingId(req.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const waivedAt = new Date().toISOString()
      const { error } = await supabase
        .from('organization_join_requests')
        .update({ cooldown_waived_at: waivedAt, cooldown_waived_by: user?.id })
        .eq('id', req.id)
      if (error) throw error

      await sendOrgNotifications([{
        userId: req.user_id,
        type: 'org_cooldown_lifted',
        title: `${org.name} lifted your reapplication restriction`,
        body: 'You can submit a new join request now.',
        href: `/orgs/${org.slug}`,
      }])

      onRequestsChanged((prev) => prev.map((r) => r.id === req.id ? { ...r, cooldown_waived_at: waivedAt } : r))
      toast.success('Restriction lifted — they can reapply immediately')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to lift restriction')
    } finally {
      setWaivingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending requests */}
      <Card className="border-0 ring-1 ring-border shadow-md">
        <CardHeader>
          <CardTitle>Join Requests {pending.length > 0 && `(${pending.length})`}</CardTitle>
          <CardDescription>Approve, decline with a reason, or message the applicant first.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium">No pending requests</p>
              <p className="text-xs text-muted-foreground mt-1">New membership requests will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((req) => (
                <div key={req.id} className="p-4 border rounded-xl space-y-3 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-border">
                        <AvatarImage src={req.profile?.avatar_url ?? ''} />
                        <AvatarFallback className="font-bold bg-violet-100 text-violet-700">
                          {req.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{req.profile?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          Requested {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8"
                        onClick={() => onContact(req.user_id, req.profile?.name)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Message
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                        disabled={busy}
                        onClick={() => approve(req)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600 h-8"
                        disabled={busy}
                        onClick={() => openDecline(req)}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Decline
                      </Button>
                    </div>
                  </div>

                  {req.message && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Why they want to join</p>
                      <p className="text-sm">{req.message}</p>
                    </div>
                  )}
                  {req.skills && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Skills</p>
                      <p className="text-sm text-muted-foreground">{req.skills}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request history */}
      {history.length > 0 && (
        <Card className="border-0 ring-1 ring-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" /> Request history
            </CardTitle>
            <CardDescription>Past decisions, reasons, and waiting periods.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((req) => {
              const daysLeft = cooldownDaysLeft(req)
              return (
                <div key={req.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={req.profile?.avatar_url ?? ''} />
                        <AvatarFallback className="text-xs font-bold">
                          {req.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{req.profile?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          Requested {new Date(req.created_at).toLocaleDateString()}
                          {req.reviewed_at && ` · decided ${new Date(req.reviewed_at).toLocaleDateString()}`}
                          {req.reviewer?.name && ` by ${req.reviewer.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'approved' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-0 gap-1">
                          <XCircle className="h-3 w-3" /> Declined
                        </Badge>
                      )}
                      {daysLeft > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          disabled={waivingId === req.id}
                          onClick={() => waiveCooldown(req)}
                        >
                          {waivingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                          Lift restriction ({daysLeft}d left)
                        </Button>
                      )}
                      {req.status === 'declined' && daysLeft === 0 && req.cooldown_waived_at && (
                        <span className="text-xs text-muted-foreground">restriction lifted</span>
                      )}
                    </div>
                  </div>
                  {req.decline_reason && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Reason:</span> {req.decline_reason}
                      {req.cooldown_days ? ` · ${req.cooldown_days}-day waiting period` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Decline dialog */}
      <Dialog open={declining !== null} onOpenChange={(v) => { if (!v) setDeclining(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline {declining?.profile?.name ?? 'this request'}?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Your profile information is incomplete."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">The applicant will see this reason.</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Waiting period before they can reapply</Label>
              <Select value={cooldownDays} onValueChange={(v) => { if (v) setCooldownDays(v) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COOLDOWN_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days{d === (org.reapply_cooldown_days ?? 30) ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclining(null)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDecline} disabled={busy || !declineReason.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
