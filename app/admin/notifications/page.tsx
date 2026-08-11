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
  Bell, Send, Users, User, Clock, CheckCircle2,
  RefreshCw, Search, Megaphone, AlertTriangle, Info,
  BellOff, TrendingUp, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  read_at: string | null
  created_at: string
  profiles?: { name: string; avatar_url: string | null } | null
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  announcement: { label: 'Announcement', color: 'bg-violet-100 text-violet-700', icon: Megaphone },
  warning:      { label: 'Warning',      color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  info:         { label: 'Info',         color: 'bg-blue-100 text-blue-700',     icon: Info },
  match:        { label: 'Match',        color: 'bg-emerald-100 text-emerald-700', icon: Users },
  message:      { label: 'Message',      color: 'bg-sky-100 text-sky-700',       icon: Mail },
}

const REFRESH_INTERVAL = 30_000
const PAGE_SIZE = 30

export default function NotificationManagementPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const [form, setForm] = useState({
    target: 'all' as 'all' | 'user',
    userId: '',
    userName: '',
    type: 'announcement',
    title: '',
    body: '',
    href: '',
  })
  const [userResults, setUserResults] = useState<{ id: string; name: string }[]>([])
  const [sending, setSending] = useState(false)

  const [stats, setStats] = useState({ total: 0, read: 0, unread: 0, today: 0 })
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const [{ data }, { count: total }, { count: readCount }, { count: todayCount }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*, profiles(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).not('read_at', 'is', null),
      supabase.from('notifications').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    ])
    setNotifications(data ?? [])
    setStats({
      total: total ?? 0,
      read: readCount ?? 0,
      unread: (total ?? 0) - (readCount ?? 0),
      today: todayCount ?? 0,
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

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setUserResults([]); return }
    const { data } = await supabase.from('profiles').select('id, name').ilike('name', `%${q}%`).limit(6)
    setUserResults(data ?? [])
  }

  const sendNotification = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (form.target === 'user' && !form.userId) { toast.error('Select a user'); return }
    setSending(true)

    try {
      if (form.target === 'all') {
        const { data: profiles } = await supabase.from('profiles').select('id')
        if (!profiles?.length) { toast.error('No users found'); setSending(false); return }
        const rows = profiles.map(p => ({
          user_id: p.id,
          type: form.type,
          title: form.title,
          body: form.body || null,
          href: form.href || null,
        }))
        const { error } = await supabase.from('notifications').insert(rows)
        if (error) toast.error(error.message)
        else toast.success(`Notification sent to ${profiles.length} users`)
      } else {
        const { error } = await supabase.from('notifications').insert({
          user_id: form.userId,
          type: form.type,
          title: form.title,
          body: form.body || null,
          href: form.href || null,
        })
        if (error) toast.error(error.message)
        else toast.success(`Notification sent to ${form.userName}`)
      }
      setForm(f => ({ ...f, title: '', body: '', href: '', userId: '', userName: '' }))
      setUserResults([])
      load()
    } finally {
      setSending(false)
    }
  }

  const filtered = notifications.filter(n => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.profiles?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            In-app notifications · Auto-refreshing in {countdown}s
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent',   value: stats.total,  icon: Bell,         color: 'text-gray-700' },
          { label: 'Today',        value: stats.today,  icon: TrendingUp,   color: 'text-violet-600' },
          { label: 'Read',         value: stats.read,   icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Unread',       value: stats.unread, icon: BellOff,      color: 'text-orange-600' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('h-4 w-4', s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Read rate bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Read Rate</span>
          <span className="text-sm font-bold text-emerald-600">{readRate}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${readRate}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{stats.read} of {stats.total} notifications read</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5 w-fit">
        {(['compose', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
              tab === t ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'compose' ? 'Compose' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold">Send Notification</h2>

            {/* Target */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Send To</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm(f => ({ ...f, target: 'all', userId: '', userName: '' }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    form.target === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'hover:bg-muted/50'
                  )}
                >
                  <Users className="h-4 w-4" />
                  All Users
                </button>
                <button
                  onClick={() => setForm(f => ({ ...f, target: 'user' }))}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    form.target === 'user' ? 'bg-violet-600 text-white border-violet-600' : 'hover:bg-muted/50'
                  )}
                >
                  <User className="h-4 w-4" />
                  Specific User
                </button>
              </div>
            </div>

            {form.target === 'user' && (
              <div className="relative">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search User</label>
                <Input
                  placeholder="Type user name…"
                  value={form.userName}
                  onChange={e => { setForm(f => ({ ...f, userName: e.target.value, userId: '' })); searchUsers(e.target.value) }}
                />
                {userResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-800 border rounded-lg shadow-lg divide-y">
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => { setForm(f => ({ ...f, userId: u.id, userName: u.name })); setUserResults([]) }}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
                {form.userId && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Selected: {form.userName}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
              <Select value={form.type} onValueChange={v => { if (v) setForm(f => ({ ...f, type: v })) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
              <Input placeholder="Notification title…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message (optional)</label>
              <Textarea placeholder="Additional details…" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Link URL (optional)</label>
              <Input placeholder="/profile or /matches…" value={form.href} onChange={e => setForm(f => ({ ...f, href: e.target.value }))} />
            </div>

            <Button onClick={sendNotification} disabled={sending} className="w-full gap-2">
              <Send className="h-4 w-4" />
              {sending ? 'Sending…' : form.target === 'all' ? 'Broadcast to All Users' : 'Send Notification'}
            </Button>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-6">
              <p className="text-sm font-semibold mb-4">Preview</p>
              <div className="border rounded-xl p-4 bg-muted/20 space-y-1">
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = TYPE_CONFIG[form.type] ?? TYPE_CONFIG.info
                    const Icon = cfg.icon
                    return <Icon className="h-4 w-4 text-violet-600" />
                  })()}
                  <p className="font-semibold text-sm">{form.title || 'Notification title'}</p>
                </div>
                {form.body && <p className="text-sm text-muted-foreground pl-6">{form.body}</p>}
                {form.href && <p className="text-xs text-violet-600 pl-6 underline">{form.href}</p>}
                <p className="text-[10px] text-muted-foreground pl-6 pt-1">Just now</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Broadcast Warning
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                "All Users" broadcasts create one notification per user. For large platforms with 1000+ users, consider scheduled batching.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* History filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={typeFilter} onValueChange={(v) => { if (v) setTypeFilter(v) }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search notifications…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-56 text-sm" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border divide-y">
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">No notifications found</p>
            )}
            {filtered.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
              const Icon = cfg.icon
              return (
                <div key={n.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      → {n.profiles?.name ?? 'Unknown'} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {n.read_at ? (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1 shrink-0 mt-1">
                      <CheckCircle2 className="h-3 w-3" />Read
                    </span>
                  ) : (
                    <span className="text-[10px] text-orange-500 flex items-center gap-1 shrink-0 mt-1">
                      <Clock className="h-3 w-3" />Unread
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
