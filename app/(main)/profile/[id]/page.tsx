'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, MapPin, GraduationCap, Lightbulb, Star, Send, CheckCircle, MoreHorizontal, Flag, ShieldOff, ThumbsUp, ShieldCheck, TrendingUp, UserCheck, Crown, Award, Clock, Pin, Globe, Code2, Link as LinkIcon, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProfileWithSkills, Review, BadgeType, Experience } from '@/lib/types'
import { AVAILABILITY_LABELS } from '@/hooks/use-profile'

const BADGE_CONFIG: Record<BadgeType, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  verified:       { label: 'Verified',       color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800',    icon: ShieldCheck },
  top_teacher:    { label: 'Top Teacher',    color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', icon: Star },
  top_learner:    { label: 'Top Learner',    color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', icon: TrendingUp },
  trusted:        { label: 'Trusted',        color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', icon: UserCheck },
  community_star: { label: 'Community Star', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800', icon: Crown },
  early_adopter:  { label: 'Early Adopter',  color: 'text-pink-700 dark:text-pink-300',    bg: 'bg-pink-50 dark:bg-pink-950/40',     border: 'border-pink-200 dark:border-pink-800',    icon: Award },
}

interface EndorsementInfo {
  skill_name: string
  count: number
  endorsed_by_me: boolean
  has_pinned: boolean
}

function formatMonth(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<ProfileWithSkills | null>(null)
  const [badges, setBadges] = useState<{ badge_type: BadgeType }[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [endorsements, setEndorsements] = useState<EndorsementInfo[]>([])
  const [matchStatus, setMatchStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const byPinnedFirst = (a: { pinned?: boolean }, b: { pinned?: boolean }) => Number(!!b.pinned) - Number(!!a.pinned)

    const [
      { data: profileData },
      { data: skills },
      { data: reviewData },
      { data: endorsementData },
      { data: badgeData },
      { data: experienceData },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('user_skills').select('*').eq('user_id', id),
      supabase.from('reviews').select('*, reviewer:profiles!reviewer_id(*)').eq('reviewee_id', id).order('created_at', { ascending: false }),
      supabase.from('endorsements').select('skill_name, endorser_id, pinned').eq('endorsee_id', id).eq('hidden', false),
      supabase.from('user_badges').select('badge_type').eq('user_id', id),
      supabase.from('experiences').select('*').eq('user_id', id).order('start_date', { ascending: false, nullsFirst: false }),
    ])

    if (!profileData) { router.push('/browse'); return }

    setProfile({
      ...profileData,
      teach_skills: (skills?.filter((s) => s.type === 'teach') ?? []).sort(byPinnedFirst),
      learn_skills: (skills?.filter((s) => s.type === 'learn') ?? []).sort(byPinnedFirst),
      avg_rating: reviewData?.length ? reviewData.reduce((sum: number, r: Review) => sum + r.rating, 0) / reviewData.length : undefined,
      review_count: reviewData?.length ?? 0,
    })
    setBadges(badgeData ?? [])
    setReviews(reviewData ?? [])
    setExperiences(experienceData ?? [])

    // Build endorsement map (hidden=false already filtered in query)
    const map = new Map<string, { count: number; endorsed_by_me: boolean; has_pinned: boolean }>()
    for (const e of endorsementData ?? []) {
      const ex = map.get(e.skill_name) ?? { count: 0, endorsed_by_me: false, has_pinned: false }
      map.set(e.skill_name, {
        count: ex.count + 1,
        endorsed_by_me: ex.endorsed_by_me || e.endorser_id === user?.id,
        has_pinned: ex.has_pinned || !!e.pinned,
      })
    }
    setEndorsements(Array.from(map.entries()).map(([skill_name, d]) => ({ skill_name, ...d })))

    if (user) {
      const [{ data: match }, { data: blockData }] = await Promise.all([
        supabase
          .from('match_requests')
          .select('*')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .or(`from_user_id.eq.${id},to_user_id.eq.${id}`)
          .maybeSingle(),
        supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', id).maybeSingle(),
      ])

      if (match) {
        if (match.status === 'accepted') setMatchStatus('accepted')
        else if (match.from_user_id === user.id) setMatchStatus('pending_sent')
        else setMatchStatus('pending_received')
      }
      setBlocked(!!blockData)
    }

    setLoading(false)
  }

  const sendMatchRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setSending(true)
    const { error } = await supabase.from('match_requests').insert({ from_user_id: user.id, to_user_id: id })
    if (error) {
      toast.error('Could not send request. You may have already sent one.')
    } else {
      toast.success('Match request sent!')
      setMatchStatus('pending_sent')
      const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      await supabase.from('notifications').insert({
        user_id: id,
        type: 'match_request',
        title: `${me?.name ?? 'Someone'} sent you a match request`,
        href: `/profile/${user.id}`,
      })
    }
    setSending(false)
  }

  const endorse = async (skillName: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('endorsements').insert({ endorser_id: user.id, endorsee_id: id, skill_name: skillName })
    if (error) { toast.error(error.message.includes('unique') ? 'Already endorsed!' : 'Failed to endorse'); return }
    setEndorsements((prev) => {
      const ex = prev.find((e) => e.skill_name === skillName)
      if (ex) return prev.map((e) => e.skill_name === skillName ? { ...e, count: e.count + 1, endorsed_by_me: true } : e)
      return [...prev, { skill_name: skillName, count: 1, endorsed_by_me: true, has_pinned: false }]
    })
    const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    await supabase.from('notifications').insert({
      user_id: id,
      type: 'new_endorsement',
      title: `${me?.name ?? 'Someone'} endorsed you for ${skillName}`,
      href: `/profile/${user.id}`,
    })
    toast.success('Skill endorsed!')
  }

  const toggleBlock = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (blocked) {
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id)
      setBlocked(false)
      toast.success('User unblocked.')
    } else {
      await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: id })
      setBlocked(true)
      toast.success('User blocked — they won\'t appear in Browse.')
    }
  }

  const submitReport = async () => {
    if (!reportReason.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setReporting(true)
    await supabase.from('reports').insert({ reporter_id: user.id, reported_id: id, reason: reportReason.trim() })
    toast.success('Report submitted. Thank you for keeping SkillSwap safe.')
    setReportOpen(false)
    setReportReason('')
    setReporting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  const isOwnProfile = currentUserId === id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card className="overflow-hidden">
        {profile.cover_image_url && (
          <div className="h-32 w-full sm:h-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.cover_image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className={cn('h-20 w-20', profile.cover_image_url && 'ring-4 ring-background -mt-12')}>
              <AvatarImage src={profile.avatar_url ?? ''} />
              <AvatarFallback className="text-2xl">{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                    {(badges.some((b) => b.badge_type === 'verified') || (profile as any).identity_verified) && (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
                        BADGE_CONFIG.verified.bg, BADGE_CONFIG.verified.color, BADGE_CONFIG.verified.border,
                      )}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  {profile.headline && (
                    <p className="text-sm text-foreground mt-0.5">{profile.headline}</p>
                  )}
                  {badges.filter((b) => b.badge_type !== 'verified').length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {badges.filter((b) => b.badge_type !== 'verified').map((b) => {
                        const cfg = BADGE_CONFIG[b.badge_type]
                        const Icon = cfg.icon
                        return (
                          <span
                            key={b.badge_type}
                            className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.bg, cfg.color, cfg.border)}
                          >
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {profile.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {profile.location}
                      </p>
                    )}
                    {profile.availability && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {AVAILABILITY_LABELS[profile.availability]}
                      </p>
                    )}
                  </div>
                  {(profile.website_url || profile.github_url || profile.linkedin_url) && (
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      {profile.website_url && (
                        <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400">
                          <Globe className="h-3.5 w-3.5" /> Website
                        </a>
                      )}
                      {profile.github_url && (
                        <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400">
                          <Code2 className="h-3.5 w-3.5" /> GitHub
                        </a>
                      )}
                      {profile.linkedin_url && (
                        <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400">
                          <LinkIcon className="h-3.5 w-3.5" /> LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                  {profile.avg_rating !== undefined && (
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(profile.avg_rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">({profile.review_count} reviews)</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isOwnProfile && (
                    <>
                      {matchStatus === 'none' && (
                        <Button onClick={sendMatchRequest} disabled={sending} size="sm">
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                          Send match request
                        </Button>
                      )}
                      {matchStatus === 'pending_sent' && (
                        <Badge variant="secondary" className="gap-1.5">
                          <Send className="h-3.5 w-3.5" /> Request sent
                        </Badge>
                      )}
                      {matchStatus === 'pending_received' && (
                        <Button size="sm" onClick={() => router.push('/matches')}>Review their request</Button>
                      )}
                      {matchStatus === 'accepted' && (
                        <Button size="sm" variant="outline" onClick={() => router.push('/matches')}>
                          <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" /> Matched — Chat
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={toggleBlock} className="cursor-pointer gap-2">
                            <ShieldOff className="h-4 w-4" /> {blocked ? 'Unblock user' : 'Block user'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setReportOpen(true)} className="cursor-pointer gap-2 text-destructive">
                            <Flag className="h-4 w-4" /> Report user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                  {isOwnProfile && (
                    <Button size="sm" variant="outline" onClick={() => router.push('/profile')}>Edit profile</Button>
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-violet-500" /> Can teach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.teach_skills.length > 0 ? profile.teach_skills.map((s) => {
                const info = endorsements.find((e) => e.skill_name === s.skill_name)
                return (
                  <div key={s.id} className="flex flex-col items-start gap-1">
                    <Badge variant="secondary" className="gap-1">
                      {s.pinned && <Pin className="h-3 w-3 text-yellow-500" />}
                      {s.skill_name}{s.level ? ` · ${s.level}` : ''}
                    </Badge>
                    <div className="flex items-center gap-1.5 pl-0.5">
                      {info && info.count > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <ThumbsUp className="h-3 w-3" /> {info.count}
                          {info.has_pinned && <span className="text-yellow-500 ml-0.5" title="Featured endorsement">★</span>}
                        </span>
                      )}
                      {!isOwnProfile && matchStatus === 'accepted' && (
                        info?.endorsed_by_me
                          ? <span className="text-xs text-green-600 dark:text-green-400">✓ Endorsed</span>
                          : <button onClick={() => endorse(s.skill_name)} className="text-xs text-violet-500 hover:underline">+ Endorse</button>
                      )}
                    </div>
                  </div>
                )
              }) : <p className="text-sm text-muted-foreground">Nothing listed yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" /> Wants to learn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.learn_skills.length > 0 ? profile.learn_skills.map((s) => (
                <Badge key={s.id} variant="outline" className="gap-1">
                  {s.pinned && <Pin className="h-3 w-3 text-yellow-500" />}
                  {s.skill_name}
                </Badge>
              )) : <p className="text-sm text-muted-foreground">Nothing listed yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Experience & education */}
      {experiences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-violet-500" /> Experience & education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {experiences.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-border px-4 py-3">
                <p className="text-sm font-medium">{exp.title}</p>
                {exp.organization && <p className="text-sm text-muted-foreground">{exp.organization}</p>}
                <p className="text-xs text-muted-foreground">
                  {formatMonth(exp.start_date)}
                  {exp.is_current ? ' · Present' : exp.end_date ? ` · ${formatMonth(exp.end_date)}` : ''}
                </p>
                {exp.description && <p className="mt-1 text-sm text-foreground">{exp.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.map((review, i) => (
              <div key={review.id}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={(review.reviewer as any)?.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs">{(review.reviewer as any)?.name?.slice(0, 2) ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{(review.reviewer as any)?.name ?? 'Anonymous'}</span>
                  <div className="flex ml-auto gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {profile.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>What's the issue?</Label>
              <Textarea
                placeholder="Describe the problem..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={submitReport} disabled={reporting || !reportReason.trim()} className="w-full">
              {reporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
