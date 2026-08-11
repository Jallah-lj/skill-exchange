'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Calendar, Users, MessageSquare,
  Clock, ShieldCheck, AlertTriangle,
  BarChart3, Users2, FileText,
} from 'lucide-react'
import type { Profile } from '@/lib/types'
import { FeatureCard } from '@/components/feature-card'

interface SessionWithMatch {
  id: string
  scheduled_at: string
  duration_minutes: number
  skill_focus: string
  notes: string | null
  status: string
  match_id: string
  otherUser: Profile
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<SessionWithMatch[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [requestingVerification, setRequestingVerification] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    const [{ data: profileData }, { data: matchData }, { data: sessionData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('match_requests')
        .select('*, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
      supabase.from('sessions')
        .select('*, match:match_requests(from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*))')
        .order('scheduled_at', { ascending: true }),
    ])

    setProfile(profileData)

    const accepted = (matchData ?? []).filter((m: any) => m.status === 'accepted')
    const pending = (matchData ?? []).filter((m: any) => m.status === 'pending' && m.to_user_id === user.id)
    setMatchCount(accepted.length)
    setPendingCount(pending.length)

    const userMatchIds = (matchData ?? []).map((m: any) => m.id)
    const userSessions: SessionWithMatch[] = ((sessionData ?? []) as any[])
      .filter((s) => userMatchIds.includes(s.match_id))
      .map((s) => {
        const match = s.match as any
        const otherUser = match.from_user_id === user.id ? match.to_profile : match.from_profile
        return { ...s, otherUser }
      })

    setSessions(userSessions)
    setLoading(false)
  }

  const requestVerification = async () => {
    if (!currentUserId) return
    setRequestingVerification(true)
    const { error } = await supabase
      .from('profiles')
      .update({ kyc_status: 'pending' })
      .eq('id', currentUserId)
    if (error) {
      toast.error('Failed to submit — please try again')
    } else {
      toast.success('Verification request submitted! We\'ll review it within 24–48 hours.')
      setProfile((p) => p ? { ...p, kyc_status: 'pending' } : p)
    }
    setRequestingVerification(false)
  }

  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date())

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const kycStatus = profile?.kyc_status ?? 'unverified'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back{profile ? `, ${profile.name.split(' ')[0]}` : ''}!
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/browse" />}>Find new matches</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{matchCount}</p>
                <p className="text-xs text-muted-foreground">Active matches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcoming.length}</p>
                <p className="text-xs text-muted-foreground">Upcoming sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          href="/dashboard/analytics"
          icon={BarChart3}
          title="Analytics"
          description="View your activity stats, session history, and performance insights"
          color="bg-blue-600"
        />
        <FeatureCard
          href="/orgs"
          icon={Users2}
          title="Community"
          description="Join organizations, connect with groups, and find communities"
          color="bg-emerald-600"
        />
        <FeatureCard
          href="/resources"
          icon={FileText}
          title="Resources"
          description="Articles, guides, and announcements from the SkillSwap team"
          color="bg-orange-600"
        />
      </div>

      {kycStatus === 'pending' && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-200">Verification under review</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">
                  Our team is reviewing your request. This usually takes 24–48 hours. We'll notify you when it's done.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {kycStatus === 'rejected' && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-900 dark:text-red-200">Verification not approved</p>
                {profile?.kyc_rejection_reason && (
                  <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                    Reason: {profile.kyc_rejection_reason}
                  </p>
                )}
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  You can re-apply once you have addressed the reason above.
                </p>
              </div>
              <Button
                onClick={requestVerification}
                disabled={requestingVerification}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              >
                {requestingVerification ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Re-apply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {kycStatus === 'verified' && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Identity verified</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Your account is fully verified. Your Verified Member badge is visible on your public profile.
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                ✓ Verified
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending requests alert */}
      {pendingCount > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                You have {pendingCount} incoming match request{pendingCount > 1 ? 's' : ''} waiting for your response.
              </p>
              <Button size="sm" nativeButton={false} render={<Link href="/matches" />}>Review</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions teaser — full management lives on /sessions */}
      <Card>
        <CardContent className="pt-5 pb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  Next: {upcoming[0].skill_focus} with {upcoming[0].otherUser.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(upcoming[0].scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {upcoming.length > 1 && ` · +${upcoming.length - 1} more upcoming`}
                </p>
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/sessions" />}>
            View all sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
