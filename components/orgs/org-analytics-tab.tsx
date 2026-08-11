'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Users, Heart, MessageCircle, Eye, Layout, Calendar } from 'lucide-react'
import type { Organization } from '@/lib/types'

// Validated palette (dataviz reference instance): slots 1–3, stepped per mode.
// Light-mode aqua/yellow sit under 3:1 on white → relief via legend + value labels.
const PALETTE = {
  light: {
    likes: '#2a78d6',    // blue — slot 1
    comments: '#1baf7a', // aqua — slot 2
    views: '#eda100',    // yellow — slot 3
    single: '#4a3aa7',   // violet — single-series line
    grid: '#e5e5e3',
    text: '#52514e',
  },
  dark: {
    likes: '#3987e5',
    comments: '#199e70',
    views: '#c98500',
    single: '#9085e9',
    grid: '#3a3a38',
    text: '#c3c2b7',
  },
}

const WEEKS = 8
const WEEK_MS = 7 * 86_400_000

interface WeeklyRow {
  week: string
  likes: number
  comments: number
  views: number
  total: number
}

interface GrowthRow {
  week: string
  members: number
}

interface TopPost {
  id: string
  title: string
  likes: number
  comments: number
  views: number
  score: number
}

interface WorkshopRow {
  id: string
  title: string
  scheduled_at: string
  attendees: number
  max_participants: number | null
}

interface AnalyticsData {
  memberTotal: number
  membersThisWeek: number
  postTotal: number
  engagementTotal: number
  viewTotal: number
  growth: GrowthRow[]
  weekly: WeeklyRow[]
  topPosts: TopPost[]
  workshops: WorkshopRow[]
}

