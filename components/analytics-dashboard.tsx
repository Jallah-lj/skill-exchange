'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Activity, Zap } from 'lucide-react'

interface AnalyticsData {
  totalSessions: number
  completedSessions: number
  totalMatches: number
  averageRating: number
  weeklyActivity: Array<{ day: string; count: number }>
  sessionsByCategory: Array<{ name: string; value: number }>
}

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626']

export function AnalyticsDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        // Fetch sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*, match:match_requests(from_user_id, to_user_id)')
          .order('created_at', { ascending: false })

        // Fetch matches
        const { data: matches } = await supabase
          .from('match_requests')
          .select('*')
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)

        // Fetch reviews
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .or(`reviewer_id.eq.${userId},reviewee_id.eq.${userId}`)

        const userSessions = sessions?.filter((s: any) => {
          const match = s.match
          return match?.from_user_id === userId || match?.to_user_id === userId
        }) ?? []

        const completed = userSessions.filter((s: any) => s.status === 'completed').length
        const avgRating = reviews && reviews.length > 0
          ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : '0'

        // Mock weekly activity
        const weeklyActivity = Array.from({ length: 7 }, (_, i) => ({
          day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          count: Math.floor(Math.random() * 5),
        }))

        // Mock category breakdown
        const sessionsByCategory = [
          { name: 'Technology', value: Math.floor(userSessions.length * 0.4) },
          { name: 'Language', value: Math.floor(userSessions.length * 0.3) },
          { name: 'Music', value: Math.floor(userSessions.length * 0.2) },
          { name: 'Other', value: Math.floor(userSessions.length * 0.1) },
        ]

        setData({
          totalSessions: userSessions.length,
          completedSessions: completed,
          totalMatches: matches?.length ?? 0,
          averageRating: parseFloat(avgRating),
          weeklyActivity,
          sessionsByCategory: sessionsByCategory.filter(c => c.value > 0),
        })
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [userId, supabase])

  if (loading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Sessions</p>
                <p className="text-2xl font-bold">{data.totalSessions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-2xl font-bold">{data.completedSessions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Matches</p>
                <p className="text-2xl font-bold">{data.totalMatches}</p>
              </div>
              <Zap className="h-8 w-8 text-violet-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Rating</p>
                <p className="text-2xl font-bold">{data.averageRating || '—'}</p>
              </div>
              <span className="text-3xl">⭐</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sessions by Category */}
        {data.sessionsByCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sessions by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.sessionsByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.sessionsByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
