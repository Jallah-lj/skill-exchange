'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Shield, ShieldAlert, ShieldCheck, Lock, Eye, RefreshCw,
  Search, AlertTriangle, Activity, LogIn, LogOut, KeyRound,
  Fingerprint, Smartphone, Globe, Clock, XCircle, CheckCircle2,
  TrendingUp, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecurityLog {
  id: string
  user_id: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  profiles?: { name: string; avatar_url: string | null } | null
}

interface AuditLogEntry {
  id: string
  admin_id: string
  action: string
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  profiles?: { name: string } | null
}

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; severity: 'low' | 'medium' | 'high' }> = {
  login:           { label: 'Login',           color: 'bg-emerald-100 text-emerald-700', icon: LogIn,      severity: 'low' },
  logout:          { label: 'Logout',          color: 'bg-gray-100 text-gray-600',       icon: LogOut,     severity: 'low' },
  failed_login:    { label: 'Failed Login',    color: 'bg-orange-100 text-orange-700',   icon: XCircle,    severity: 'medium' },
  password_reset:  { label: 'Password Reset',  color: 'bg-blue-100 text-blue-700',       icon: KeyRound,   severity: 'low' },
  '2fa_enabled':   { label: '2FA Enabled',     color: 'bg-violet-100 text-violet-700',   icon: Smartphone, severity: 'low' },
  '2fa_disabled':  { label: '2FA Disabled',    color: 'bg-red-100 text-red-600',         icon: Smartphone, severity: 'high' },
  suspicious:      { label: 'Suspicious',      color: 'bg-red-100 text-red-700',         icon: ShieldAlert,severity: 'high' },
  brute_force:     { label: 'Brute Force',     color: 'bg-red-200 text-red-800',         icon: AlertTriangle, severity: 'high' },
}

const REFRESH_INTERVAL = 30_000

