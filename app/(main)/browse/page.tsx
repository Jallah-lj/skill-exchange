'use client'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Search, MapPin, GraduationCap, Lightbulb, Star, Sparkles,
  SlidersHorizontal, X, CheckCircle2, Building2, Bookmark, BookmarkCheck,
  MessageSquare, UserPlus, ArrowRightLeft, Users, Trophy, Zap,
  Shield, Clock, ChevronDown, Globe, Award, Megaphone,
} from 'lucide-react'
import type { ProfileWithSkills, SkillCategory, Organization, UserSkill, OrganizationPost, Workshop } from '@/lib/types'
import { PostCard } from '@/components/post-card'

// ─── Local types ──────────────────────────────────────────────────────────────

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected'

type ScoredProfile = ProfileWithSkills & {
  matchScore: number
  matchPct: number
  sharedOrgCount: number
  connectionStatus: ConnectionStatus
  matchId?: string
}

type OrgWithMeta = Organization & {
  memberCount: number
  myRole?: string | null
}

type BrowseTab = 'people' | 'organizations' | 'community' | 'mentors'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: SkillCategory[] = [
  'Technology', 'Language', 'Art & Design', 'Music',
  'Business', 'Fitness', 'Cooking', 'Education', 'Other',
]

const AVAILABILITY_DOT: Record<string, string> = {
  available: 'bg-emerald-500',
  busy: 'bg-amber-500',
  unavailable: 'bg-red-500',
}
const AVAILABILITY_LABEL: Record<string, string> = {
  available: 'Available',
  busy: 'Busy',
  unavailable: 'Not Accepting Requests',
}

const INTENT_COLOR: Record<string, string> = {
  'Looking for Mentor':      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Seeking Internship':      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Hiring':                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Open to Collaborations':  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Looking for Team Members':'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Available for Projects':  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
}

const ORG_CATEGORY_COLOR: Record<string, string> = {
  'School / University': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Tech Club':           'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Professional':        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Non-Profit':          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Government':          'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Startup':             'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Community':           'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Other':               'bg-muted text-muted-foreground',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 5)   return 'Active Now'
  if (mins < 60)  return `Active ${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24)     return `Active ${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)      return `Active ${d}d ago`
  return 'Active recently'
}

// ─── Skill Swap Modal ─────────────────────────────────────────────────────────

interface SwapModalProps {
  target: ScoredProfile | null
  myTeachSkills: UserSkill[]
  open: boolean
  onClose: () => void
}

