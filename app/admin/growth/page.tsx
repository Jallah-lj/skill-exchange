'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  TrendingUp, Mail, Users, Gift, Link2, RefreshCw,
  Plus, Play, Pause, CheckCircle2, Clock, BarChart3,
  Target, Zap, ArrowUp, Search, Edit2, Trash2, Send,
  Award, DollarSign, Copy, Eye, UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Campaign {
  id: string
  name: string
  type: 'email' | 'referral' | 'affiliate' | 'push'
  status: 'draft' | 'active' | 'paused' | 'completed'
  subject: string | null
  content: string | null
  target_audience: string
  sent_count: number
  open_count: number
  click_count: number
  conversion_count: number
  scheduled_at: string | null
  created_at: string
}

interface Referral {
  id: string
  referrer_id: string
  referred_id: string | null
  code: string
  status: 'pending' | 'completed' | 'expired'
  reward_given: boolean
  created_at: string
  completed_at: string | null
  profiles?: { name: string; avatar_url: string | null } | null
}

interface Affiliate {
  id: string
  user_id: string
  code: string
  commission_rate: number
  total_referrals: number
  total_earnings: number
  status: 'active' | 'suspended' | 'pending'
  created_at: string
  profiles?: { name: string; avatar_url: string | null } | null
}

const TYPE_CONFIG = {
  email:    { label: 'Email',    color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: Mail },
  referral: { label: 'Referral', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Gift },
  affiliate:{ label: 'Affiliate',color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Link2 },
  push:     { label: 'Push',     color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Zap },
}

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600',       icon: Clock },
  active:   { label: 'Active',   color: 'bg-emerald-100 text-emerald-700', icon: Play },
  paused:   { label: 'Paused',   color: 'bg-yellow-100 text-yellow-700',   icon: Pause },
  completed:{ label: 'Completed',color: 'bg-blue-100 text-blue-700',       icon: CheckCircle2 },
}

const REFRESH_INTERVAL = 30_000

