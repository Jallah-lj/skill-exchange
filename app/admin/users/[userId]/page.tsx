'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Loader2, ArrowLeft, MapPin, Calendar, Star,
  HandshakeIcon, UserX, UserCheck, ShieldCheck, ShieldOff,
  GraduationCap, Lightbulb, Flag, ExternalLink, Phone, Mail,
  BadgeCheck, Lock, Unlock, Ban, Trash2, LogOut,
  Award, Shield, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import type { BadgeType, NotificationType } from '@/lib/types'

const BADGE_CONFIG: Record<BadgeType, { label: string; color: string; icon: React.ElementType }> = {
  verified:       { label: 'Verified',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',     icon: BadgeCheck },
  top_teacher:    { label: 'Top Teacher',    color: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300', icon: Award },
  top_learner:    { label: 'Top Learner',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', icon: GraduationCap },
  trusted:        { label: 'Trusted',        color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',     icon: Shield },
  community_star: { label: 'Community Star', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300', icon: Star },
  early_adopter:  { label: 'Early Adopter',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', icon: Award },
}

const ALL_BADGES: BadgeType[] = ['verified', 'top_teacher', 'top_learner', 'trusted', 'community_star', 'early_adopter']

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Dialog states
  const [banDialog, setBanDialog] = useState(false)
  const [lockDialog, setLockDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [lockReason, setLockReason] = useState('')
  const [lockHours, setLockHours] = useState('24')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    const load = async () => {
      const [
        { data: profile },
        { data: userSkills },
        { data: matchData },
        { data: reviewData },
        { data: reportData },
        { data: badgeData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_skills').select('*').eq('user_id', userId),
        supabase.from('match_requests')
          .select('*, from_profile:profiles!from_user_id(id,name,avatar_url), to_profile:profiles!to_user_id(id,name,avatar_url)')
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('reviews')
          .select('*, reviewer:profiles!reviewer_id(id,name,avatar_url)')
          .eq('reviewee_id', userId).order('created_at', { ascending: false }),
        supabase.from('reports')
          .select('*, reporter:profiles!reporter_id(id,name,avatar_url)')
          .eq('reported_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_badges').select('*').eq('user_id', userId),
      ])

      if (!profile) { router.push('/admin/users'); return }
      setUser(profile)
      setSkills(userSkills ?? [])
      setMatches(matchData ?? [])
      setReviews(reviewData ?? [])
      setReports(reportData ?? [])
      setBadges(badgeData ?? [])

      const acceptedMatchIds = (matchData ?? []).filter((m: any) => m.status === 'accepted').map((m: any) => m.id)
      if (acceptedMatchIds.length > 0) {
        const { data: sessionData } = await supabase.from('sessions').select('*')
          .in('match_id', acceptedMatchIds).order('scheduled_at', { ascending: false }).limit(10)
        setSessions(sessionData ?? [])
      }
      setLoading(false)
    }
    load()
  }, [userId])

  // --- Profile column toggles ---
  const notifyUser = (type: NotificationType, title: string, body?: string) =>
    supabase.from('notifications').insert({ user_id: userId, type, title, body: body ?? null, href: '/profile' })

  const updateProfile = async (
    updates: Record<string, any>,
    successMsg: string,
    notification?: { type: NotificationType; title: string; body?: string }
  ) => {
    setToggling(true)
    const { error, data } = await supabase
      .from('profiles').update(updates).eq('id', userId).select('*').single()
    if (error || !data) {
      toast.error('Update failed')
    } else {
      setUser(data)
      if (notification) await notifyUser(notification.type, notification.title, notification.body)
      toast.success(successMsg)
    }
    setToggling(false)
  }

  const toggleSuspend = () => updateProfile(
    { suspended: !user.suspended },
    user.suspended ? `${user.name} reinstated` : `${user.name} suspended`,
    {
      type: 'account_status',
      title: user.suspended ? 'Your account has been reinstated' : 'Your account has been suspended',
    }
  )

  const toggleDisable = () => updateProfile(
    { disabled: !user.disabled },
    user.disabled ? `${user.name} account enabled` : `${user.name} account disabled`,
    {
      type: 'account_status',
      title: user.disabled ? 'Your account has been re-enabled' : 'Your account has been disabled',
    }
  )

  const toggleRole = () => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    updateProfile(
      { role: newRole },
      newRole === 'admin' ? `${user.name} promoted to Admin` : `${user.name} demoted to User`,
      {
        type: 'role_change',
        title: newRole === 'admin' ? "You've been made an admin" : 'Your admin access has been removed',
      }
    )
  }

  const handleBan = async () => {
    if (!banReason.trim()) { toast.error('Ban reason is required'); return }
    await updateProfile(
      { banned: true, banned_reason: banReason.trim(), banned_at: new Date().toISOString() },
      `${user.name} has been banned`,
      { type: 'account_status', title: 'Your account has been banned', body: banReason.trim() }
    )
    setBanDialog(false)
    setBanReason('')
  }

  const handleUnban = () => updateProfile(
    { banned: false, banned_reason: null, banned_at: null },
    `${user.name} unbanned`,
    { type: 'account_status', title: 'Your account ban has been lifted' }
  )

  const handleLock = async () => {
    const until = new Date(Date.now() + parseInt(lockHours) * 3600000).toISOString()
    await updateProfile(
      { locked_until: until, lock_reason: lockReason.trim() || null },
      `${user.name} locked for ${lockHours}h`,
      {
        type: 'account_status',
        title: 'Your account has been temporarily locked',
        body: lockReason.trim() || `Locked for ${lockHours} hour${lockHours === '1' ? '' : 's'}.`,
      }
    )
    setLockDialog(false)
    setLockReason('')
    setLockHours('24')
  }

  const handleUnlock = () => updateProfile(
    { locked_until: null, lock_reason: null },
    `${user.name} unlocked`,
    { type: 'account_status', title: 'Your account lock has been lifted' }
  )

  // KYC status is the single source of truth for identity verification — it also
  // drives `identity_verified` and the 'verified' badge so all three can't drift
  // out of sync (mirrors the working pattern in app/admin/verification/page.tsx).
  const setKycStatus = async (status: string) => {
    const isVerified = status === 'verified'
    setToggling(true)
    const { error, data } = await supabase
      .from('profiles')
      .update({
        kyc_status: status,
        identity_verified: isVerified,
        kyc_rejection_reason: status === 'rejected' ? user.kyc_rejection_reason : null,
      })
      .eq('id', userId)
      .select('*')
      .single()

    if (error || !data) {
      toast.error('Update failed')
      setToggling(false)
      return
    }
    setUser(data)

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (isVerified) {
      await supabase.from('user_badges').upsert(
        { user_id: userId, badge_type: 'verified', awarded_by: adminUser?.id },
        { onConflict: 'user_id,badge_type' }
      )
    } else {
      await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_type', 'verified')
    }
    const { data: badgeRows } = await supabase.from('user_badges').select('*').eq('user_id', userId)
    setBadges(badgeRows ?? [])

    await notifyUser('kyc_update', isVerified
      ? 'Your identity has been verified'
      : `Your verification status was updated to "${status}"`)

    toast.success(`KYC status set to ${status}`)
    setToggling(false)
  }

  const togglePhoneVerified = () => updateProfile(
    { phone_verified: !user.phone_verified },
    user.phone_verified ? 'Phone verification removed' : 'Phone marked as verified'
  )

  // --- Badge management ---
  // 'verified' is managed through KYC status (see setKycStatus) so it can't drift
  // out of sync with identity_verified/kyc_status.
  const awardBadge = async (badge: BadgeType) => {
    if (badge === 'verified') { await setKycStatus('verified'); return }

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_badges').insert({
      user_id: userId, badge_type: badge, awarded_by: adminUser?.id,
    })
    if (error) { toast.error('Failed to award badge'); return }
    const { data } = await supabase.from('user_badges').select('*').eq('user_id', userId)
    setBadges(data ?? [])
    await notifyUser('badge_awarded', `You've been awarded the "${BADGE_CONFIG[badge].label}" badge`)
    toast.success(`${BADGE_CONFIG[badge].label} badge awarded`)
  }

  const revokeBadge = async (badgeId: string, badgeType: BadgeType) => {
    if (badgeType === 'verified') { await setKycStatus('unverified'); return }

    const { error } = await supabase.from('user_badges').delete().eq('id', badgeId)
    if (error) { toast.error('Failed to revoke badge'); return }
    setBadges((prev) => prev.filter((b) => b.id !== badgeId))
    await notifyUser('badge_revoked', `Your "${BADGE_CONFIG[badgeType].label}" badge was removed`)
    toast.success(`${BADGE_CONFIG[badgeType].label} badge revoked`)
  }

  // --- Server-side actions (need service role key) ---
  const serverAction = async (action: string, label: string) => {
    setActionLoading(action)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (action === 'reset-password') {
        await notifyUser('account_status', 'A password reset was requested for your account',
          'An admin triggered a password reset email on your behalf.')
        toast.success(`Password reset email sent to ${data.email}`)
      } else if (action === 'force-logout') {
        await notifyUser('account_status', 'You were signed out of all devices',
          "An admin ended your active sessions. If your password no longer works, use \"Forgot password\" to regain access.")
        toast.success(`${user.name} will be signed out of all devices shortly`)
      } else if (action === 'delete') {
        toast.success(`${user.name}'s account deleted`)
        router.push('/admin/users')
      }
    } catch (e: any) {
      toast.error(e.message ?? label + ' failed')
    }
    setActionLoading(null)
  }

  const handleDelete = async () => {
    if (deleteConfirm !== user.name) { toast.error('Name does not match'); return }
    await serverAction('delete', 'Delete')
    setDeleteDialog(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  const avgRating = reviews.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : null
  const acceptedMatches = matches.filter((m: any) => m.status === 'accepted').length
  const isLocked = user.locked_until && new Date(user.locked_until) > new Date()
  const ownedBadgeTypes = new Set(badges.map((b: any) => b.badge_type))

  const accountStatus = user.banned ? 'banned'
    : user.disabled ? 'disabled'
    : isLocked ? 'locked'
    : user.suspended ? 'suspended'
    : 'active'

  const statusConfig = {
    active:    { label: 'Active',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' },
    disabled:  { label: 'Disabled',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    locked:    { label: 'Locked',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' },
    banned:    { label: 'Banned',    color: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={() => router.push('/admin/users')}>
        <ArrowLeft className="h-4 w-4" /> Users
      </Button>

      {/* ── Profile Header ── */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Avatar className="h-20 w-20 shrink-0 ring-4 ring-border">
              <AvatarImage src={user.avatar_url ?? ''} />
              <AvatarFallback className="text-2xl font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{user.name}</h2>
                    {user.role === 'admin' && (
                      <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-0">Admin</Badge>
                    )}
                    <StatusBadge {...statusConfig[accountStatus as keyof typeof statusConfig]} />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{user.id}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    {user.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{user.location}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined {new Date(user.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {/* Badges display */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {badges.map((b: any) => {
                        const cfg = BADGE_CONFIG[b.badge_type as BadgeType]
                        if (!cfg) return null
                        const Icon = cfg.icon
                        return (
                          <span key={b.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                            <Icon className="h-3 w-3" />{cfg.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {user.bio && <p className="text-sm text-muted-foreground mt-2 max-w-lg">{user.bio}</p>}
                </div>
                {/* Quick actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-2"
                    nativeButton={false} render={<Link href={`/profile/${userId}`} target="_blank" />}>
                    <ExternalLink className="h-3.5 w-3.5" /> View Profile
                  </Button>
                  <Button size="sm" variant="outline" className={`gap-2 ${user.role === 'admin' ? 'text-violet-600' : ''}`}
                    onClick={toggleRole} disabled={toggling}>
                    {user.role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                    {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Matches', value: acceptedMatches, icon: HandshakeIcon, color: 'text-emerald-600' },
          { label: 'Sessions', value: sessions.length, icon: Calendar, color: 'text-blue-600' },
          { label: 'Reviews', value: reviews.length, icon: Star, color: 'text-yellow-500' },
          { label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) : '—', icon: Star, color: 'text-yellow-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="py-4 px-5 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Trust Score ── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />
              <span className="font-semibold text-sm">Trust Score</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 h-7 text-xs"
              onClick={async () => {
                const res = await fetch('/api/admin/trust-scores', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId }),
                })
                const data = await res.json()
                if (data.total !== undefined) {
                  setUser((u: any) => ({ ...u, trust_score: data.total, trust_score_breakdown: data.breakdown }))
                  toast.success(`Trust score updated: ${data.total}/100`)
                } else {
                  toast.error('Failed to recalculate')
                }
              }}
            >
              Recalculate
            </Button>
          </div>

          <div className="flex items-center gap-6">
            {/* Score circle */}
            <div className="shrink-0 relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-700" />
                <circle
                  cx="40" cy="40" r="32" fill="none" strokeWidth="8"
                  strokeLinecap="round"
                  stroke={user.trust_score >= 75 ? '#10b981' : user.trust_score >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={`${((user.trust_score ?? 0) / 100) * 200.96} 200.96`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{user.trust_score ?? 0}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="flex-1 space-y-2">
              {(Object.entries(user.trust_score_breakdown ?? {
                verification: 0, completed_swaps: 0, ratings: 0, badges: 0, reports_penalty: 0,
              }) as [string, number][])
                .filter(([k]) => k !== 'total')
                .map(([key, val]) => {
                  const isNeg = val < 0
                  const label = {
                    verification: 'Verification',
                    completed_swaps: 'Completed Swaps',
                    ratings: 'Ratings',
                    badges: 'Badges',
                    reports_penalty: 'Reports Penalty',
                  }[key] ?? key
                  const maxVal = { verification: 30, completed_swaps: 30, ratings: 25, badges: 10, reports_penalty: 25 }[key] ?? 30
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isNeg ? 'bg-red-400' : 'bg-violet-500'}`}
                          style={{ width: `${Math.min(100, (Math.abs(val) / maxVal) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-8 text-right shrink-0 ${isNeg ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                        {isNeg ? val : `+${val}`}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full shrink-0 ${user.trust_score >= 75 ? 'bg-emerald-500' : user.trust_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {user.trust_score >= 75 ? 'High trust — eligible for all features' : user.trust_score >= 50 ? 'Moderate trust — some restrictions may apply' : 'Low trust — increased moderation'}
              {user.trust_score_updated_at && ` · Updated ${new Date(user.trust_score_updated_at).toLocaleDateString()}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Account Status & Actions ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Account Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" /> Account Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Suspend */}
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Suspend</p>
                <p className="text-xs text-muted-foreground">Blocks all login access until reinstated</p>
              </div>
              <Button size="sm" variant={user.suspended ? 'outline' : 'secondary'}
                className={`gap-2 ${user.suspended ? 'text-emerald-600 border-emerald-300' : ''}`}
                onClick={toggleSuspend} disabled={toggling}>
                {user.suspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                {user.suspended ? 'Reinstate' : 'Suspend'}
              </Button>
            </div>

            {/* Disable */}
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Disable Account</p>
                <p className="text-xs text-muted-foreground">Block login access entirely</p>
              </div>
              <Button size="sm" variant={user.disabled ? 'outline' : 'secondary'}
                className={`gap-2 ${user.disabled ? 'text-emerald-600 border-emerald-300' : 'text-orange-600'}`}
                onClick={toggleDisable} disabled={toggling}>
                {user.disabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {user.disabled ? 'Enable' : 'Disable'}
              </Button>
            </div>

            {/* Lock */}
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Lock Account</p>
                <p className="text-xs text-muted-foreground">
                  {isLocked
                    ? `Locked until ${new Date(user.locked_until).toLocaleString()}`
                    : 'Temporary time-based lock'}
                </p>
              </div>
              {isLocked ? (
                <Button size="sm" variant="outline" className="gap-2 text-emerald-600 border-emerald-300"
                  onClick={handleUnlock} disabled={toggling}>
                  <Unlock className="h-3.5 w-3.5" /> Unlock
                </Button>
              ) : (
                <Button size="sm" variant="secondary" className="gap-2 text-yellow-700"
                  onClick={() => setLockDialog(true)}>
                  <Lock className="h-3.5 w-3.5" /> Lock
                </Button>
              )}
            </div>

            {/* Ban */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Ban Account</p>
                <p className="text-xs text-muted-foreground">
                  {user.banned
                    ? `Banned: ${user.banned_reason ?? 'No reason given'}`
                    : 'Permanent platform ban'}
                </p>
              </div>
              {user.banned ? (
                <Button size="sm" variant="outline" className="gap-2 text-emerald-600 border-emerald-300"
                  onClick={handleUnban} disabled={toggling}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Unban
                </Button>
              ) : (
                <Button size="sm" variant="destructive" className="gap-2"
                  onClick={() => setBanDialog(true)}>
                  <Ban className="h-3.5 w-3.5" /> Ban
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Reset Password */}
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Reset Password</p>
                <p className="text-xs text-muted-foreground">Send password reset email</p>
              </div>
              <Button size="sm" variant="outline" className="gap-2"
                disabled={actionLoading === 'reset-password'}
                onClick={() => serverAction('reset-password', 'Reset password')}>
                {actionLoading === 'reset-password'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Mail className="h-3.5 w-3.5" />}
                Send Email
              </Button>
            </div>

            {/* Force Logout */}
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Force Logout</p>
                <p className="text-xs text-muted-foreground">Invalidate all active sessions</p>
              </div>
              <Button size="sm" variant="outline" className="gap-2 text-orange-600"
                disabled={actionLoading === 'force-logout'}
                onClick={() => serverAction('force-logout', 'Force logout')}>
                {actionLoading === 'force-logout'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <LogOut className="h-3.5 w-3.5" />}
                Logout
              </Button>
            </div>

            {/* Delete Account */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-red-600">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently remove — irreversible</p>
              </div>
              <Button size="sm" variant="destructive" className="gap-2"
                onClick={() => setDeleteDialog(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Verification ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-blue-500" /> Verification & Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Verification checks */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Verification Status</p>

              {/* Email */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Email</span>
                </div>
                <Badge className="text-xs border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30">
                  Verified by Supabase Auth
                </Badge>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Phone</span>
                  {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                </div>
                <Button size="sm" variant="outline" className={`h-7 text-xs gap-1.5 ${user.phone_verified ? 'text-emerald-600' : ''}`}
                  onClick={togglePhoneVerified} disabled={toggling}>
                  {user.phone_verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {user.phone_verified ? 'Verified' : 'Unverified'}
                </Button>
              </div>

              {/* Identity — read-only, derived from KYC status below so it can't drift out of sync */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Identity (KYC)</span>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.identity_verified ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {user.identity_verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {user.identity_verified ? 'Verified' : 'Unverified'}
                </span>
              </div>

              {/* KYC Status — the single source of truth; also drives identity_verified and the 'verified' badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">KYC Status</span>
                </div>
                <Select value={user.kyc_status ?? 'unverified'} onValueChange={(v) => { if (v) setKycStatus(v) }} disabled={toggling}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unverified">Unverified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Badge assignment */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badge Assignment</p>
              <div className="space-y-2">
                {ALL_BADGES.map((badge) => {
                  const cfg = BADGE_CONFIG[badge]
                  const Icon = cfg.icon
                  const owned = ownedBadgeTypes.has(badge)
                  const ownedBadge = badges.find((b: any) => b.badge_type === badge)
                  return (
                    <div key={badge} className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <Icon className="h-3 w-3" />{cfg.label}
                      </span>
                      {owned ? (
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 hover:text-red-600 px-2"
                          onClick={() => revokeBadge(ownedBadge.id, badge)}>
                          Revoke
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-emerald-600 hover:text-emerald-700 px-2"
                          onClick={() => awardBadge(badge)}>
                          Award
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Skills ── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Skills</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {skills.filter((s) => s.type === 'teach').length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                <GraduationCap className="h-3.5 w-3.5 text-violet-500" /> Teaches
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skills.filter((s) => s.type === 'teach').map((s: any) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">{s.skill_name}</Badge>
                ))}
              </div>
            </div>
          )}
          {skills.filter((s) => s.type === 'learn').length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" /> Wants to learn
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skills.filter((s) => s.type === 'learn').map((s: any) => (
                  <Badge key={s.id} variant="outline" className="text-xs">{s.skill_name}</Badge>
                ))}
              </div>
            </div>
          )}
          {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills added yet.</p>}
        </CardContent>
      </Card>

      {/* ── Reports ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-500" /> Reports Against User
            {reports.length > 0 && <Badge className="ml-auto text-xs bg-red-100 text-red-700 border-0">{reports.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports filed against this user.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r: any) => (
                <div key={r.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{r.reporter?.name?.slice(0,2)}</AvatarFallback></Avatar>
                    <span className="text-xs font-medium">{r.reporter?.name ?? 'Unknown'}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                  {r.resolved_at && <Badge className="text-[10px] mt-1 capitalize bg-gray-100 text-gray-600 border-0">{r.action_taken}</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sessions ── */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" /> Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-1.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.skill_focus}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{s.duration_minutes}min
                    </p>
                  </div>
                  <Badge className={`text-xs capitalize shrink-0 border-0 ${
                    s.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : s.status === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>{s.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Match History ── */}
      {matches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HandshakeIcon className="h-4 w-4 text-emerald-500" /> Match History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matches.map((m: any) => {
                const other = m.from_user_id === userId ? m.to_profile : m.from_profile
                return (
                  <div key={m.id} className="flex items-center gap-3 py-1.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={other?.avatar_url ?? ''} />
                      <AvatarFallback className="text-[10px]">{other?.name?.slice(0,2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{other?.name ?? 'Deleted user'}</p>
                    </div>
                    <Badge variant="secondary" className={`text-xs capitalize shrink-0 border-0 ${
                      m.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30'
                      : m.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-0'
                      : 'bg-gray-100 text-gray-600 border-0'
                    }`}>{m.status}</Badge>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reviews ── */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Reviews Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviews.map((r: any, i: number) => (
              <div key={r.id}>
                {i > 0 && <Separator className="my-3" />}
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{r.reviewer?.name?.slice(0,2)}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{r.reviewer?.name}</span>
                  <div className="flex ml-auto">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Ban Dialog ── */}
      <Dialog open={banDialog} onOpenChange={setBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" /> Ban {user.name}
            </DialogTitle>
            <DialogDescription>
              This will permanently ban the user from the platform. They will not be able to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for ban <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="e.g. Repeated policy violations, spam, harassment..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBan} disabled={toggling || !banReason.trim()}>
              {toggling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Lock Dialog ── */}
      <Dialog open={lockDialog} onOpenChange={setLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Lock className="h-5 w-5" /> Lock {user.name}
            </DialogTitle>
            <DialogDescription>
              The account will be locked for the selected duration. The user cannot log in until the lock expires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Lock duration</Label>
              <Select value={lockHours} onValueChange={(v) => { if (v) setLockHours(v) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Suspicious activity detected"
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialog(false)}>Cancel</Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={handleLock} disabled={toggling}>
              {toggling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lock Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Delete {user.name}
            </DialogTitle>
            <DialogDescription>
              This action is <strong>irreversible</strong>. All data — profile, matches, sessions, messages — will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Type <span className="font-bold">{user.name}</span> to confirm</Label>
            <Input
              placeholder={user.name}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}
              disabled={deleteConfirm !== user.name || actionLoading === 'delete'}>
              {actionLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