function SkillSwapModal({ target, myTeachSkills, open, onClose }: SwapModalProps) {
  const supabase = createClient()
  const [offering, setOffering] = useState('')
  const [requesting, setRequesting] = useState('')
  const [message, setMessage] = useState('')
  const [schedule, setSchedule] = useState('')
  const [sending, setSending] = useState(false)

  const targetTeachSkills = target?.teach_skills ?? []

  const reset = () => { setOffering(''); setRequesting(''); setMessage(''); setSchedule('') }

  const send = async () => {
    if (!target || !offering || !requesting) { toast.error('Please select both skills'); return }
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sign in first'); setSending(false); return }

    const { error } = await supabase.from('match_requests').upsert(
      { from_user_id: user.id, to_user_id: target.id, status: 'pending' },
      { onConflict: 'from_user_id,to_user_id' },
    )
    if (error) {
      toast.error('Failed to send request')
    } else {
      toast.success(`Skill swap request sent to ${target.name}!`)
      reset()
      onClose()
    }
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Propose a Skill Swap</DialogTitle>
          {target && <p className="text-sm text-muted-foreground">Exchange skills with {target.name}</p>}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Skill I Can Teach</label>
            <Select value={offering} onValueChange={(v) => setOffering(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Choose a skill you'll offer…" /></SelectTrigger>
              <SelectContent>
                {myTeachSkills.length === 0
                  ? <SelectItem value="__none" disabled>No teach skills set — add them in your profile</SelectItem>
                  : myTeachSkills.map((s) => <SelectItem key={s.id} value={s.skill_name}>{s.skill_name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Skill I Want to Learn</label>
            <Select value={requesting} onValueChange={(v) => setRequesting(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="What do you want to learn?" /></SelectTrigger>
              <SelectContent>
                {targetTeachSkills.length === 0
                  ? <SelectItem value="__none" disabled>No teach skills listed</SelectItem>
                  : targetTeachSkills.map((s) => <SelectItem key={s.id} value={s.skill_name}>{s.skill_name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Preferred Schedule <span className="text-muted-foreground/60">(optional)</span></label>
            <Input
              placeholder="e.g. Weekends, evenings UTC+3…"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Message <span className="text-muted-foreground/60">(optional)</span></label>
            <Textarea
              placeholder="Introduce yourself and explain what you'd like to learn…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button onClick={send} disabled={sending || !offering || !requesting}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: ScoredProfile
  myTeachSkills: UserSkill[]
  saved: boolean
  onSwap: (p: ScoredProfile) => void
  onConnect: (p: ScoredProfile) => void
  onToggleSave: (id: string) => void
}

function ProfileCard({ profile: p, myTeachSkills, saved, onSwap, onConnect, onToggleSave }: ProfileCardProps) {
  const [teachExpanded, setTeachExpanded] = useState(false)
  const [learnExpanded, setLearnExpanded] = useState(false)

  const primaryOrg = (p.organizations ?? []).find((m: any) => m.organization)?.organization as any
  const availability = p.availability ?? 'available'
  const intents: string[] = p.intents ?? []
  const skillPoints = (p.review_count ?? 0) * 15 + p.matchScore * 5
  const swapCount = p.review_count ?? 0

  const derivedHeadline = p.headline ?? (() => {
    const topSkill = p.teach_skills[0]?.skill_name
    const orgName = primaryOrg?.name
    if (topSkill && orgName) return `${topSkill} | ${orgName}`
    if (topSkill) return topSkill
    return null
  })()

  const isRecommended = p.matchPct >= 40

  const teachToShow = teachExpanded ? p.teach_skills : p.teach_skills.slice(0, 3)
  const learnToShow = learnExpanded  ? p.learn_skills : p.learn_skills.slice(0, 3)

  const matchReasonSkills = myTeachSkills
    .filter((ms) => p.learn_skills.some((ls) => ls.skill_name.toLowerCase() === ms.skill_name.toLowerCase()))
    .slice(0, 2)

  return (
    <Card className="relative hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col">
      {isRecommended && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
      )}

      <CardContent className="pt-4 pb-4 flex flex-col flex-1">
        {/* Top bar: availability + match % + bookmark */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full shrink-0 ${AVAILABILITY_DOT[availability] ?? 'bg-emerald-500'}`} />
            <span className="text-[10px] text-muted-foreground">{AVAILABILITY_LABEL[availability] ?? 'Available'}</span>
          </div>
          <div className="flex items-center gap-2">
            {p.matchPct > 0 && (
              <Badge className="text-[10px] h-5 gap-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0 shrink-0">
                <Sparkles className="h-2.5 w-2.5" />
                {p.matchPct}% Match
              </Badge>
            )}
            <button
              onClick={() => onToggleSave(p.id)}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              aria-label={saved ? 'Remove from saved' : 'Save profile'}
            >
              {saved
                ? <BookmarkCheck className="h-4 w-4 text-primary" />
                : <Bookmark className="h-4 w-4" />
              }
            </button>
          </div>
        </div>

        {/* Avatar + identity */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-12 w-12 ring-2 ring-border shrink-0">
            <AvatarImage src={p.avatar_url ?? ''} />
            <AvatarFallback className="text-sm font-semibold">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold leading-tight">{p.name}</p>
              {p.identity_verified && (
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              )}
            </div>
            {derivedHeadline && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{derivedHeadline}</p>
            )}
            {primaryOrg && (
              <Link
                href={`/orgs/${primaryOrg.slug}`}
                className="inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400 hover:underline mt-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Building2 className="h-2.5 w-2.5" />
                {primaryOrg.name}
              </Link>
            )}
            {p.location && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{p.location}</span>
              </p>
            )}
          </div>
        </div>

        {/* Reputation row */}
        {(p.avg_rating !== undefined || skillPoints > 0 || swapCount > 0 || p.sharedOrgCount > 0) && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3 flex-wrap">
            {p.avg_rating !== undefined && (
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-foreground">{p.avg_rating.toFixed(1)}</span>
                {p.review_count ? <span>({p.review_count})</span> : null}
              </span>
            )}
            {skillPoints > 0 && (
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5 text-amber-500" />
                {skillPoints} pts
              </span>
            )}
            {swapCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Trophy className="h-2.5 w-2.5 text-emerald-500" />
                {swapCount} swap{swapCount !== 1 ? 's' : ''}
              </span>
            )}
            {p.sharedOrgCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5 text-blue-500" />
                {p.sharedOrgCount} shared org{p.sharedOrgCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Intent badges */}
        {intents.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {intents.slice(0, 2).map((intent) => (
              <span
                key={intent}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${INTENT_COLOR[intent] ?? 'bg-muted text-muted-foreground'}`}
              >
                {intent}
              </span>
            ))}
            {intents.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                +{intents.length - 2}
              </span>
            )}
          </div>
        )}

        {/* AI recommendation label */}
        {isRecommended && (
          <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 px-2.5 py-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
              <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">Recommended for you</p>
            </div>
            {matchReasonSkills.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                They want to learn {matchReasonSkills.map((s) => s.skill_name).join(' & ')} — skills you teach
              </p>
            )}
          </div>
        )}

        {/* Teach skills */}
        {p.teach_skills.length > 0 && (
          <div className="mb-2.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
              <GraduationCap className="h-3 w-3 text-violet-500" /> Teaches
            </div>
            <div className="flex flex-wrap gap-1">
              {teachToShow.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-[10px] h-5 px-1.5">{s.skill_name}</Badge>
              ))}
              {p.teach_skills.length > 3 && (
                <button
                  onClick={() => setTeachExpanded((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                >
                  {teachExpanded ? 'less' : `+${p.teach_skills.length - 3} more`}
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${teachExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Learn skills */}
        {p.learn_skills.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
              <Lightbulb className="h-3 w-3 text-yellow-500" /> Wants to learn
            </div>
            <div className="flex flex-wrap gap-1">
              {learnToShow.map((s) => (
                <Badge key={s.id} variant="outline" className="text-[10px] h-5 px-1.5">{s.skill_name}</Badge>
              ))}
              {p.learn_skills.length > 3 && (
                <button
                  onClick={() => setLearnExpanded((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                >
                  {learnExpanded ? 'less' : `+${p.learn_skills.length - 3} more`}
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${learnExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Activity */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-3">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {timeAgo(p.created_at)}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          {p.connectionStatus === 'connected' ? (
            <Button
              size="sm"
              variant="secondary"
              className="col-span-1 text-xs h-7 gap-1"
              nativeButton={false} render={<Link href={p.matchId ? `/chat/${p.matchId}` : '/matches'} />}
            >
              <MessageSquare className="h-3 w-3" /> Message
            </Button>
          ) : p.connectionStatus === 'pending_sent' ? (
            <Button size="sm" variant="outline" className="col-span-1 text-xs h-7 gap-1" disabled>
              <Clock className="h-3 w-3" /> Pending
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="col-span-1 text-xs h-7 gap-1"
              onClick={() => onConnect(p)}
            >
              <UserPlus className="h-3 w-3" /> Connect
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="col-span-1 text-xs h-7 gap-1"
            onClick={() => onSwap(p)}
          >
            <ArrowRightLeft className="h-3 w-3" /> Skill Swap
          </Button>

          <Button
            size="sm"
            className="col-span-2 text-xs h-7"
            nativeButton={false} render={<Link href={`/profile/${p.id}`} />}
          >
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Org Card ─────────────────────────────────────────────────────────────────

function OrgCard({ org }: { org: OrgWithMeta }) {
  const memberLabel =
    org.membership_type === 'open'       ? 'Open to join'
    : org.membership_type === 'request'  ? 'Request to join'
    : 'Invitation only'

  const memberLabelColor =
    org.membership_type === 'open' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'

  const joinLabel =
    org.membership_type === 'open'      ? 'Join Now'
    : org.membership_type === 'request' ? 'Apply'
    : 'Enter Code'

  return (
    <Card className="hover:shadow-lg transition-all duration-200 flex flex-col">
      <CardContent className="pt-4 pb-4 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-12 w-12 rounded-xl ring-2 ring-border shrink-0">
            <AvatarImage src={org.avatar_url ?? ''} />
            <AvatarFallback className="rounded-xl text-sm font-bold bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              {org.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold truncate">{org.name}</p>
              {org.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
            </div>
            {org.category && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${ORG_CATEGORY_COLOR[org.category] ?? 'bg-muted text-muted-foreground'}`}>
                {org.category}
              </span>
            )}
            {(org.city || org.country) && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {[org.city, org.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {org.bio && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{org.bio}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
          </span>
          {org.website && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:underline truncate max-w-[120px]"
            >
              <Globe className="h-2.5 w-2.5 shrink-0" />
              {org.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className={`ml-auto text-[10px] font-medium ${memberLabelColor}`}>
            {memberLabel}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7"
            nativeButton={false} render={<Link href={`/orgs/${org.slug}`} />}
          >
            View Org
          </Button>
          {org.myRole ? (
            <Badge variant="secondary" className="text-[10px] h-7 px-3 capitalize">
              {org.myRole}
            </Badge>
          ) : (
            <Button
              size="sm"
              className="flex-1 text-xs h-7"
              nativeButton={false} render={<Link href={`/orgs/${org.slug}`} />}
            >
              {joinLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  hasData,
  hasActiveFilters,
  onClearFilters,
}: {
  tab: BrowseTab
  hasData: boolean
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  if (!hasData) {
    if (tab === 'organizations') {
      return (
        <div className="text-center py-20 space-y-4">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-lg font-semibold">No organizations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Be the first to create one.</p>
          </div>
          <Button nativeButton={false} render={<Link href="/orgs/create" />}>Create Organization</Button>
        </div>
      )
    }
    if (tab === 'mentors') {
      return (
        <div className="text-center py-20 space-y-4">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <div>
            <p className="text-lg font-semibold">No mentors yet</p>
            <p className="text-sm text-muted-foreground mt-1">Mentors appear once users build their reputation through reviews and swaps.</p>
          </div>
          <Button variant="outline" nativeButton={false} render={<Link href="/browse" />}>Browse all people</Button>
        </div>
      )
    }
    return (
      <div className="text-center py-20 space-y-4">
        <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <div>
          <p className="text-lg font-semibold">No one here yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be one of the first — add your skills to get discovered.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/profile" />}>Add your skills</Button>
      </div>
    )
  }

  return (
    <div className="text-center py-16 space-y-4">
      <Search className="h-10 w-10 mx-auto text-muted-foreground/30" />
      <div>
        <p className="text-base font-semibold">No results found</p>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or removing some filters.</p>
      </div>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Clear filters
        </Button>
      )}
      <div className="pt-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Browse by category</p>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <Badge key={c} variant="secondary" className="cursor-pointer text-xs">{c}</Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Browse Content ───────────────────────────────────────────────────────────

function BrowseContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<BrowseTab>('people')
  const [profiles, setProfiles]   = useState<ScoredProfile[]>([])
  const [orgs, setOrgs]           = useState<OrgWithMeta[]>([])
  const [myTeachSkills, setMyTeachSkills] = useState<UserSkill[]>([])
  const [loading, setLoading]     = useState(true)

  // Community Feed State
  const [communityPosts, setCommunityPosts] = useState<OrganizationPost[]>([])
  const [communityWorkshops, setCommunityWorkshops] = useState<Workshop[]>([])
  const [loadingCommunity, setLoadingCommunity] = useState(false)

  // Saved profiles (localStorage)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  // Swap modal
  const [swapTarget, setSwapTarget] = useState<ScoredProfile | null>(null)

  // Filters
  const [category, setCategory]             = useState<string>(searchParams.get('category') ?? 'all')
  const [locationFilter, setLocationFilter] = useState('')
  const [minRating, setMinRating]           = useState<number>(0)
  const [sortBy, setSortBy]                 = useState<'match' | 'newest' | 'reviewed'>('match')
  const [availFilter, setAvailFilter]       = useState<string>('all')
  const [verifiedOnly, setVerifiedOnly]     = useState(false)
  const [showFilters, setShowFilters]       = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('browse_saved') ?? '[]')
      setSavedIds(new Set(Array.isArray(saved) ? saved : []))
    } catch {}
  }, [])

  useEffect(() => {
    if (activeTab === 'organizations') {
      loadOrgs()
    } else if (activeTab === 'community') {
      loadCommunityFeed()
    } else {
      loadProfiles()
    }
  }, [activeTab, category])

  // ── Load people ─────────────────────────────────────────────────────────────

  const loadProfiles = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [mySkillsResult, blockedResult, myOrgsResult, myMatchesResult] = await Promise.all([
        user
          ? supabase.from('user_skills').select('skill_name, type, id, category, level, description').eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase.from('organization_members')
              .select('organization_id, organization:organizations(id, internal_only_swapping)')
              .eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase.from('match_requests')
              .select('id, from_user_id, to_user_id, status')
              .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          : Promise.resolve({ data: [], error: null }),
      ])

      const mySkills = mySkillsResult.data ?? []
      const myLearnNames = mySkills.filter((s: any) => s.type === 'learn').map((s: any) => (s.skill_name as string).toLowerCase())
      const myTeachNames = mySkills.filter((s: any) => s.type === 'teach').map((s: any) => (s.skill_name as string).toLowerCase())
      setMyTeachSkills(mySkills.filter((s: any) => s.type === 'teach') as UserSkill[])

      const blockedIds = new Set((blockedResult.data ?? []).map((b: any) => b.blocked_id as string))
      const myOrgIds   = new Set((myOrgsResult.data ?? []).map((m: any) => m.organization_id as string))
      const internalOrgIds = (myOrgsResult.data ?? [])
        .filter((m: any) => (m.organization as any)?.internal_only_swapping)
        .map((m: any) => m.organization_id as string)
      const isRestricted = internalOrgIds.length > 0

      // Build connection map (userId → {status, matchId})
      const connectionMap = new Map<string, { status: ConnectionStatus; matchId: string }>()
      for (const match of (myMatchesResult.data ?? [])) {
        const otherId = match.from_user_id === user?.id ? match.to_user_id : match.from_user_id
        const isSent  = match.from_user_id === user?.id
        const status: ConnectionStatus =
          match.status === 'accepted'   ? 'connected'
          : (match.status === 'pending' && isSent)  ? 'pending_sent'
          : match.status === 'pending'  ? 'pending_received'
          : 'none'
        connectionMap.set(otherId, { status, matchId: match.id })
      }

      // All profiles (simple query, no join that can silently fail)
      let profilesQuery = supabase.from('profiles').select('*')
      if (user) profilesQuery = (profilesQuery as any).neq('id', user.id)

      const { data: profilesData, error: profilesError } = await profilesQuery
      if (profilesError) { console.error('Browse: profiles query failed', profilesError); return }
      if (!profilesData?.length) { setProfiles([]); return }

      const allIds = profilesData.map((p: any) => p.id as string)
      const [skillsResult, reviewsResult, orgMembersResult] = await Promise.all([
        supabase.from('user_skills')
          .select('user_id, skill_name, category, type, level, id, description')
          .in('user_id', allIds),
        supabase.from('reviews')
          .select('reviewee_id, rating')
          .in('reviewee_id', allIds),
        supabase.from('organization_members')
          .select('user_id, role, organization:organizations(id, name, slug, avatar_url, internal_only_swapping)')
          .in('user_id', allIds),
      ])

      const skills    = skillsResult.data    ?? []
      const reviews   = reviewsResult.data   ?? []
      const orgMembers = orgMembersResult.data ?? []

      // Privacy & visibility filters
      let candidates = profilesData.filter((p: any) => {
        if (blockedIds.has(p.id)) return false
        if (p.appear_offline)     return false
        if (p.profile_visibility === 'matched_only') {
          const conn = connectionMap.get(p.id)
          if (!conn || conn.status !== 'connected') return false
        }
        if (isRestricted && !internalOrgIds.some((oid) =>
          orgMembers.some((m: any) => m.user_id === p.id && (m.organization as any)?.id === oid)
        )) return false
        const userInternalOrgs = orgMembers
          .filter((m: any) => m.user_id === p.id && (m.organization as any)?.internal_only_swapping)
        if (userInternalOrgs.length > 0) {
          return userInternalOrgs.some((m: any) => myOrgIds.has((m.organization as any)?.id))
        }
        return true
      })

      // Category filter
      if (category && category !== 'all') {
        const catUsers = new Set(
          skills.filter((s: any) => s.category === category).map((s: any) => s.user_id as string)
        )
        candidates = candidates.filter((p: any) => catUsers.has(p.id))
      }

      const totalMySkills = myLearnNames.length + myTeachNames.length

      const scored: ScoredProfile[] = candidates.map((p: any) => {
        const userSkills    = skills.filter((s: any) => s.user_id === p.id)
        const userReviews   = reviews.filter((r: any) => r.reviewee_id === p.id)
        const userOrgMems   = orgMembers.filter((m: any) => m.user_id === p.id)

        const teachNames = userSkills.filter((s: any) => s.type === 'teach').map((s: any) => (s.skill_name as string).toLowerCase())
        const learnNames = userSkills.filter((s: any) => s.type === 'learn').map((s: any) => (s.skill_name as string).toLowerCase())

        const matchScore =
          teachNames.filter((n) => myLearnNames.includes(n)).length +
          learnNames.filter((n) => myTeachNames.includes(n)).length

        const matchPct = totalMySkills > 0
          ? Math.min(Math.round((matchScore / totalMySkills) * 100), 99)
          : 0

        const sharedOrgCount = userOrgMems.filter((m: any) =>
          (m.organization as any)?.id && myOrgIds.has((m.organization as any).id)
        ).length

        const conn = connectionMap.get(p.id)
        const avgRating = userReviews.length
          ? userReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / userReviews.length
          : undefined

        return {
          ...p,
          teach_skills: userSkills.filter((s: any) => s.type === 'teach'),
          learn_skills: userSkills.filter((s: any) => s.type === 'learn'),
          avg_rating:    avgRating,
          review_count:  userReviews.length,
          organizations: userOrgMems,
          matchScore,
          matchPct,
          sharedOrgCount,
          connectionStatus: conn?.status ?? 'none',
          matchId: conn?.matchId,
        }
      })

      setProfiles(scored)
    } catch (err) {
      console.error('Browse: unexpected error', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCommunityFeed = async () => {
    setLoadingCommunity(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let [{ data: postData, error: postErr }, { data: wsData }] = await Promise.all([
        supabase
          .from('organization_posts')
          .select('*, organization:organizations(*), author:profiles!organization_posts_author_id_fkey(*), post_likes(count), post_bookmarks(count), post_comments(count)')
          .eq('is_published', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('workshops')
          .select('*, organization:organizations(*), instructor:profiles!workshops_instructor_id_fkey(*)')
          .eq('is_public', true)
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(20)
      ])

      // Fall back without engagement counts if the likes/bookmarks tables
      // are not present in the database yet.
      if (postErr) {
        ({ data: postData } = await supabase
          .from('organization_posts')
          .select('*, organization:organizations(*), author:profiles!organization_posts_author_id_fkey(*)')
          .eq('is_published', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(30))
      }

      let posts = (postData as any[]) ?? []
      if (user && posts.length > 0) {
        const postIds = posts.map(p => p.id)
        const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('post_bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ])
        const liked = new Set((myLikes ?? []).map(l => l.post_id))
        const bookmarked = new Set((myBookmarks ?? []).map(b => b.post_id))
        posts = posts.map(p => ({
          ...p,
          is_liked_by_user: liked.has(p.id),
          is_bookmarked_by_user: bookmarked.has(p.id),
        }))
      }

      setCommunityPosts(posts as any)
      setCommunityWorkshops((wsData as any) ?? [])
    } catch (err) {
      console.error('Community feed load failed', err)
    } finally {
      setLoadingCommunity(false)
    }
  }

  // ── Load orgs ───────────────────────────────────────────────────────────────

  const loadOrgs = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: orgsData, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      if (error || !orgsData) { setOrgs([]); return }

      const orgIds = orgsData.map((o: any) => o.id as string)

      const [membersResult, myMembersResult] = await Promise.all([
        supabase.from('organization_members').select('organization_id').in('organization_id', orgIds),
        user
          ? supabase.from('organization_members').select('organization_id, role').eq('user_id', user.id).in('organization_id', orgIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      const memberCounts = new Map<string, number>()
      for (const m of (membersResult.data ?? [])) {
        memberCounts.set(m.organization_id, (memberCounts.get(m.organization_id) ?? 0) + 1)
      }
      const myRoles = new Map<string, string>()
      for (const m of (myMembersResult.data ?? [])) {
        myRoles.set(m.organization_id, m.role)
      }

      setOrgs(orgsData.map((o: any) => ({
        ...o,
        memberCount: memberCounts.get(o.id) ?? 0,
        myRole: myRoles.get(o.id) ?? null,
      })))
    } catch (err) {
      console.error('Browse orgs error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleConnect = async (profile: ScoredProfile) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sign in to connect'); return }

    const { error } = await supabase.from('match_requests').upsert(
      { from_user_id: user.id, to_user_id: profile.id, status: 'pending' },
      { onConflict: 'from_user_id,to_user_id' },
    )
    if (error) {
      toast.error('Failed to send request')
    } else {
      toast.success(`Connection request sent to ${profile.name}!`)
      setProfiles((prev) =>
        prev.map((p) => p.id === profile.id ? { ...p, connectionStatus: 'pending_sent' } : p)
      )
    }
  }

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); toast.success('Removed from saved') }
      else              { next.add(id);    toast.success('Profile saved') }
      try { localStorage.setItem('browse_saved', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const activeFilterCount = [
    locationFilter.trim() !== '',
    minRating > 0,
    sortBy !== 'match',
    availFilter !== 'all',
    verifiedOnly,
  ].filter(Boolean).length

  const clearFilters = () => {
    setLocationFilter('')
    setMinRating(0)
    setSortBy('match')
    setCategory('all')
    setAvailFilter('all')
    setVerifiedOnly(false)
  }

  const hasActiveFilters = !!(locationFilter || minRating || category !== 'all' || availFilter !== 'all' || verifiedOnly)

  const filteredPeople = useMemo(() => {
    let result = profiles.filter((p) => {
      if (locationFilter.trim() && !(p.location ?? '').toLowerCase().includes(locationFilter.toLowerCase())) return false
      if (minRating > 0 && (!p.avg_rating || p.avg_rating < minRating)) return false
      if (availFilter !== 'all' && (p.availability ?? 'available') !== availFilter) return false
      if (verifiedOnly && !p.identity_verified) return false
      return true
    })

    return [...result].sort((a, b) => {
      if (sortBy === 'match')    return b.matchScore - a.matchScore
      if (sortBy === 'newest')   return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'reviewed') return (b.review_count ?? 0) - (a.review_count ?? 0)
      return 0
    })
  }, [profiles, locationFilter, minRating, sortBy, availFilter, verifiedOnly])

  const filteredMentors = useMemo(() =>
    filteredPeople.filter((p) =>
      p.identity_verified || (p.avg_rating ?? 0) >= 4 || (p.review_count ?? 0) >= 3
    ),
    [filteredPeople],
  )

  // Organizations tab has no filters of its own left (text search now lives
  // in the platform-wide QuickSearch) — this is just the raw list.
  const filteredOrgs = orgs

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderPeopleGrid = (list: ScoredProfile[], tab: BrowseTab) => {
    if (loading) return null
    if (list.length === 0) {
      return (
        <EmptyState
          tab={tab}
          hasData={profiles.length > 0}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )
    }
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            myTeachSkills={myTeachSkills}
            saved={savedIds.has(p.id)}
            onSwap={setSwapTarget}
            onConnect={handleConnect}
            onToggleSave={toggleSave}
          />
        ))}
      </div>
    )
  }

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Discover</h1>
        <p className="text-muted-foreground mt-1">Find people and organizations to connect with.</p>
      </div>

      {/* Filters — text search now lives in the platform-wide search bar up top */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {activeTab !== 'organizations' && (
            <Select value={category} onValueChange={(v) => setCategory(v ?? 'all')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters((v) => !v)}
            className="gap-2 shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="City or country…"
                    className="pl-8 h-9 text-sm"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Availability</label>
                <Select value={availFilter} onValueChange={(v) => setAvailFilter(v ?? 'all')}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Min Rating</label>
                <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any rating</SelectItem>
                    <SelectItem value="3">3+ stars</SelectItem>
                    <SelectItem value="4">4+ stars</SelectItem>
                    <SelectItem value="5">5 stars only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sort by</label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match">Best match</SelectItem>
                    <SelectItem value="newest">Newest members</SelectItem>
                    <SelectItem value="reviewed">Most reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-border"
                />
                Verified users only
              </label>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground h-8">
                  <X className="h-3.5 w-3.5" /> Clear all
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BrowseTab)}>
        <TabsList>
          <TabsTrigger value="people" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            People
            {profiles.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">({profiles.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Community
          </TabsTrigger>
          <TabsTrigger value="mentors" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Mentors
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="people" className="mt-4">
              {renderPeopleGrid(filteredPeople, 'people')}
            </TabsContent>

            <TabsContent value="organizations" className="mt-4">
              {filteredOrgs.length === 0 ? (
                <EmptyState
                  tab="organizations"
                  hasData={orgs.length > 0}
                  hasActiveFilters={false}
                  onClearFilters={clearFilters}
                />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrgs.map((org) => <OrgCard key={org.id} org={org} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="community" className="mt-4">
              {loadingCommunity ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : communityPosts.length === 0 && communityWorkshops.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-xl">
                  <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium">Nothing from the community yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Organization posts and public workshops will appear here.</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  {/* Posts with reactions + comments */}
                  <div className="w-full max-w-xl mx-auto space-y-4 lg:mx-0">
                    {communityPosts.map((post) => (
                      <PostCard key={post.id} post={post} onLikeChange={loadCommunityFeed} onDeleted={loadCommunityFeed} />
                    ))}
                    {communityPosts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No posts yet.</p>
                    )}
                  </div>

                  {/* Upcoming public workshops */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-500" /> Upcoming public workshops
                    </h3>
                    {communityWorkshops.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No public workshops scheduled.</p>
                    ) : (
                      communityWorkshops.map((ws) => (
                        <Card key={ws.id} className="border-0 ring-1 ring-border">
                          <CardContent className="pt-4 pb-4">
                            <p className="text-sm font-semibold">{ws.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(ws.scheduled_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              {ws.organization?.name && ` · ${ws.organization.name}`}
                            </p>
                            {ws.organization?.slug && (
                              <Link href={`/orgs/${ws.organization.slug}`} className="mt-2 inline-block text-xs text-violet-500 hover:underline">
                                View organization →
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="mentors" className="mt-4">
              <div className="flex items-center gap-2 mb-4 rounded-lg bg-muted/40 border px-3 py-2">
                <Award className="h-4 w-4 text-violet-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Mentors are users with a 4+ star rating, verified identity, or 3+ completed skill swaps.
                </p>
              </div>
              {renderPeopleGrid(filteredMentors, 'mentors')}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Skill Swap Modal */}
      <SkillSwapModal
        target={swapTarget}
        myTeachSkills={myTeachSkills}
        open={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
      />
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <BrowseContent />
    </Suspense>
  )
}
