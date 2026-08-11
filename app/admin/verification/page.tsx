'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, RefreshCw, Star, Award, UserCheck, Fingerprint,
  Phone, Crown, TrendingUp, Eye, FileText, Link2, Zap,
  ExternalLink, MapPin, GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, UserSkill } from '@/lib/types'

type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
type BadgeType = 'verified' | 'top_teacher' | 'top_learner' | 'trusted' | 'community_star' | 'early_adopter'

interface UserWithVerification extends Profile {
  kyc_status: KycStatus
  identity_verified: boolean
  phone_verified: boolean
  user_badges?: { badge_type: BadgeType }[]
}

const KYC_CONFIG = {
  unverified: { label: 'Unverified', color: 'bg-gray-100 text-gray-600', icon: AlertCircle },
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  verified:   { label: 'Verified',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected:   { label: 'Rejected',   color: 'bg-red-100 text-red-600', icon: XCircle },
}

const BADGE_CONFIG: Record<BadgeType, { label: string; color: string; icon: React.ElementType }> = {
  verified:       { label: 'Verified Member', color: 'text-blue-600',   icon: ShieldCheck },
  top_teacher:    { label: 'Top Teacher',     color: 'text-orange-500', icon: Star },
  top_learner:    { label: 'Top Learner',     color: 'text-violet-600', icon: TrendingUp },
  trusted:        { label: 'Trusted',         color: 'text-emerald-600',icon: UserCheck },
  community_star: { label: 'Community Star',  color: 'text-yellow-500', icon: Crown },
  early_adopter:  { label: 'Early Adopter',   color: 'text-pink-500',   icon: Award },
}

const REFRESH_INTERVAL = 30_000

export default function VerificationCenterPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserWithVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | KycStatus>('pending')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserWithVerification | null>(null)
  const [selectedApp, setSelectedApp] = useState<any | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<UserSkill[]>([])
  const [loadingApp, setLoadingApp] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectDialog, setRejectDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [runningAutoAward, setRunningAutoAward] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadApplication = async (userId: string) => {
    setLoadingApp(true)
    setSelectedApp(null)
    setSelectedSkills([])
    const [{ data: app }, { data: skills }] = await Promise.all([
      supabase.from('kyc_applications').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_skills').select('*').eq('user_id', userId)
    ])
    setSelectedApp(app)
    setSelectedSkills(skills ?? [])
    setLoadingApp(false)
  }

  const runAutoAward = async (userId: string) => {
    setRunningAutoAward(true)
    try {
      const res = await fetch('/api/badges/auto-award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Auto-award failed'); return }
      const { awarded, revoked } = result.results?.[0] ?? {}
      if (awarded?.length) toast.success(`Awarded: ${awarded.join(', ')}`)
      else if (revoked?.length) toast.success(`Revoked: ${revoked.join(', ')}`)
      else toast.success('Badges up to date')
      load()
    } catch {
      toast.error('Network error')
    }
    setRunningAutoAward(false)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? `Failed to load users (${res.status})`)
        setLoading(false)
        return
      }
      const { profiles: profileData, apps: appData } = await res.json()

      const appMap = new Map((appData ?? []).map((a: any) => [a.user_id, a]))
      const merged = (profileData ?? []).map((u: any) => ({
        ...u,
        _application: appMap.get(u.id) ?? null,
      }))

      setUsers(merged)
      setCountdown(REFRESH_INTERVAL / 1000)
    } catch (e) {
      toast.error('Network error loading users')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [load])

  const updateKyc = async (userId: string, status: KycStatus) => {
    setSaving(true)
    const updates: Partial<UserWithVerification> = {
      kyc_status: status,
      identity_verified: status === 'verified',
    }

    if (status === 'rejected') {
      updates.kyc_rejection_reason = rejectionReason.trim() || null
    } else if (status === 'verified' || status === 'pending') {
      updates.kyc_rejection_reason = null
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`KYC ${status}`)
      
      if (status === 'verified') {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('user_badges').upsert({
          user_id: userId,
          badge_type: 'verified',
          awarded_by: user?.id,
        }, { onConflict: 'user_id,badge_type' })
      } else {
        // Remove verified badge if status is changed back or rejected
        await supabase.from('user_badges')
          .delete()
          .eq('user_id', userId)
          .eq('badge_type', 'verified')
      }

      setSelectedUser(null)
      setRejectDialog(false)
      setRejectionReason('')
      load()
    }
    setSaving(false)
  }

  const toggleBadge = async (userId: string, badge: BadgeType, hasBadge: boolean) => {
    if (hasBadge) {
      const { error } = await supabase.from('user_badges').delete().eq('user_id', userId).eq('badge_type', badge)
      if (error) toast.error(error.message)
      else { toast.success('Badge revoked'); load() }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('user_badges').insert({ user_id: userId, badge_type: badge, awarded_by: user?.id })
      if (error) toast.error(error.message.includes('unique') ? 'Badge already assigned' : error.message)
      else { toast.success('Badge awarded'); load() }
    }
  }

  const stats = {
    total:      users.length,
    pending:    users.filter(u => u.kyc_status === 'pending').length,
    verified:   users.filter(u => u.kyc_status === 'verified').length,
    rejected:   users.filter(u => u.kyc_status === 'rejected').length,
    unverified: users.filter(u => u.kyc_status === 'unverified').length,
  }

  const filtered = users.filter(u => {
    if (filter !== 'all' && u.kyc_status !== filter) return false
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verification Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identity KYC · Badges · Auto-refreshing in {countdown}s
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KYC stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {([
          { key: 'total',      label: 'Total Users',    color: 'text-blue-600',   bg: 'bg-blue-50',   icon: UserCheck },
          { key: 'pending',    label: 'Pending Review', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
          { key: 'verified',   label: 'Verified',       color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
          { key: 'rejected',   label: 'Rejected',       color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
          { key: 'unverified', label: 'Unverified',     color: 'text-gray-600', bg: 'bg-gray-50', icon: AlertCircle },
        ] as const).map(s => {
          const Icon = s.icon
          return (
            <button
              key={s.key}
              onClick={() => setFilter(s.key === 'total' ? 'all' : s.key)}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                (filter === s.key || (filter === 'all' && s.key === 'total')) && 'ring-2 ring-violet-500'
              )}
            >
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-2.5', s.bg)}>
                <Icon className={cn('h-4.5 w-4.5', s.color)} />
              </div>
              <p className={cn('text-2xl font-bold', s.color)}>{stats[s.key as keyof typeof stats]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5">
              {(['all', 'pending', 'verified', 'rejected', 'unverified'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    filter === f ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-48 text-sm" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border divide-y">
            {filtered.length === 0 && (
              <div className="text-center py-12 px-4">
                <p className="text-sm text-muted-foreground">
                  {users.length === 0 
                    ? "No users found in the database. If this is unexpected, please check your database connection or RLS policies." 
                    : `No users match the "${filter}" filter.`}
                </p>
                {users.length === 0 && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={load}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry Connection
                  </Button>
                )}
              </div>
            )}
            {filtered.map(user => {
              const KycInfo = KYC_CONFIG[user.kyc_status]
              const KycIcon = KycInfo.icon
              const badges = user.user_badges?.map(b => b.badge_type) ?? []
              return (
                <div
                  key={user.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer',
                    selectedUser?.id === user.id && 'bg-violet-50 dark:bg-violet-950/20'
                  )}
                  onClick={() => { setSelectedUser(user); loadApplication(user.id) }}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs font-semibold bg-violet-100 text-violet-700">
                      {user.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      {badges.slice(0, 2).map(b => {
                        const Icon = BADGE_CONFIG[b].icon
                        return <Icon key={b} className={cn('h-3.5 w-3.5 shrink-0', BADGE_CONFIG[b].color)} />
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {user.phone_verified && <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />Phone</span>}
                      {user.identity_verified && <span className="text-[10px] text-blue-600 flex items-center gap-0.5"><Fingerprint className="h-2.5 w-2.5" />ID</span>}
                      {(user as any)._application && <span className="text-[10px] text-violet-600 flex items-center gap-0.5"><FileText className="h-2.5 w-2.5" />Doc</span>}
                    </div>
                  </div>
                  <Badge className={cn('text-[10px] gap-1 shrink-0', KycInfo.color)}>
                    <KycIcon className="h-2.5 w-2.5" />
                    {KycInfo.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selectedUser ? (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedUser.avatar_url ?? ''} />
                    <AvatarFallback className="bg-violet-100 text-violet-700 font-bold">
                      {selectedUser.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedUser.name}</p>
                    <Badge className={cn('text-[10px] mt-0.5', KYC_CONFIG[selectedUser.kyc_status].color)}>
                      {KYC_CONFIG[selectedUser.kyc_status].label}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Phone verified</span>
                    <span className={selectedUser.phone_verified ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                      {selectedUser.phone_verified ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" />Identity verified</span>
                    <span className={selectedUser.identity_verified ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                      {selectedUser.identity_verified ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Location</span>
                    <span className="font-medium text-xs">{selectedUser.location || 'Not set'}</span>
                  </div>
                  {selectedUser.bio && (
                    <div className="pt-2 border-t">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Bio</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{selectedUser.bio}</p>
                    </div>
                  )}
                </div>

                {/* Skills Context */}
                {selectedSkills.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      User Skills
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">Teaches</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSkills.filter(s => s.type === 'teach').map(s => (
                            <Badge key={s.id} variant="secondary" className="text-[10px] py-0 h-5">
                              {s.skill_name}
                            </Badge>
                          ))}
                          {selectedSkills.filter(s => s.type === 'teach').length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">Learns</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSkills.filter(s => s.type === 'learn').map(s => (
                            <Badge key={s.id} variant="outline" className="text-[10px] py-0 h-5 border-yellow-200 text-yellow-700 bg-yellow-50">
                              {s.skill_name}
                            </Badge>
                          ))}
                          {selectedSkills.filter(s => s.type === 'learn').length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* KYC actions */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground">KYC Decision</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                      disabled={saving || selectedUser.kyc_status === 'verified'}
                      onClick={() => updateKyc(selectedUser.id, 'verified')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                      disabled={saving || selectedUser.kyc_status === 'rejected'}
                      onClick={() => setRejectDialog(true)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                  {selectedUser.kyc_status !== 'pending' && (
                    <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground"
                      onClick={() => updateKyc(selectedUser.id, 'pending')}>
                      Reset to Pending
                    </Button>
                  )}
                </div>
              </div>

              {/* Application details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Verification Application
                </p>
                {loadingApp && (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading application…</p>
                )}
                {!loadingApp && !selectedApp && (
                  <p className="text-xs text-muted-foreground">No application submitted yet.</p>
                )}
                {!loadingApp && selectedApp && (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <span className="text-muted-foreground">Legal name</span>
                      <span className="font-medium">{selectedApp.full_name}</span>
                      <span className="text-muted-foreground">ID type</span>
                      <span className="font-medium capitalize">{selectedApp.id_type?.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">Document</span>
                      <span>
                        {selectedApp.document_url ? (
                          <button
                            onClick={async () => {
                              setViewingDoc(true)
                              try {
                                const res = await fetch(`/api/admin/kyc-document?userId=${selectedUser?.id}`)
                                const data = await res.json()
                                if (!res.ok) { toast.error(data.error ?? 'Could not load document'); return }
                                window.open(data.url, '_blank', 'noopener,noreferrer')
                              } catch { toast.error('Network error') }
                              finally { setViewingDoc(false) }
                            }}
                            disabled={viewingDoc}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline font-medium disabled:opacity-50"
                          >
                            <FileText className="h-3 w-3" />
                            {viewingDoc ? 'Loading…' : 'View document'}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">Not uploaded</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">Auto-approved</span>
                      <span className={selectedApp.auto_approved ? 'text-emerald-600 font-medium flex items-center gap-1' : 'text-muted-foreground'}>
                        {selectedApp.auto_approved ? <><Zap className="h-3 w-3" />Yes</> : 'No (manual)'}
                      </span>
                      <span className="text-muted-foreground">Submitted</span>
                      <span>{new Date(selectedApp.created_at).toLocaleDateString()}</span>
                    </div>
                    {selectedApp.reason && (
                      <div className="pt-1.5 border-t">
                        <p className="text-muted-foreground mb-1">Reason</p>
                        <p className="text-foreground leading-relaxed">{selectedApp.reason}</p>
                      </div>
                    )}
                    {selectedApp.notable_work && (
                      <div className="pt-1.5 border-t">
                        <p className="text-muted-foreground mb-1">Notable work</p>
                        <p className="text-foreground leading-relaxed">{selectedApp.notable_work}</p>
                      </div>
                    )}
                    {selectedApp.social_links && Object.values(selectedApp.social_links as Record<string, string>).some(Boolean) && (
                      <div className="pt-1.5 border-t">
                        <p className="text-muted-foreground mb-1.5 flex items-center gap-1"><Link2 className="h-3 w-3" />Links</p>
                        <div className="space-y-1">
                          {Object.entries(selectedApp.social_links as Record<string, string>).map(([k, v]) =>
                            v ? (
                              <a key={k} href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-violet-600 hover:underline capitalize">
                                <ExternalLink className="h-3 w-3 shrink-0" />{k}: {v}
                              </a>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Badge assignment */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Badges</p>
                  <button
                    onClick={() => runAutoAward(selectedUser.id)}
                    disabled={runningAutoAward}
                    className="text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" />
                    {runningAutoAward ? 'Running…' : 'Auto-award'}
                  </button>
                </div>
                <div className="space-y-2">
                  {(Object.entries(BADGE_CONFIG) as [BadgeType, typeof BADGE_CONFIG[BadgeType]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    const hasBadge = selectedUser.user_badges?.some(b => b.badge_type === key) ?? false
                    return (
                      <div key={key} className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                        hasBadge ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200' : 'border-dashed hover:bg-muted/30'
                      )}>
                        <Icon className={cn('h-4 w-4 shrink-0', cfg.color)} />
                        <span className="flex-1 text-xs font-medium">{cfg.label}</span>
                        <button
                          onClick={() => toggleBadge(selectedUser.id, key, hasBadge)}
                          className={cn(
                            'text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
                            hasBadge
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-violet-600 hover:bg-violet-50'
                          )}
                        >
                          {hasBadge ? 'Revoke' : 'Award'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a user to review</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejection dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject KYC Verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rejecting will notify {selectedUser?.name} that their verification was not approved.
            </p>
            <Textarea
              placeholder="Reason for rejection (optional — shown to user)…"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={saving}
              onClick={() => selectedUser && updateKyc(selectedUser.id, 'rejected')}
            >
              Reject Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
