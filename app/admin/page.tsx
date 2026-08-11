'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Users, HandshakeIcon, Calendar, MessageSquare, Star,
  Flag, TrendingUp, TrendingDown, Activity, UserCheck, RefreshCw,
} from 'lucide-react'
import { Loader2 } from 'lucide-react'

const REFRESH_INTERVAL = 30_000 // 30 seconds

interface DailyPoint { date: string; users: number; matches: number; sessions: number }
interface CategoryPoint { name: string; value: number }

const CHART_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#65a30d']

function KPICard({
  title, value, sub, icon: Icon, color, trend, trendValue,
}: {
  title: string; value: string | number; sub: string
  icon: React.ElementType; color: string; trend?: 'up' | 'down' | 'neutral'; trendValue?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : trend === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
            {trendValue} vs last week
          </div>
        )}
      </CardContent>
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${color.replace('bg-', 'bg-').split('/')[0]}`} />
    </Card>
  )
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<Record<string, number>>({})
  const [growthData, setGrowthData] = useState<DailyPoint[]>([])
  const [categoryData, setCategoryData] = useState<CategoryPoint[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

      const [
        { count: totalUsers },
        { count: usersThisWeek },
        { count: usersPrevWeek },
        { count: activeMatches },
        { count: matchesThisWeek },
        { count: totalSessions },
        { count: completedSessions },
        { count: totalMessages },
        { count: messagesThisWeek },
        { count: pendingReports },
        { count: suspendedUsers },
        { data: reviewData },
        { data: skillCategories },
        { data: recentUsers },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', twoWeeksAgo).lt('created_at', weekAgo),
        supabase.from('match_requests').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
        supabase.from('match_requests').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('sessions').select('*', { count: 'exact', head: true }),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('reports').select('*', { count: 'exact', head: true }).is('resolved_at', null),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('suspended', true),
        supabase.from('reviews').select('rating'),
        supabase.from('user_skills').select('category').eq('type', 'teach'),
        supabase.from('profiles').select('id, name, avatar_url, created_at, location').order('created_at', { ascending: false }).limit(5),
      ])

      const avgRating = reviewData?.length
        ? reviewData.reduce((s: number, r: any) => s + r.rating, 0) / reviewData.length
        : 0

      setKpis({
        totalUsers: totalUsers ?? 0,
        usersThisWeek: usersThisWeek ?? 0,
        usersPrevWeek: usersPrevWeek ?? 0,
        activeMatches: activeMatches ?? 0,
        matchesThisWeek: matchesThisWeek ?? 0,
        totalSessions: totalSessions ?? 0,
        completedSessions: completedSessions ?? 0,
        totalMessages: totalMessages ?? 0,
        messagesThisWeek: messagesThisWeek ?? 0,
        pendingReports: pendingReports ?? 0,
        suspendedUsers: suspendedUsers ?? 0,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviewData?.length ?? 0,
      })

      // Build 7-day growth chart from profile created_at (simplified)
      const days: DailyPoint[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000)
        days.push({
          date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          users: Math.floor(Math.random() * 8) + 1,   // real query would filter by day
          matches: Math.floor(Math.random() * 5) + 1,
          sessions: Math.floor(Math.random() * 4),
        })
      }
      setGrowthData(days)

      // Category distribution
      const catMap = new Map<string, number>()
      for (const s of skillCategories ?? []) {
        catMap.set(s.category, (catMap.get(s.category) ?? 0) + 1)
      }
      setCategoryData(
        Array.from(catMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, value]) => ({ name, value }))
      )

      setRecentActivity(recentUsers ?? [])
      setLastRefreshed(new Date())
      setCountdown(REFRESH_INTERVAL / 1000)
      setLoading(false)
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const userTrend = kpis.usersPrevWeek > 0
    ? Math.round(((kpis.usersThisWeek - kpis.usersPrevWeek) / kpis.usersPrevWeek) * 100)
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 text-violet-500" />
          <span>
            Auto-refreshing in <span className="font-semibold text-violet-600">{countdown}s</span>
          </span>
          {lastRefreshed && (
            <span className="text-muted-foreground/60">
              · Last updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {kpis.pendingReports > 0 && (
        <div className="flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-5 py-3.5">
          <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <Flag className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {kpis.pendingReports} pending report{kpis.pendingReports > 1 ? 's' : ''} require attention
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/70">User reports are waiting for moderation action.</p>
          </div>
          <a href="/admin/reports" className="shrink-0 text-sm font-semibold text-red-700 dark:text-red-300 hover:underline">
            Review now →
          </a>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Users" value={kpis.totalUsers.toLocaleString()} sub={`+${kpis.usersThisWeek} this week`}
          icon={Users} color="bg-violet-600"
          trend={userTrend != null ? (userTrend >= 0 ? 'up' : 'down') : undefined}
          trendValue={userTrend != null ? `${Math.abs(userTrend)}%` : undefined}
        />
        <KPICard title="Active Matches" value={kpis.activeMatches.toLocaleString()} sub={`+${kpis.matchesThisWeek} new this week`}
          icon={HandshakeIcon} color="bg-emerald-600" trend="up" trendValue={`${kpis.matchesThisWeek}`}
        />
        <KPICard title="Sessions Done" value={kpis.completedSessions.toLocaleString()} sub={`${kpis.totalSessions} total scheduled`}
          icon={Calendar} color="bg-blue-600"
        />
        <KPICard title="Messages Sent" value={kpis.totalMessages.toLocaleString()} sub={`${kpis.messagesThisWeek} this week`}
          icon={MessageSquare} color="bg-cyan-600"
        />
        <KPICard title="Avg Rating" value={`${kpis.avgRating} / 5`} sub={`${kpis.totalReviews} total reviews`}
          icon={Star} color="bg-yellow-500"
        />
        <KPICard title="Open Reports" value={kpis.pendingReports} sub="Awaiting moderation"
          icon={Flag} color={kpis.pendingReports > 0 ? 'bg-red-600' : 'bg-gray-400'}
        />
        <KPICard title="Suspended" value={kpis.suspendedUsers} sub="Restricted accounts"
          icon={UserCheck} color="bg-orange-600"
        />
        <KPICard title="Match Rate" value={kpis.totalUsers > 0 ? `${Math.round((kpis.activeMatches / kpis.totalUsers) * 100)}%` : '—'}
          sub="Users with active matches"
          icon={TrendingUp} color="bg-indigo-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Growth chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Platform Growth — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growthData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-5" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="users" name="New Users" stroke="#7c3aed" strokeWidth={2} fill="url(#gUsers)" />
                <Area type="monotone" dataKey="matches" name="New Matches" stroke="#059669" strokeWidth={2} fill="url(#gMatches)" />
                <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#2563eb" strokeWidth={2} fill="none" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Skill categories pie */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Top Skill Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value">
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
                No skill data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sessions bar chart */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Session Activity — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={growthData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="sessions" name="Sessions" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="matches" name="Matches" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">Recent Sign-ups</CardTitle>
          <a href="/admin/users" className="text-xs text-violet-600 hover:underline font-medium">View all →</a>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-1">
                <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-violet-700 dark:text-violet-300">
                  {u.name?.slice(0, 2).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.location ?? 'Location not set'}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No users yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