export default function SecurityCenterPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<SecurityLog[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'logs' | 'audit' | 'threats'>('overview')
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [stats, setStats] = useState({
    totalLogins: 0,
    failedLogins: 0,
    activeUsers: 0,
    threats: 0,
    uniqueIPs: 0,
    highSeverity: 0,
  })

  const load = useCallback(async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    const [{ data: logsData }, { data: auditData }] = await Promise.all([
      supabase
        .from('security_logs')
        .select('*, profiles(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('audit_logs')
        .select('*, profiles:admin_id(name)')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const secLogs = logsData ?? []
    setLogs(secLogs)
    setAuditLogs(auditData ?? [])

    const todayLogs = secLogs.filter(l => l.created_at > yesterday)
    const uniqueIPs = new Set(secLogs.map(l => l.ip_address).filter(Boolean)).size
    const highSev = secLogs.filter(l => (EVENT_CONFIG[l.event_type]?.severity === 'high')).length

    setStats({
      totalLogins: secLogs.filter(l => l.event_type === 'login').length,
      failedLogins: todayLogs.filter(l => l.event_type === 'failed_login').length,
      activeUsers: new Set(todayLogs.filter(l => l.event_type === 'login').map(l => l.user_id)).size,
      threats: secLogs.filter(l => ['suspicious', 'brute_force'].includes(l.event_type)).length,
      uniqueIPs,
      highSeverity: highSev,
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

  const logSecurityEvent = async (type: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('security_logs').insert({
      user_id: user?.id,
      event_type: type,
      ip_address: 'manual',
      metadata: { source: 'admin_manual', admin: user?.email },
    })
    toast.success('Security event logged')
    load()
  }

  const filteredLogs = logs.filter(l => {
    if (eventFilter !== 'all' && l.event_type !== eventFilter) return false
    if (search && !l.profiles?.name?.toLowerCase().includes(search.toLowerCase()) && !l.ip_address?.includes(search)) return false
    return true
  })

  const threats = logs.filter(l => ['suspicious', 'brute_force'].includes(l.event_type))

  // IP frequency analysis
  const ipMap: Record<string, { count: number; failedLogins: number; lastSeen: string }> = {}
  for (const log of logs) {
    if (!log.ip_address) continue
    if (!ipMap[log.ip_address]) ipMap[log.ip_address] = { count: 0, failedLogins: 0, lastSeen: log.created_at }
    ipMap[log.ip_address].count++
    if (log.event_type === 'failed_login') ipMap[log.ip_address].failedLogins++
  }
  const suspiciousIPs = Object.entries(ipMap)
    .filter(([, v]) => v.failedLogins >= 3)
    .sort(([, a], [, b]) => b.failedLogins - a.failedLogins)
    .slice(0, 10)

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Login monitoring · Threat detection · Auto-refreshing in {countdown}s
          </p>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Security score */}
      <div className={cn(
        'rounded-xl border p-5 flex items-center gap-5',
        stats.threats > 0 || stats.failedLogins > 10
          ? 'bg-red-50 dark:bg-red-950/20 border-red-200'
          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'
      )}>
        {stats.threats > 0 || stats.failedLogins > 10 ? (
          <ShieldAlert className="h-10 w-10 text-red-500 shrink-0" />
        ) : (
          <ShieldCheck className="h-10 w-10 text-emerald-500 shrink-0" />
        )}
        <div>
          <p className="font-bold text-lg">
            {stats.threats > 0 ? 'Active Threats Detected' : stats.failedLogins > 10 ? 'Elevated Failed Logins' : 'Platform Secure'}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.threats} threat events · {stats.failedLogins} failed logins today · {stats.uniqueIPs} unique IPs in logs
          </p>
        </div>
        {stats.threats > 0 && (
          <Button
            size="sm"
            className="ml-auto bg-red-600 hover:bg-red-700 gap-2 shrink-0"
            onClick={() => setTab('threats')}
          >
            <AlertTriangle className="h-4 w-4" />
            Review Threats
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Logins',    value: stats.totalLogins,   color: 'text-emerald-600', icon: LogIn },
          { label: 'Failed Today',    value: stats.failedLogins,  color: stats.failedLogins > 5 ? 'text-red-600' : 'text-orange-600', icon: XCircle },
          { label: 'Active Users',    value: stats.activeUsers,   color: 'text-blue-600', icon: Users },
          { label: 'Threat Events',   value: stats.threats,       color: stats.threats > 0 ? 'text-red-600' : 'text-gray-400', icon: ShieldAlert },
          { label: 'Unique IPs',      value: stats.uniqueIPs,     color: 'text-gray-700', icon: Globe },
          { label: 'High Severity',   value: stats.highSeverity,  color: stats.highSeverity > 0 ? 'text-red-600' : 'text-gray-400', icon: AlertTriangle },
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
        {(['overview', 'logs', 'audit', 'threats'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
              tab === t ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'threats' && stats.threats > 0 ? (
              <span className="flex items-center gap-1.5">
                Threats
                <span className="h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {stats.threats}
                </span>
              </span>
            ) : (
              t.charAt(0).toUpperCase() + t.slice(1)
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent Security Events</h3>
              <button className="text-xs text-violet-600 hover:underline" onClick={() => setTab('logs')}>View all</button>
            </div>
            <div className="divide-y">
              {logs.slice(0, 8).map(log => {
                const cfg = EVENT_CONFIG[log.event_type] ?? { label: log.event_type, color: 'bg-gray-100 text-gray-600', icon: Activity, severity: 'low' as const }
                const Icon = cfg.icon
                return (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', cfg.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{log.profiles?.name ?? 'Unknown user'}</p>
                      <p className="text-[10px] text-muted-foreground">{cfg.label} · {log.ip_address ?? 'unknown IP'}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                )
              })}
              {logs.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No security logs yet</p>
              )}
            </div>
          </div>

          {/* Suspicious IPs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">Suspicious IP Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">IPs with 3+ failed logins</p>
            </div>
            <div className="divide-y">
              {suspiciousIPs.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No suspicious IPs detected</p>
                </div>
              ) : (
                suspiciousIPs.map(([ip, data]) => (
                  <div key={ip} className="flex items-center gap-3 px-4 py-3">
                    <Globe className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-medium">{ip}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {data.count} total events · Last seen {new Date(data.lastSeen).toLocaleString()}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 text-[10px]">
                      {data.failedLogins} failed
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2FA Status note */}
          <div className="lg:col-span-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-300">Two-Factor Authentication (2FA / MFA)</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  2FA/MFA is managed via Supabase Auth settings. To enforce MFA platform-wide, enable it in your Supabase Dashboard under{' '}
                  <strong>Authentication → Settings → Multi-Factor Authentication</strong>. You can also require MFA per user via the Supabase Admin API.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={eventFilter} onValueChange={(v) => { if (v) setEventFilter(v) }}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Event type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {Object.entries(EVENT_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search name or IP…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-56 text-sm" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
            {filteredLogs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No security logs found</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Event</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">IP Address</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.map(log => {
                    const cfg = EVENT_CONFIG[log.event_type] ?? { label: log.event_type, color: 'bg-gray-100 text-gray-600', icon: Activity }
                    const Icon = cfg.icon
                    return (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5 text-sm">{log.profiles?.name ?? 'Unknown'}</td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge className={cn('text-[10px] gap-1', cfg.color)}>
                            <Icon className="h-2.5 w-2.5" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{log.ip_address ?? '—'}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
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

      {tab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border divide-y">
          {auditLogs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">No audit logs found</p>
          ) : (
            auditLogs.map(log => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.profiles?.name ?? 'Admin'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.action}
                    {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                      <> · <span className="font-mono">{JSON.stringify(log.details).slice(0, 60)}</span></>
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'threats' && (
        <div className="space-y-4">
          {threats.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border text-center py-16">
              <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold">No Active Threats</p>
              <p className="text-sm text-muted-foreground mt-1">The platform looks clean</p>
            </div>
          ) : (
            threats.map(threat => {
              const cfg = EVENT_CONFIG[threat.event_type] ?? EVENT_CONFIG.suspicious
              const Icon = cfg.icon
              return (
                <div key={threat.id} className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl p-5 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-red-800 dark:text-red-300">{cfg.label}</p>
                      <Badge className="bg-red-200 text-red-800 text-[10px]">HIGH</Badge>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      User: {threat.profiles?.name ?? 'Unknown'} · IP: {threat.ip_address ?? 'N/A'}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                      {new Date(threat.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 shrink-0" onClick={() => toast.info('Navigate to Users to suspend this account')}>
                    Investigate
                  </Button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