function weekLabel(start: Date) {
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function OrgAnalyticsTab({ org }: { org: Organization }) {
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const colors = PALETTE[resolvedTheme === 'dark' ? 'dark' : 'light']

  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: members }, { data: posts }] = await Promise.all([
        supabase.from('organization_members').select('created_at').eq('organization_id', org.id),
        supabase.from('organization_posts').select('id, title, created_at').eq('organization_id', org.id).is('deleted_at', null),
      ])
      const postIds = (posts ?? []).map((p) => p.id)

      const [{ data: likes }, { data: comments }, { data: views }, { data: workshops }] = await Promise.all([
        postIds.length ? supabase.from('post_likes').select('post_id, created_at').in('post_id', postIds) : Promise.resolve({ data: [] }),
        postIds.length ? supabase.from('post_comments').select('post_id, created_at').in('post_id', postIds) : Promise.resolve({ data: [] }),
        postIds.length ? supabase.from('post_views').select('post_id, created_at').in('post_id', postIds) : Promise.resolve({ data: [] }),
        supabase
          .from('workshops')
          .select('id, title, scheduled_at, max_participants, workshop_attendees(count)')
          .eq('organization_id', org.id)
          .order('scheduled_at', { ascending: false })
          .limit(6),
      ])

      const now = Date.now()
      const weekStarts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * WEEK_MS)

      const countIn = (rows: { created_at: string }[] | null, from: number, to: number) =>
        (rows ?? []).filter((r) => {
          const t = new Date(r.created_at).getTime()
          return t >= from && t < to
        }).length

      const weekly: WeeklyRow[] = weekStarts.map((start) => {
        const end = start + WEEK_MS
        const l = countIn(likes as never, start, end)
        const c = countIn(comments as never, start, end)
        const v = countIn(views as never, start, end)
        return { week: weekLabel(new Date(start)), likes: l, comments: c, views: v, total: l + c + v }
      })

      const growth: GrowthRow[] = weekStarts.map((start) => ({
        week: weekLabel(new Date(start)),
        members: (members ?? []).filter((m) => new Date(m.created_at).getTime() < start + WEEK_MS).length,
      }))

      const perPost = new Map<string, TopPost>()
      for (const p of posts ?? []) perPost.set(p.id, { id: p.id, title: p.title, likes: 0, comments: 0, views: 0, score: 0 })
      for (const l of (likes ?? []) as { post_id: string }[]) { const t = perPost.get(l.post_id); if (t) { t.likes++; t.score += 3 } }
      for (const c of (comments ?? []) as { post_id: string }[]) { const t = perPost.get(c.post_id); if (t) { t.comments++; t.score += 5 } }
      for (const v of (views ?? []) as { post_id: string }[]) { const t = perPost.get(v.post_id); if (t) { t.views++; t.score += 1 } }
      const topPosts = [...perPost.values()].sort((a, b) => b.score - a.score).slice(0, 5)

      setData({
        memberTotal: members?.length ?? 0,
        membersThisWeek: countIn(members, now - WEEK_MS, now + 1),
        postTotal: posts?.length ?? 0,
        engagementTotal: (likes?.length ?? 0) + (comments?.length ?? 0),
        viewTotal: views?.length ?? 0,
        growth,
        weekly,
        topPosts,
        workshops: ((workshops ?? []) as unknown as (WorkshopRow & { workshop_attendees?: Array<{ count: number }> })[])
          .map((w) => ({ ...w, attendees: w.workshop_attendees?.[0]?.count ?? 0 })),
      })
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const maxTopScore = useMemo(
    () => Math.max(1, ...(data?.topPosts.map((p) => p.score) ?? [1])),
    [data]
  )

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const tiles = [
    { label: 'Members', value: data.memberTotal, sub: data.membersThisWeek > 0 ? `+${data.membersThisWeek} this week` : 'no change this week', icon: Users },
    { label: 'Posts', value: data.postTotal, sub: 'published + hidden', icon: Layout },
    { label: 'Engagement', value: data.engagementTotal, sub: 'likes + comments, all time', icon: Heart },
    { label: 'Unique views', value: data.viewTotal, sub: 'across all posts', icon: Eye },
  ]

  const tooltipStyle = {
    backgroundColor: resolvedTheme === 'dark' ? '#262626' : '#ffffff',
    border: `1px solid ${colors.grid}`,
    borderRadius: 8,
    fontSize: 12,
  }

  return (
    <div className="space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border p-4">
            <t.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-bold leading-none">{t.value}</p>
            <p className="mt-1 text-xs font-medium">{t.label}</p>
            <p className="text-[11px] text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Member growth */}
        <Card className="border-0 ring-1 ring-border shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Member growth</CardTitle>
            <CardDescription>Total members at the end of each week.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.growth} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: colors.grid }} />
                <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: colors.grid }} />
                <Line
                  type="monotone"
                  dataKey="members"
                  name="Members"
                  stroke={colors.single}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly engagement */}
        <Card className="border-0 ring-1 ring-border shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Weekly engagement</CardTitle>
            <CardDescription>Likes, comments, and unique views per week across all posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.weekly} margin={{ top: 16, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={{ stroke: colors.grid }} />
                <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.grid, opacity: 0.3 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="likes" name="Likes" stackId="e" fill={colors.likes} stroke="var(--background)" strokeWidth={2} />
                <Bar dataKey="comments" name="Comments" stackId="e" fill={colors.comments} stroke="var(--background)" strokeWidth={2} />
                <Bar dataKey="views" name="Views" stackId="e" fill={colors.views} stroke="var(--background)" strokeWidth={2} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total" position="top" style={{ fill: colors.text, fontSize: 10 }} formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top posts */}
      <Card className="border-0 ring-1 ring-border shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Top performing posts</CardTitle>
          <CardDescription>Ranked by weighted engagement (comments ×5, likes ×3, views ×1).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            data.topPosts.map((p, i) => (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="min-w-0 truncate font-medium">
                    <span className="mr-2 text-muted-foreground">#{i + 1}</span>{p.title}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    <Eye className="mr-0.5 inline h-3 w-3" /> {p.views}
                    <Heart className="ml-2 mr-0.5 inline h-3 w-3" /> {p.likes}
                    <MessageCircle className="ml-2 mr-0.5 inline h-3 w-3" /> {p.comments}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(4, (p.score / maxTopScore) * 100)}%`, backgroundColor: colors.single }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Workshop attendance */}
      <Card className="border-0 ring-1 ring-border shadow-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" /> Workshop attendance
          </CardTitle>
          <CardDescription>Registrations for your most recent workshops.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.workshops.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workshops yet.</p>
          ) : (
            <div className="space-y-2">
              {data.workshops.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{w.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(w.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold">
                    {w.attendees}{w.max_participants != null ? ` / ${w.max_participants}` : ''} registered
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