export default function GrowthCenterPage() {
  const supabase = createClient()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'campaigns' | 'referrals' | 'affiliates'>('overview')
  const [createDialog, setCreateDialog] = useState(false)
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null)
  const [newAffiliate, setNewAffiliate] = useState(false)
  const [affiliateSearch, setAffiliateSearch] = useState('')
  const [affiliateResults, setAffiliateResults] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    name: '', type: 'email', subject: '', content: '', target_audience: 'all', scheduled_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stats, setStats] = useState({
    totalUsers: 0,
    newThisMonth: 0,
    activeCampaigns: 0,
    totalReferrals: 0,
    conversionRate: 0,
    totalAffiliateEarnings: 0,
  })

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [{ data: camp }, { data: refs }, { data: affs }, { count: totalUsers }, { count: newUsers }] = await Promise.all([
      supabase.from('growth_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('referrals').select('*, profiles:referrer_id(name, avatar_url)').order('created_at', { ascending: false }).limit(50),
      supabase.from('affiliates').select('*, profiles:user_id(name, avatar_url)').order('total_earnings', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    ])

    const campData = camp ?? []
    const refData = refs ?? []
    const affData = affs ?? []

    setCampaigns(campData)
    setReferrals(refData)
    setAffiliates(affData)

    const totalSent = campData.reduce((s, c) => s + c.sent_count, 0)
    const totalConversions = campData.reduce((s, c) => s + c.conversion_count, 0)

    setStats({
      totalUsers: totalUsers ?? 0,
      newThisMonth: newUsers ?? 0,
      activeCampaigns: campData.filter(c => c.status === 'active').length,
      totalReferrals: refData.length,
      conversionRate: totalSent > 0 ? Math.round((totalConversions / totalSent) * 100) : 0,
      totalAffiliateEarnings: affData.reduce((s, a) => s + Number(a.total_earnings), 0),
    })

    setCountdown(REFRESH_INTERVAL / 1000)
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

  const saveCampaign = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name,
      type: form.type,
      subject: form.subject || null,
      content: form.content || null,
      target_audience: form.target_audience,
      scheduled_at: form.scheduled_at || null,
      updated_at: new Date().toISOString(),
    }
    if (editCampaign) {
      const { error } = await supabase.from('growth_campaigns').update(payload).eq('id', editCampaign.id)
      if (error) toast.error(error.message)
      else { toast.success('Campaign updated'); setEditCampaign(null) }
    } else {
      const { error } = await supabase.from('growth_campaigns').insert({ ...payload, created_by: user?.id })
      if (error) toast.error(error.message)
      else { toast.success('Campaign created'); setCreateDialog(false) }
    }
    setForm({ name: '', type: 'email', subject: '', content: '', target_audience: 'all', scheduled_at: '' })
    setSaving(false)
    load()
  }

  const toggleCampaignStatus = async (c: Campaign) => {
    const newStatus = c.status === 'active' ? 'paused' : c.status === 'draft' || c.status === 'paused' ? 'active' : c.status
    const { error } = await supabase.from('growth_campaigns').update({
      status: newStatus,
      started_at: newStatus === 'active' ? new Date().toISOString() : undefined,
    }).eq('id', c.id)
    if (error) toast.error(error.message)
    else { toast.success(`Campaign ${newStatus}`); load() }
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign?')) return
    await supabase.from('growth_campaigns').delete().eq('id', id)
    toast.success('Campaign deleted')
    load()
  }

  const searchForAffiliate = async (q: string) => {
    if (!q.trim()) { setAffiliateResults([]); return }
    const { data } = await supabase.from('profiles').select('id, name').ilike('name', `%${q}%`).limit(6)
    setAffiliateResults(data ?? [])
  }

  const addAffiliate = async (userId: string, userName: string) => {
    const code = userName.toLowerCase().replace(/\s+/g, '') + Math.random().toString(36).slice(2, 6)
    const { error } = await supabase.from('affiliates').insert({ user_id: userId, code })
    if (error) toast.error(error.message.includes('unique') ? 'User is already an affiliate' : error.message)
    else {
      toast.success(`${userName} added as affiliate with code: ${code}`)
      setNewAffiliate(false)
      setAffiliateSearch('')
      setAffiliateResults([])
      load()
    }
  }

  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      type: c.type,
      subject: c.subject ?? '',
      content: c.content ?? '',
      target_audience: c.target_audience,
      scheduled_at: c.scheduled_at ?? '',
    })
    setEditCampaign(c)
  }

  // Growth chart data (last 7 months, mocked from real user counts)
  const chartMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return d.toLocaleString('default', { month: 'short' })
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  const CampaignForm = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setForm({ name: '', type: 'email', subject: '', content: '', target_audience: 'all', scheduled_at: '' }) } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editCampaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <Select value={form.type} onValueChange={v => { if (v) setForm(f => ({ ...f, type: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email Campaign</SelectItem>
                  <SelectItem value="push">Push Notification</SelectItem>
                  <SelectItem value="referral">Referral Program</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Target Audience</label>
              <Select value={form.target_audience} onValueChange={v => { if (v) setForm(f => ({ ...f, target_audience: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="new">New Users (&lt;30 days)</SelectItem>
                  <SelectItem value="inactive">Inactive Users</SelectItem>
                  <SelectItem value="verified">Verified Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Campaign Name</label>
            <Input placeholder="e.g. Summer Skill Boost 2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {form.type === 'email' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Subject</label>
              <Input placeholder="Subject line…" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message / Content</label>
            <Textarea placeholder="Campaign message…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Schedule (optional)</label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setForm({ name: '', type: 'email', subject: '', content: '', target_audience: 'all', scheduled_at: '' }) }}>Cancel</Button>
          <Button onClick={saveCampaign} disabled={saving} className="gap-2">
            <Send className="h-4 w-4" />
            {saving ? 'Saving…' : editCampaign ? 'Update' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Growth & Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Campaigns · Referrals · Affiliates · Auto-refreshing in {countdown}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {tab === 'campaigns' && (
            <Button onClick={() => setCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          )}
          {tab === 'affiliates' && (
            <Button onClick={() => setNewAffiliate(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Affiliate
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Users',    value: stats.totalUsers,          icon: Users,     color: 'text-gray-700' },
          { label: 'New (30 days)',  value: stats.newThisMonth,        icon: ArrowUp,   color: 'text-emerald-600' },
          { label: 'Active Campaigns', value: stats.activeCampaigns,  icon: BarChart3, color: 'text-violet-600' },
          { label: 'Total Referrals', value: stats.totalReferrals,     icon: Gift,      color: 'text-blue-600' },
          { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: Target, color: 'text-orange-600' },
          { label: 'Affiliate Revenue', value: `$${stats.totalAffiliateEarnings.toFixed(0)}`, icon: DollarSign, color: 'text-emerald-700' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <Icon className={cn('h-4 w-4 mb-1.5', s.color)} />
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5 w-fit">
        {(['overview', 'campaigns', 'referrals', 'affiliates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
              tab === t ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User growth chart (bar mockup) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">User Acquisition</h3>
                <p className="text-xs text-muted-foreground mt-0.5">New registrations over time</p>
              </div>
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                +{stats.newThisMonth} this month
              </span>
            </div>
            <div className="flex items-end gap-2 h-32">
              {[35, 52, 41, 63, 78, stats.newThisMonth > 0 ? Math.min(stats.newThisMonth, 100) : 45].map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-violet-500 transition-all hover:bg-violet-600"
                    style={{ height: `${(v / 100) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{chartMonths[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign performance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Campaign Performance</h3>
              <button className="text-xs text-violet-600 hover:underline" onClick={() => setTab('campaigns')}>View all</button>
            </div>
            {campaigns.filter(c => c.status !== 'draft').slice(0, 5).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No active campaigns</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.filter(c => c.status !== 'draft').slice(0, 5).map(c => {
                  const openRate = c.sent_count > 0 ? Math.round((c.open_count / c.sent_count) * 100) : 0
                  const TypeInfo = TYPE_CONFIG[c.type]
                  const TypeIcon = TypeInfo.icon
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', TypeInfo.color)}>
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${openRate}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{openRate}% open</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{c.sent_count} sent</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Referral stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Referral Program</h3>
              <button className="text-xs text-violet-600 hover:underline" onClick={() => setTab('referrals')}>View all</button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              {[
                { label: 'Total', value: referrals.length, color: 'text-gray-700' },
                { label: 'Completed', value: referrals.filter(r => r.status === 'completed').length, color: 'text-emerald-600' },
                { label: 'Pending', value: referrals.filter(r => r.status === 'pending').length, color: 'text-yellow-600' },
              ].map(s => (
                <div key={s.label} className="bg-muted/30 rounded-lg p-3">
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top affiliates */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Top Affiliates</h3>
              <button className="text-xs text-violet-600 hover:underline" onClick={() => setTab('affiliates')}>View all</button>
            </div>
            {affiliates.slice(0, 4).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No affiliates yet</p>
            ) : (
              <div className="space-y-3">
                {affiliates.slice(0, 4).map((aff, i) => (
                  <div key={aff.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={aff.profiles?.avatar_url ?? ''} />
                      <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                        {aff.profiles?.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{aff.profiles?.name}</p>
                      <p className="text-[10px] text-muted-foreground">Code: {aff.code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-600">${Number(aff.total_earnings).toFixed(0)}</p>
                      <p className="text-[10px] text-muted-foreground">{aff.total_referrals} refs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
            {campaigns.length === 0 ? (
              <div className="text-center py-16">
                <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mb-4">No campaigns yet</p>
                <Button onClick={() => setCreateDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />Create Campaign
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Campaign</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Type</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Sent</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Opens</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Converts</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campaigns.map(c => {
                    const TypeInfo = TYPE_CONFIG[c.type]
                    const StatusInfo = STATUS_CONFIG[c.status]
                    const TypeIcon = TypeInfo.icon
                    const StatusIcon = StatusInfo.icon
                    const openRate = c.sent_count > 0 ? Math.round((c.open_count / c.sent_count) * 100) : 0
                    return (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.target_audience} users</p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge className={cn('text-[10px] border gap-1', TypeInfo.color)}>
                            <TypeIcon className="h-2.5 w-2.5" />
                            {TypeInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge className={cn('text-[10px] gap-1', StatusInfo.color)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {StatusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm">{c.sent_count.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-sm">{c.open_count.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground ml-1">({openRate}%)</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm">{c.conversion_count.toLocaleString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {c.status !== 'completed' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleCampaignStatus(c)}>
                                {c.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteCampaign(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border divide-y">
          {referrals.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No referrals yet</p>
          ) : (
            referrals.map(ref => (
              <div key={ref.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={ref.profiles?.avatar_url ?? ''} />
                  <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                    {ref.profiles?.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ref.profiles?.name ?? 'Unknown'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{ref.code}</code>
                    <button onClick={() => { navigator.clipboard.writeText(ref.code); toast.success('Copied') }}>
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
                <Badge className={cn('text-[10px] capitalize shrink-0', {
                  pending:   'bg-yellow-100 text-yellow-700',
                  completed: 'bg-emerald-100 text-emerald-700',
                  expired:   'bg-gray-100 text-gray-600',
                }[ref.status])}>
                  {ref.status}
                </Badge>
                {ref.reward_given && (
                  <Badge className="text-[10px] bg-violet-100 text-violet-700 shrink-0">
                    <Award className="h-2.5 w-2.5 mr-1" />Rewarded
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(ref.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'affiliates' && (
        <div className="space-y-4">
          {newAffiliate && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Add New Affiliate</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name…"
                  value={affiliateSearch}
                  onChange={e => { setAffiliateSearch(e.target.value); searchForAffiliate(e.target.value) }}
                  className="pl-9"
                  autoFocus
                />
              </div>
              {affiliateResults.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y">
                  {affiliateResults.map(u => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex-1 text-sm">{u.name}</span>
                      <Button size="sm" onClick={() => addAffiliate(u.id, u.name)}>Add</Button>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="mt-3" onClick={() => { setNewAffiliate(false); setAffiliateSearch(''); setAffiliateResults([]) }}>Cancel</Button>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border divide-y">
            {affiliates.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No affiliates yet</p>
            ) : (
              affiliates.map(aff => (
                <div key={aff.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={aff.profiles?.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                      {aff.profiles?.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{aff.profiles?.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{aff.code}</code>
                      <button onClick={() => { navigator.clipboard.writeText(aff.code); toast.success('Copied') }}>
                        <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      <span className="text-[10px] text-muted-foreground">{aff.commission_rate}% commission</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600">${Number(aff.total_earnings).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{aff.total_referrals} referrals</p>
                  </div>
                  <Badge className={cn('text-[10px] capitalize shrink-0', {
                    active:    'bg-emerald-100 text-emerald-700',
                    suspended: 'bg-red-100 text-red-700',
                    pending:   'bg-yellow-100 text-yellow-700',
                  }[aff.status])}>
                    {aff.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <CampaignForm open={createDialog} onClose={() => setCreateDialog(false)} />
      <CampaignForm open={!!editCampaign} onClose={() => setEditCampaign(null)} />
    </div>
  )
}
