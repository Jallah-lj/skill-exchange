'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { buildICS, downloadICS } from '@/lib/ics'
import { toast } from 'sonner'
import {
  Loader2, Calendar, Clock, Star, CheckCircle, XCircle,
  MessageSquare, CalendarDays, RefreshCw, Monitor, Check, X, Building2, MapPin,
} from 'lucide-react'
import Link from 'next/link'
import type { Profile, Workshop, Organization } from '@/lib/types'

interface SessionWithMatch {
  id: string
  match_id: string
  scheduled_at: string
  duration_minutes: number
  skill_focus: string
  notes: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
  reschedule_requested_by: string | null
  reschedule_proposed_at: string | null
  reschedule_note: string | null
  other_user: Profile
  my_review?: { rating: number; comment: string | null } | null
}

interface EnrichedWorkshop extends Omit<Workshop, 'instructor' | 'organization'> {
  organization: Organization
  instructor: Profile | null
}

export default function SessionsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [sessions, setSessions] = useState<SessionWithMatch[]>([])
  const [workshops, setWorkshops] = useState<EnrichedWorkshop[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming')

  // Review dialog
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewSession, setReviewSession] = useState<SessionWithMatch | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Reschedule dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleSession, setRescheduleSession] = useState<SessionWithMatch | null>(null)
  const [proposedAt, setProposedAt] = useState('')
  const [rescheduleNote, setRescheduleNote] = useState('')
  const [submittingReschedule, setSubmittingReschedule] = useState(false)

  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    // 1. Fetch match-based sessions
    const { data: matches } = await supabase
      .from('match_requests')
      .select('id, from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
      .eq('status', 'accepted')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)

    const matchIds = (matches ?? []).map((m: any) => m.id)
    const [{ data: sessionsData }, { data: myReviews }] = await Promise.all([
      matchIds.length > 0 
        ? supabase.from('sessions').select('*').in('match_id', matchIds).order('scheduled_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('reviews').select('session_id, rating, comment').eq('reviewer_id', user.id),
    ])

    const reviewMap = new Map((myReviews ?? []).map((r: any) => [r.session_id, r]))
    const enriched: SessionWithMatch[] = (sessionsData ?? []).map((s: any) => {
      const match = matches?.find((m: any) => m.id === s.match_id) as any
      const other = match.from_user_id === user.id ? match.to_profile : match.from_profile
      return { ...s, other_user: other, my_review: reviewMap.get(s.id) ?? null }
    })

    // 2. Fetch workshop registrations
    const { data: workshopRegistrations } = await supabase
      .from('workshop_attendees')
      .select('*, workshop:workshops(*, organization:organizations(*), instructor:profiles!workshops_instructor_id_fkey(*))')
      .eq('user_id', user.id)
      .eq('status', 'registered')
    
    const enrichedWorkshops: EnrichedWorkshop[] = (workshopRegistrations ?? []).map((r: any) => r.workshop)

    setSessions(enriched)
    setWorkshops(enrichedWorkshops)
    setActiveTab(enriched.some((s) => s.status === 'scheduled') || enrichedWorkshops.length > 0 ? 'upcoming' : 'completed')
    setLoading(false)
  }

  const updateStatus = async (sessionId: string, status: 'completed' | 'cancelled') => {
    const { error } = await supabase.from('sessions').update({ status }).eq('id', sessionId)
    if (error) { toast.error('Failed to update session'); return }
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status } : s))
    toast.success(status === 'completed' ? 'Session marked as complete!' : 'Session cancelled.')
    if (status === 'completed') {
      const session = sessions.find((s) => s.id === sessionId)
      if (session && !session.my_review) openReviewDialog({ ...session, status: 'completed' })
    }
  }

  const openReviewDialog = (session: SessionWithMatch) => {
    setReviewSession(session); setRating(0); setHoverRating(0); setComment(''); setReviewOpen(true)
  }

  const submitReview = async () => {
    if (!rating || !reviewSession) return
    setSubmittingReview(true)
    const { error } = await supabase.from('reviews').insert({
      session_id: reviewSession.id,
      reviewer_id: currentUserId,
      reviewee_id: reviewSession.other_user.id,
      rating,
      comment: comment.trim() || null,
    })
    if (error) {
      toast.error(error.message.includes('unique') ? 'Already reviewed this session.' : 'Failed to submit review')
    } else {
      toast.success('Review submitted!')
      setSessions((prev) => prev.map((s) => s.id === reviewSession.id ? { ...s, my_review: { rating, comment } } : s))
      setReviewOpen(false)
      const { data: me } = await supabase.from('profiles').select('name').eq('id', currentUserId).single()
      await supabase.from('notifications').insert({
        user_id: reviewSession.other_user.id,
        type: 'new_review',
        title: `${me?.name ?? 'Someone'} left you a ${rating}-star review`,
        href: '/profile',
      })
    }
    setSubmittingReview(false)
  }

  const openRescheduleDialog = (session: SessionWithMatch) => {
    setRescheduleSession(session)
    // Default proposed time = current scheduled time
    const dt = new Date(session.reschedule_proposed_at ?? session.scheduled_at)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    setProposedAt(local)
    setRescheduleNote('')
    setRescheduleOpen(true)
  }

  const submitReschedule = async () => {
    if (!proposedAt || !rescheduleSession) return
    setSubmittingReschedule(true)
    const { error } = await supabase.from('sessions').update({
      reschedule_requested_by: currentUserId,
      reschedule_proposed_at: new Date(proposedAt).toISOString(),
      reschedule_note: rescheduleNote.trim() || null,
    }).eq('id', rescheduleSession.id)

    if (error) { toast.error('Failed to send reschedule request'); setSubmittingReschedule(false); return }

    setSessions((prev) => prev.map((s) => s.id === rescheduleSession.id ? {
      ...s,
      reschedule_requested_by: currentUserId,
      reschedule_proposed_at: new Date(proposedAt).toISOString(),
      reschedule_note: rescheduleNote.trim() || null,
    } : s))
    setRescheduleOpen(false)
    setSubmittingReschedule(false)
    toast.success('Reschedule request sent!')
  }

  const acceptReschedule = async (session: SessionWithMatch) => {
    const { error } = await supabase.from('sessions').update({
      scheduled_at: session.reschedule_proposed_at,
      reschedule_requested_by: null,
      reschedule_proposed_at: null,
      reschedule_note: null,
    }).eq('id', session.id)

    if (error) { toast.error('Failed to accept reschedule'); return }
    setSessions((prev) => prev.map((s) => s.id === session.id ? {
      ...s,
      scheduled_at: session.reschedule_proposed_at!,
      reschedule_requested_by: null,
      reschedule_proposed_at: null,
      reschedule_note: null,
    } : s))
    toast.success('Session rescheduled!')
  }

  const declineReschedule = async (sessionId: string) => {
    const { error } = await supabase.from('sessions').update({
      reschedule_requested_by: null,
      reschedule_proposed_at: null,
      reschedule_note: null,
    }).eq('id', sessionId)

    if (error) { toast.error('Failed to decline reschedule'); return }
    setSessions((prev) => prev.map((s) => s.id === sessionId ? {
      ...s,
      reschedule_requested_by: null,
      reschedule_proposed_at: null,
      reschedule_note: null,
    } : s))
    toast.success('Reschedule request declined.')
  }

  const exportToCalendar = (session: SessionWithMatch) => {
    const content = buildICS({
      title: `SkillSwap: ${session.skill_focus} with ${session.other_user.name}`,
      description: session.notes ? `Notes: ${session.notes}` : `Skill swap session for ${session.skill_focus}`,
      startAt: new Date(session.scheduled_at),
      durationMinutes: session.duration_minutes,
    })
    downloadICS(`session-${session.skill_focus.toLowerCase().replace(/\s+/g, '-')}`, content)
    toast.success('Calendar file downloaded!')
  }

  const upcoming  = sessions.filter((s) => s.status === 'scheduled')
  const completed = sessions.filter((s) => s.status === 'completed')
  const cancelled = sessions.filter((s) => s.status === 'cancelled')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const SessionCard = ({ session }: { session: SessionWithMatch }) => {
    const hasRescheduleRequest = !!session.reschedule_requested_by
    const iRequestedReschedule = session.reschedule_requested_by === currentUserId
    const theyRequestedReschedule = hasRescheduleRequest && !iRequestedReschedule

    return (
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={session.other_user.avatar_url ?? ''} />
              <AvatarFallback>{session.other_user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold">{session.other_user.name}</p>
                <StatusBadge status={session.status} />
              </div>
              <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-0.5">{session.skill_focus}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(session.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {session.duration_minutes}min
                </span>
              </div>
              {session.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{session.notes}</p>}

              {/* Reschedule request banner */}
              {theyRequestedReschedule && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 space-y-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {session.other_user.name} requested a reschedule
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Proposed: <strong>{new Date(session.reschedule_proposed_at!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                  </p>
                  {session.reschedule_note && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 italic">"{session.reschedule_note}"</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" onClick={() => acceptReschedule(session)}>
                      <Check className="h-3 w-3" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => declineReschedule(session.id)}>
                      <X className="h-3 w-3" /> Decline
                    </Button>
                  </div>
                </div>
              )}

              {iRequestedReschedule && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reschedule request pending…
                  </p>
                  <button
                    onClick={() => declineReschedule(session.id)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {session.status === 'scheduled' && !hasRescheduleRequest && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => updateStatus(session.id, 'completed')}>
                      <CheckCircle className="h-3.5 w-3.5" /> Mark complete
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950"
                      onClick={() => openRescheduleDialog(session)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive"
                      onClick={() => updateStatus(session.id, 'cancelled')}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </>
                )}
                {session.status === 'scheduled' && (
                  <>
                    <Button size="sm" variant="secondary" className="gap-1.5"
                      nativeButton={false} render={<Link href={`/sessions/${session.id}/room`} />}>
                      <Monitor className="h-3.5 w-3.5" /> Enter Room
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 px-2"
                      onClick={() => exportToCalendar(session)} title="Add to calendar">
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {session.status === 'completed' && (
                  session.my_review ? (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < session.my_review!.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">Your review</span>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReviewDialog(session)}>
                      <Star className="h-3.5 w-3.5" /> Leave a review
                    </Button>
                  )
                )}
                <Button size="sm" variant="ghost" className="gap-1.5 ml-auto" nativeButton={false}
                  render={<Link href={`/chat/${session.match_id}`} />}>
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-muted-foreground mt-1">Your scheduled and past skill-swap sessions.</p>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No sessions yet</p>
          <p className="text-sm mt-1">Schedule one from a chat with a match.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/matches" />}>Go to Matches</Button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming {upcoming.length > 0 && (
                <span className="ml-1.5 h-4 min-w-4 px-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-[10px] flex items-center justify-center font-bold">
                  {upcoming.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-6 mt-4">
            {upcoming.length === 0 && workshops.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No upcoming sessions or workshops.</p>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Matches</h3>
                    {upcoming.map((s) => <SessionCard key={s.id} session={s} />)}
                  </div>
                )}
                
                {workshops.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Workshops</h3>
                    {workshops.map((ws) => (
                      <Card key={ws.id} className="border-0 ring-1 ring-border shadow-sm overflow-hidden">
                        <div className="h-1 bg-violet-500 w-full" />
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold shrink-0">
                              {ws.organization.avatar_url ? (
                                <img src={ws.organization.avatar_url} alt="" className="h-full w-full object-cover rounded-xl" />
                              ) : (
                                ws.organization.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="font-semibold truncate">{ws.title}</p>
                                <Badge variant="outline" className="text-[10px] uppercase h-5">Registered</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {ws.organization.name}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(ws.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {new Date(ws.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ws.duration_minutes}min
                                </span>
                                {ws.location && (
                                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {ws.location}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" nativeButton={false} render={<Link href={`/orgs/${ws.organization.slug}`} />}>
                                  View Organization
                                </Button>
                                {ws.location?.startsWith('http') && (
                                  <Button size="sm" className="h-8 text-xs gap-1.5" nativeButton={false} render={<a href={ws.location} target="_blank" rel="noopener noreferrer" />}>
                                    Join Workshop
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3 mt-4">
            {completed.length === 0
              ? <p className="text-center py-12 text-muted-foreground">No completed sessions yet.</p>
              : completed.map((s) => <SessionCard key={s.id} session={s} />)}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-3 mt-4">
            {cancelled.length === 0
              ? <p className="text-center py-12 text-muted-foreground">No cancelled sessions.</p>
              : cancelled.map((s) => <SessionCard key={s.id} session={s} />)}
          </TabsContent>
        </Tabs>
      )}

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review your session with {reviewSession?.other_user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-110">
                    <Star className={`h-7 w-7 transition-colors ${star <= (hoverRating || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea placeholder={`How was your session on ${reviewSession?.skill_focus}?`}
                value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </div>
            <Button onClick={submitReview} disabled={!rating || submittingReview} className="w-full">
              {submittingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Propose a new time for your session with <strong>{rescheduleSession?.other_user.name}</strong>.
              They'll need to accept before the session is updated.
            </p>
            <div className="space-y-2">
              <Label>Proposed date & time</Label>
              <Input
                type="datetime-local"
                value={proposedAt}
                onChange={(e) => setProposedAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="Reason for rescheduling…"
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={submitReschedule} disabled={!proposedAt || submittingReschedule} className="w-full">
              {submittingReschedule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'scheduled') return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Upcoming</Badge>
  if (status === 'completed') return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>
  return <Badge variant="secondary" className="text-xs">Cancelled</Badge>
}
