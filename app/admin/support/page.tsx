'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Headphones, RefreshCw, Search, Clock, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Send, MessageSquare,
  ChevronRight, ArrowUpRight, User, Filter, Star, Timer, BarChart3, Bug,
  Paperclip, FileIcon, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ATTACHMENT_ACCEPT, validateAttachment } from '@/lib/support-attachments'

interface Ticket {
  id: string
  user_id: string | null
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category: 'account' | 'password' | 'organization' | 'payments' | 'security' | 'technical_issue' | 'feature_request' | 'bug_report' | 'general_question' | 'abuse_report'
  satisfaction_rating: number | null
  satisfaction_comment: string | null
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  profiles?: { name: string; avatar_url: string | null } | null
}

interface TicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  content: string | null
  is_admin: boolean
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: 'image' | 'pdf' | 'word' | 'log' | 'video' | null
  created_at: string
  profiles?: { name: string; avatar_url: string | null } | null
}

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700',    icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: TrendingUp },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-600',    icon: XCircle },
  escalated:   { label: 'Escalated',   color: 'bg-red-100 text-red-700',      icon: AlertTriangle },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: 'text-gray-500' },
  normal: { label: 'Normal', color: 'text-blue-600' },
  high:   { label: 'High',   color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
}

const CATEGORY_CONFIG = {
  account:          { label: 'Account' },
  password:         { label: 'Password' },
  organization:     { label: 'Organization' },
  payments:         { label: 'Payments' },
  security:         { label: 'Security' },
  technical_issue:  { label: 'Technical Issue' },
  feature_request:  { label: 'Feature Request' },
  bug_report:       { label: 'Bug Report' },
  general_question: { label: 'General Question' },
  abuse_report:     { label: 'Abuse Report' },
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

const REFRESH_INTERVAL = 30_000

export default function SupportCenterPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Ticket['status']>('open')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Ticket['priority']>('all')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [tab, setTab] = useState<'tickets' | 'analytics'>('tickets')
  const [firstReplyByTicket, setFirstReplyByTicket] = useState<Map<string, string>>(new Map())
  const [agentNames, setAgentNames] = useState<Map<string, string>>(new Map())
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, profiles!support_tickets_user_id_fkey(name, avatar_url)')
      .order('updated_at', { ascending: false })
    if (error) { toast.error(error.message || 'Failed to load tickets'); setLoading(false); return }
    setTickets(data ?? [])
    setCountdown(REFRESH_INTERVAL / 1000)
    setLoading(false)
  }, [])

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*, profiles!support_messages_sender_id_fkey(name, avatar_url)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    if (error) { toast.error(error.message || 'Failed to load messages'); return }
    setMessages(data ?? [])
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

  useEffect(() => {
    if (selectedTicket) loadMessages(selectedTicket.id)
  }, [selectedTicket, loadMessages])

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true)
    const { data: adminReplies } = await supabase
      .from('support_messages')
      .select('ticket_id, created_at')
      .eq('is_admin', true)
      .order('created_at', { ascending: true })

    const firstReply = new Map<string, string>()
    for (const m of adminReplies ?? []) {
      if (!firstReply.has(m.ticket_id)) firstReply.set(m.ticket_id, m.created_at)
    }
    setFirstReplyByTicket(firstReply)

    const agentIds = [...new Set(tickets.map((t) => t.assigned_to).filter((id): id is string => !!id))]
    if (agentIds.length) {
      const { data: agents } = await supabase.from('profiles').select('id, name').in('id', agentIds)
      setAgentNames(new Map((agents ?? []).map((a) => [a.id, a.name])))
    }
    setLoadingAnalytics(false)
  }, [tickets])

  useEffect(() => {
    if (tab === 'analytics') loadAnalytics()
  }, [tab, loadAnalytics])

  const analytics = useMemo(() => {
    const responseTimes: number[] = []
    for (const t of tickets) {
      const firstReply = firstReplyByTicket.get(t.id)
      if (firstReply) responseTimes.push(new Date(firstReply).getTime() - new Date(t.created_at).getTime())
    }
    const avgResponseMs = responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null

    const resolutionTimes: number[] = []
    for (const t of tickets) {
      if (t.resolved_at) resolutionTimes.push(new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime())
    }
    const avgResolutionMs = resolutionTimes.length ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : null

    const categoryCounts = new Map<string, number>()
    for (const t of tickets) {
      const cat = t.category ?? 'uncategorized'
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    }
    const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])

    const bugCounts = new Map<string, number>()
    const bugDisplay = new Map<string, string>()
    for (const t of tickets) {
      if (t.category !== 'bug_report') continue
      const key = t.subject.trim().toLowerCase()
      bugCounts.set(key, (bugCounts.get(key) ?? 0) + 1)
      if (!bugDisplay.has(key)) bugDisplay.set(key, t.subject.trim())
    }
    const topBugs = [...bugCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ subject: bugDisplay.get(key) ?? key, count }))

    const agentStats = new Map<string, { resolved: number; resolutionTimes: number[]; ratings: number[] }>()
    for (const t of tickets) {
      if (!t.assigned_to) continue
      const entry = agentStats.get(t.assigned_to) ?? { resolved: 0, resolutionTimes: [], ratings: [] }
      if (t.resolved_at) {
        entry.resolved += 1
        entry.resolutionTimes.push(new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime())
      }
      if (t.satisfaction_rating) entry.ratings.push(t.satisfaction_rating)
      agentStats.set(t.assigned_to, entry)
    }
    const agentPerformance = [...agentStats.entries()].map(([agentId, s]) => ({
      agentId,
      name: agentNames.get(agentId) ?? 'Unknown',
      resolved: s.resolved,
      avgResolutionMs: s.resolutionTimes.length ? s.resolutionTimes.reduce((a, b) => a + b, 0) / s.resolutionTimes.length : null,
      avgRating: s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null,
    })).sort((a, b) => b.resolved - a.resolved)

    const ratedTickets = tickets.filter((t) => t.satisfaction_rating != null)
    const avgSatisfaction = ratedTickets.length
      ? ratedTickets.reduce((a, t) => a + (t.satisfaction_rating ?? 0), 0) / ratedTickets.length
      : null
    const satisfactionDistribution = [5, 4, 3, 2, 1].map((n) => ({
      rating: n,
      count: ratedTickets.filter((t) => t.satisfaction_rating === n).length,
    }))

    return {
      avgResponseMs, avgResolutionMs, topCategories, topBugs, agentPerformance,
      avgSatisfaction, satisfactionDistribution, ratedCount: ratedTickets.length,
    }
  }, [tickets, firstReplyByTicket, agentNames])

  const selectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    const updates: Record<string, any> = {}
    if (ticket.status === 'open') updates.status = 'in_progress'
    if (!ticket.assigned_to) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) updates.assigned_to = user.id
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await supabase.from('support_tickets').update(updates).eq('id', ticket.id)
      load()
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selectedTicket) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: selectedTicket.id,
      sender_id: user?.id,
      content: reply,
      is_admin: true,
    })
    if (error) toast.error(error.message)
    else {
      setReply('')
      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicket.id)
      loadMessages(selectedTicket.id)
      if (selectedTicket.user_id) {
        await supabase.from('notifications').insert({
          user_id: selectedTicket.user_id,
          type: 'support_ticket',
          title: `Support replied to "${selectedTicket.subject}"`,
          href: '/support',
        })
      }
    }
    setSending(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTicket) return

    const check = validateAttachment(file)
    if (!check.ok) {
      toast.error(check.error)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingFile(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.slice(file.name.lastIndexOf('.'))
      const path = `support-tickets/${selectedTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)

      const { error: insertError } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicket.id,
        sender_id: user?.id,
        is_admin: true,
        attachment_url: publicUrl,
        attachment_name: file.name,
        attachment_type: check.kind,
      })
      if (insertError) throw insertError

      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicket.id)
      loadMessages(selectedTicket.id)
      if (selectedTicket.user_id) {
        await supabase.from('notifications').insert({
          user_id: selectedTicket.user_id,
          type: 'support_ticket',
          title: `Support replied to "${selectedTicket.subject}"`,
          href: '/support',
        })
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload attachment')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const changeStatus = async (status: Ticket['status']) => {
    if (!selectedTicket) return
    setUpdatingStatus(true)
    const { error } = await supabase.from('support_tickets').update({
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedTicket.id)
    if (error) toast.error(error.message)
    else {
      toast.success(`Ticket ${status}`)
      setSelectedTicket(t => t ? { ...t, status } : t)
      load()
      if (selectedTicket.user_id) {
        await supabase.from('notifications').insert({
          user_id: selectedTicket.user_id,
          type: 'support_ticket',
          title: `Your ticket "${selectedTicket.subject}" is now ${STATUS_CONFIG[status].label.toLowerCase()}`,
          href: '/support',
        })
      }
    }
    setUpdatingStatus(false)
  }

  const stats = {
    open:       tickets.filter(t => t.status === 'open').length,
    in_progress:tickets.filter(t => t.status === 'in_progress').length,
    resolved:   tickets.filter(t => t.status === 'resolved').length,
    escalated:  tickets.filter(t => t.status === 'escalated').length,
    urgent:     tickets.filter(t => t.priority === 'urgent').length,
  }

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.profiles?.name?.toLowerCase().includes(search.toLowerCase())) return false
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customer tickets · Escalations · Auto-refreshing in {countdown}s
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (v) setTab(v as typeof tab) }}>
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5"><Headphones className="h-3.5 w-3.5" /> Tickets</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-6 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { key: 'open',        label: 'Open',        color: 'text-blue-600',   bg: 'bg-blue-50' },
          { key: 'in_progress', label: 'In Progress', color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { key: 'resolved',    label: 'Resolved',    color: 'text-emerald-600',bg: 'bg-emerald-50' },
          { key: 'escalated',   label: 'Escalated',   color: 'text-red-600',    bg: 'bg-red-50' },
          { key: 'urgent',      label: 'Urgent',      color: 'text-red-700',    bg: 'bg-red-50' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => s.key !== 'urgent' ? setStatusFilter(s.key as Ticket['status']) : setPriorityFilter('urgent')}
            className={cn(
              'bg-white dark:bg-gray-800 rounded-xl border p-4 text-left hover:shadow-sm transition-all',
              (statusFilter === s.key || (s.key === 'urgent' && priorityFilter === 'urgent')) && 'ring-2 ring-violet-500'
            )}
          >
            <p className={cn('text-2xl font-bold', s.color)}>{stats[s.key as keyof typeof stats]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ticket list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border text-center py-12">
                <Headphones className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tickets found</p>
              </div>
            )}
            {filtered.map(ticket => {
              const StatusInfo = STATUS_CONFIG[ticket.status]
              const StatusIcon = StatusInfo.icon
              const PriorityInfo = PRIORITY_CONFIG[ticket.priority]
              return (
                <button
                  key={ticket.id}
                  onClick={() => selectTicket(ticket)}
                  className={cn(
                    'w-full text-left bg-white dark:bg-gray-800 rounded-xl border p-4 hover:shadow-sm transition-all',
                    selectedTicket?.id === ticket.id && 'ring-2 ring-violet-500'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={ticket.profiles?.avatar_url ?? ''} />
                      <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                        {ticket.profiles?.name?.slice(0, 2).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground truncate">{ticket.profiles?.name ?? 'Unknown'}</p>
                        <span className={cn('text-[10px] font-bold uppercase', PriorityInfo.color)}>{PriorityInfo.label}</span>
                      </div>
                      <p className="text-sm font-medium mt-0.5 truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={cn('text-[10px] gap-1', StatusInfo.color)}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {StatusInfo.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{CATEGORY_CONFIG[ticket.category]?.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(ticket.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Ticket detail */}
        <div className="lg:col-span-3">
          {selectedTicket ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border flex flex-col" style={{ height: '600px' }}>
              {/* Ticket header */}
              <div className="p-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{selectedTicket.subject}</p>
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_CONFIG[selectedTicket.category]?.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      From {selectedTicket.profiles?.name} · {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={v => changeStatus(v as Ticket['status'])}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Original request</p>
                  <p className="text-sm">{selectedTicket.description}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={cn('flex gap-3', msg.is_admin && 'flex-row-reverse')}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={msg.profiles?.avatar_url ?? ''} />
                      <AvatarFallback className={cn('text-[10px] font-bold', msg.is_admin ? 'bg-violet-600 text-white' : 'bg-gray-200')}>
                        {msg.is_admin ? 'AD' : msg.profiles?.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      'max-w-[75%] rounded-xl px-3.5 py-2.5',
                      msg.is_admin ? 'bg-violet-600 text-white' : 'bg-muted'
                    )}>
                      {msg.content && <p className="text-sm">{msg.content}</p>}
                      {msg.attachment_url && msg.attachment_type === 'image' && (
                        <img
                          src={msg.attachment_url}
                          alt={msg.attachment_name || 'Attachment'}
                          className="max-w-full max-h-64 rounded-md mt-1.5 cursor-pointer hover:opacity-90"
                          onClick={() => window.open(msg.attachment_url!, '_blank')}
                        />
                      )}
                      {msg.attachment_url && msg.attachment_type === 'video' && (
                        <video controls className="max-w-full max-h-64 rounded-md mt-1.5" src={msg.attachment_url} />
                      )}
                      {msg.attachment_url && !['image', 'video'].includes(msg.attachment_type ?? '') && (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2.5 py-2 mt-1.5 text-xs font-medium hover:opacity-80',
                            msg.is_admin ? 'bg-white/15' : 'bg-background/60'
                          )}
                        >
                          <FileIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{msg.attachment_name || 'Attachment'}</span>
                        </a>
                      )}
                      <p className={cn('text-[10px] mt-1', msg.is_admin ? 'text-violet-200' : 'text-muted-foreground')}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">No messages yet — send the first reply</p>
                )}
              </div>

              {/* Reply box */}
              {!['closed', 'resolved'].includes(selectedTicket.status) && (
                <div className="p-4 border-t flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-end"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach a file"
                  >
                    {uploadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  </Button>
                  <Textarea
                    placeholder="Type your reply…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    className="resize-none text-sm"
                    rows={2}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply()
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button onClick={sendReply} disabled={sending || !reply.trim()} className="gap-2 h-full" size="sm">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border flex items-center justify-center" style={{ height: '600px' }}>
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Select a ticket to view</p>
                <p className="text-xs mt-1">Click any ticket from the list</p>
              </div>
            </div>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-4">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
            </div>
          ) : (
            <>
              {/* Response / Resolution time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Timer className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.avgResponseMs != null ? formatDuration(analytics.avgResponseMs) : '—'}</p>
                    <p className="text-xs text-muted-foreground">Average response time</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.avgResolutionMs != null ? formatDuration(analytics.avgResolutionMs) : '—'}</p>
                    <p className="text-xs text-muted-foreground">Average resolution time</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top categories */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                  <p className="text-sm font-semibold mb-4">Top Categories</p>
                  {analytics.topCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topCategories.map(([cat, count]) => {
                        const max = analytics.topCategories[0][1]
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span>{CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]?.label ?? cat}</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Most reported bugs */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                  <p className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Bug className="h-3.5 w-3.5 text-red-500" /> Most Reported Bugs</p>
                  {analytics.topBugs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bug reports yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.topBugs.map((b) => (
                        <div key={b.subject} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{b.subject}</span>
                          <Badge className="text-[10px] shrink-0 bg-red-100 text-red-700">{b.count}×</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent performance */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                <p className="text-sm font-semibold mb-4">Agent Performance</p>
                {analytics.agentPerformance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets assigned to an agent yet — opening a ticket assigns it to you.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left py-2 font-medium">Agent</th>
                        <th className="text-center py-2 font-medium">Resolved</th>
                        <th className="text-center py-2 font-medium">Avg Resolution</th>
                        <th className="text-center py-2 font-medium">Avg Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.agentPerformance.map((a) => (
                        <tr key={a.agentId}>
                          <td className="py-2.5">{a.name}</td>
                          <td className="py-2.5 text-center">{a.resolved}</td>
                          <td className="py-2.5 text-center">{a.avgResolutionMs != null ? formatDuration(a.avgResolutionMs) : '—'}</td>
                          <td className="py-2.5 text-center">
                            {a.avgRating != null ? (
                              <span className="inline-flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {a.avgRating.toFixed(1)}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Customer satisfaction */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
                <p className="text-sm font-semibold mb-4">Customer Satisfaction</p>
                {analytics.ratedCount === 0 ? (
                  <p className="text-sm text-muted-foreground">No ratings submitted yet.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="text-center shrink-0">
                      <p className="text-3xl font-bold flex items-center gap-1 justify-center">
                        {analytics.avgSatisfaction!.toFixed(1)} <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{analytics.ratedCount} rating{analytics.ratedCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {analytics.satisfactionDistribution.map(({ rating, count }) => (
                        <div key={rating} className="flex items-center gap-2 text-xs">
                          <span className="w-8 shrink-0">{rating}★</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full"
                              style={{ width: `${analytics.ratedCount ? (count / analytics.ratedCount) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-6 text-right shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
