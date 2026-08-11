'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2, Building2, Globe, ShieldCheck, Settings, Users, UserPlus,
  ArrowRight, ExternalLink, Lock, KeyRound, Mail, MapPin, Phone, Calendar,
  CheckCircle2, Clock, XCircle, Megaphone, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import type { Organization, OrganizationMember, OrganizationJoinRequest, OrganizationAnnouncement, Workshop, WorkshopAttendee, OrganizationUserInvite } from '@/lib/types'
import { sendOrgNotifications, getOrgManagerIds, cooldownDaysLeft } from '@/lib/org-notifications'

type Tab = 'overview' | 'feed' | 'workshops' | 'members' | 'join'

export default function OrgProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [org, setOrg]           = useState<Organization | null>(null)
  const [members, setMembers]   = useState<OrganizationMember[]>([])
  const [announcements, setAnnouncements] = useState<OrganizationAnnouncement[]>([])
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [myAttendance, setMyAttendance] = useState<Record<string, WorkshopAttendee>>({})
  const [myRole, setMyRole]     = useState<string | null>(null)   // null = not a member
  const [myRequest, setMyRequest] = useState<OrganizationJoinRequest | null>(null)
  const [myInvite, setMyInvite] = useState<OrganizationUserInvite | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('overview')

  // Messaging
  const [messageOpen, setMessageOpen] = useState(false)
  const [msgSubject, setMsgSubject]   = useState('')
  const [msgContent, setMsgContent]   = useState('')
  const [sendingMsg, setSendingMsg]   = useState(false)

  // Join form state
  const [joinLoading, setJoinLoading]   = useState(false)
  const [codeInput, setCodeInput]       = useState('')
  const [requestMsg, setRequestMsg]     = useState('')
  const [requestSkills, setRequestSkills] = useState('')

  useEffect(() => {
    load()
  }, [slug])

  const load = async () => {
    setLoading(true)

    // 1. Fetch org
    const { data: orgData, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single()

    if (orgErr || !orgData) { router.push('/orgs'); return }
    setOrg(orgData)

    // 2. Fetch members — use explicit FK alias to avoid ambiguity with invited_by → profiles
    const { data: memberData, error: memberErr } = await supabase
      .from('organization_members')
      .select('*, profile:profiles!organization_members_user_id_fkey(*)')
      .eq('organization_id', orgData.id)
      .order('created_at', { ascending: true })

    if (memberErr) {
      // Fallback: fetch members without profile join, then fetch profiles separately
      const { data: membersOnly } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgData.id)

      if (membersOnly && membersOnly.length > 0) {
        const profileIds = membersOnly.map(m => m.user_id)
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', profileIds)

        const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))
        setMembers(membersOnly.map(m => ({ ...m, profile: profileMap[m.user_id] })) as any)
      } else {
        setMembers([])
      }
    } else {
      setMembers((memberData ?? []) as any)
    }

    // 3. Current user context
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const myMembership = (memberData ?? []).find(m => m.user_id === user.id)
      if (myMembership) {
        setMyRole(myMembership.role)
      } else {
        // Latest join request (there can be several now that history is kept)
        const { data: reqData } = await supabase
          .from('organization_join_requests')
          .select('*')
          .eq('organization_id', orgData.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
        setMyRequest(reqData?.[0] ?? null)

        // Pending direct invitation for me?
        const { data: invData } = await supabase
          .from('organization_user_invites')
          .select('*')
          .eq('organization_id', orgData.id)
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle()
        setMyInvite((invData as OrganizationUserInvite) ?? null)
      }
    }

    // 4. Fetch announcements
    const { data: annData } = await supabase
      .from('organization_announcements')
      .select('*, author:profiles!organization_announcements_author_id_fkey(*)')
      .eq('organization_id', orgData.id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    setAnnouncements((annData as any) ?? [])

    // 5. Fetch workshops
    const { data: wsData } = await supabase
      .from('workshops')
      .select('*, instructor:profiles!workshops_instructor_id_fkey(*)')
      .eq('organization_id', orgData.id)
      .order('scheduled_at', { ascending: true })
    
    setWorkshops((wsData as any) ?? [])

    // 6. Fetch my workshop attendance
    if (user) {
      const { data: attData } = await supabase
        .from('workshop_attendees')
        .select('*')
        .eq('user_id', user.id)
      
      const attMap = Object.fromEntries((attData ?? []).map(a => [a.workshop_id, a]))
      setMyAttendance(attMap)
    }

    setLoading(false)
  }

  // ── Messaging actions ─────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!currentUserId || !org || !msgContent) return
    setSendingMsg(true)
    try {
      // 1. Get or create thread
      const { data: thread, error: tErr } = await supabase
        .from('organization_threads')
        .upsert({ 
          organization_id: org.id, 
          user_id: currentUserId,
          subject: msgSubject || null
        }, { onConflict: 'organization_id,user_id' })
        .select('*')
        .single()
      
      if (tErr) throw tErr

      // 2. Send message
      const { error: mErr } = await supabase
        .from('organization_messages')
        .insert({
          thread_id: thread.id,
          sender_id: currentUserId,
          content: msgContent
        })
      
      if (mErr) throw mErr

      toast.success('Message sent to organization admins!')
      setMessageOpen(false)
      setMsgSubject('')
      setMsgContent('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setSendingMsg(false)
    }
  }

  // ── Workshop actions ──────────────────────────────────────────────────────

  const registerWorkshop = async (wsId: string) => {
    if (!currentUserId) { router.push('/login'); return }
    const { data, error } = await supabase
      .from('workshop_attendees')
      .upsert({ workshop_id: wsId, user_id: currentUserId, status: 'registered' })
      .select('*')
      .single()
    
    if (error) {
      toast.error(error.message || 'Failed to register')
    } else {
      setMyAttendance(prev => ({ ...prev, [wsId]: data }))
      toast.success(`Registered! Your confirmation code is ${data.confirmation_code}`)
    }
  }

  const cancelWorkshop = async (wsId: string) => {
    const att = myAttendance[wsId]
    if (!att) return
    const { error } = await supabase
      .from('workshop_attendees')
      .delete()
      .eq('id', att.id)
    
    if (error) {
      toast.error(error.message || 'Failed to cancel')
    } else {
      setMyAttendance(prev => {
        const next = { ...prev }
        delete next[wsId]
        return next
      })
      toast.success('Registration cancelled')
    }
  }

  // ── Join actions ──────────────────────────────────────────────────────────

  const atMemberLimit = () => {
    if (org?.max_members == null) return false
    if (members.length >= org.max_members) {
      toast.error('This organization has reached its member limit')
      return true
    }
    return false
  }

  const joinOpen = async () => {
    if (!currentUserId || !org || atMemberLimit()) return
    setJoinLoading(true)
    const { error } = await supabase
      .from('organization_members')
      .upsert(
        { organization_id: org.id, user_id: currentUserId, role: org.default_member_role ?? 'member' },
        { onConflict: 'organization_id,user_id' }
      )
    if (error) {
      toast.error(error.message || 'Failed to join')
    } else {
      toast.success(`You joined ${org.name}!`)
      await load()
    }
    setJoinLoading(false)
  }

  const submitRequest = async () => {
    if (!currentUserId || !org) return
    setJoinLoading(true)
    const { data, error } = await supabase
      .from('organization_join_requests')
      .insert({
        organization_id: org.id,
        user_id: currentUserId,
        message: requestMsg || null,
        skills: requestSkills || null,
        status: 'pending',
      })
      .select()
      .single()
    if (error) {
      toast.error(error.message || 'Failed to submit request')
    } else {
      toast.success('Join request submitted — the admin will review it shortly.')
      setMyRequest(data)
      setTab('overview')

      const managerIds = await getOrgManagerIds(org.id)
      await sendOrgNotifications(managerIds.map((id) => ({
        userId: id,
        type: 'org_join_request' as const,
        title: `New join request for ${org.name}`,
        href: `/orgs/${org.slug}/dashboard`,
      })))
    }
    setJoinLoading(false)
  }

  const joinByCode = async () => {
    if (!currentUserId || !org) return
    setJoinLoading(true)
    const input = codeInput.trim()

    // Legacy static org code joins as default member
    if (org.org_code && input.toUpperCase() === org.org_code.toUpperCase()) {
      if (atMemberLimit()) { setJoinLoading(false); return }
      const { error } = await supabase
        .from('organization_members')
        .upsert(
          { organization_id: org.id, user_id: currentUserId, role: org.default_member_role ?? 'member' },
          { onConflict: 'organization_id,user_id' }
        )
      if (error) toast.error(error.message || 'Failed to join')
      else { toast.success(`You joined ${org.name}!`); await load() }
      setJoinLoading(false)
      return
    }

    // Otherwise try managed invite codes (validates expiry/limit/revocation atomically)
    const { error } = await supabase.rpc('redeem_org_invite_code', { p_code: input })
    if (error) toast.error(error.message || 'Invalid invite code')
    else { toast.success(`You joined ${org.name}!`); await load() }
    setJoinLoading(false)
  }

  // ── Direct invitation responses ─────────────────────────────────────────────

  const respondToInvite = async (accept: boolean) => {
    if (!currentUserId || !org || !myInvite) return
    if (accept && atMemberLimit()) return
    setInviteBusy(true)
    try {
      const respondedAt = new Date().toISOString()
      const { error } = await supabase
        .from('organization_user_invites')
        .update({ status: accept ? 'accepted' : 'declined', responded_at: respondedAt })
        .eq('id', myInvite.id)
      if (error) throw error

      if (accept) {
        const { error: memberErr } = await supabase
          .from('organization_members')
          .upsert(
            { organization_id: org.id, user_id: currentUserId, role: myInvite.role },
            { onConflict: 'organization_id,user_id' }
          )
        if (memberErr) throw memberErr
      }

      if (myInvite.invited_by) {
        await sendOrgNotifications([{
          userId: myInvite.invited_by,
          type: accept ? 'org_invite_accepted' : 'org_invite_declined',
          title: accept
            ? `Your invitation to ${org.name} was accepted`
            : `Your invitation to ${org.name} was declined`,
          href: `/orgs/${org.slug}`,
        }])
      }

      setMyInvite(null)
      if (accept) { toast.success(`Welcome to ${org.name}!`); await load() }
      else toast.success('Invitation declined')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to respond to invitation')
    } finally {
      setInviteBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) return null

  const isAdmin     = myRole === 'owner' || myRole === 'admin'
  const isMember    = myRole !== null
  const memberCount = members.length
  const cooldownLeft = myRequest ? cooldownDaysLeft(myRequest) : 0
  const canApply    = !isMember && (!myRequest || (myRequest.status === 'declined' && cooldownLeft === 0))

  const ownerMember = members.find(m => m.role === 'owner')

  return (
    <div className="max-w-5xl mx-auto space-y-0 py-4">

      {/* ── Cover / Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-100 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/30 mb-6" style={{ minHeight: 180 }}>
        {org.cover_image_url && (
          <img src={org.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="relative p-6 pb-0 flex flex-col sm:flex-row gap-5 items-start">
          {/* Logo */}
          <div className="h-24 w-24 rounded-2xl bg-white dark:bg-background shadow-lg flex items-center justify-center text-violet-700 font-bold text-3xl shrink-0 ring-4 ring-border/30 overflow-hidden -mb-12">
            {org.avatar_url
              ? <img src={org.avatar_url} alt="" className="h-full w-full object-cover" />
              : org.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 pt-2 pb-14 sm:pb-6 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{org.name}</h1>
              {org.is_verified && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 gap-1 border-0">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              )}
              {org.category && (
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wide">{org.category}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {memberCount} member{memberCount !== 1 ? 's' : ''}</span>
              {org.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {org.city}</span>}
              {org.website && (
                <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                  <Globe className="h-3.5 w-3.5" /> {org.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-16 sm:mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {isMember && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1 border-0 h-7 px-3">
              <CheckCircle2 className="h-3.5 w-3.5" /> {myRole === 'owner' ? 'Owner' : myRole === 'admin' ? 'Admin' : myRole === 'moderator' ? 'Moderator' : myRole === 'instructor' ? 'Instructor' : 'Member'}
            </Badge>
          )}
          {!isMember && myRequest?.status === 'pending' && (
            <Badge variant="outline" className="gap-1 h-7 px-3 text-yellow-600 border-yellow-300">
              <Clock className="h-3.5 w-3.5" /> Request pending
            </Badge>
          )}
          {!isMember && myRequest?.status === 'declined' && cooldownLeft > 0 && (
            <Badge variant="outline" className="gap-1 h-7 px-3 text-red-500 border-red-300">
              <XCircle className="h-3.5 w-3.5" /> Request declined
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href={`/orgs/${slug}/dashboard`}>
              <Button size="sm" className="gap-2">
                <Settings className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
          )}
          {!currentUserId && (
            <Button size="sm" variant="outline" onClick={() => router.push('/login')} className="gap-2">
              <UserPlus className="h-4 w-4" /> Sign in to join
            </Button>
          )}
          {currentUserId && (
            <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="gap-2" />}>
                <MessageSquare className="h-4 w-4" /> Message
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Message {org.name}</DialogTitle>
                  <DialogDescription>Send a direct message to the organization administrators.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="msg-subject">Subject (optional)</Label>
                    <Input id="msg-subject" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} placeholder="What is this about?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msg-content">Message</Label>
                    <Textarea 
                      id="msg-content" 
                      value={msgContent} 
                      onChange={(e) => setMsgContent(e.target.value)} 
                      placeholder="Type your message here..."
                      rows={5}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setMessageOpen(false)}>Cancel</Button>
                  <Button onClick={sendMessage} disabled={sendingMsg || !msgContent}>
                    {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Send Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {currentUserId && canApply && (
            <>
              {org.membership_type === 'open' && (
                <Button size="sm" onClick={joinOpen} disabled={joinLoading} className="gap-2">
                  {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Join Organization
                </Button>
              )}
              {org.membership_type === 'request' && (
                <Button size="sm" variant="outline" onClick={() => setTab('join')} className="gap-2">
                  <Mail className="h-4 w-4" /> Request to Join
                </Button>
              )}
              {org.membership_type === 'invitation' && (
                <Button size="sm" variant="outline" onClick={() => setTab('join')} className="gap-2">
                  <KeyRound className="h-4 w-4" /> Enter Code
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Pending direct invitation ── */}
      {!isMember && myInvite && (
        <Card className="border-0 ring-1 ring-violet-300 dark:ring-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
          <CardContent className="flex flex-col gap-3 pt-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{org.name} has invited you to join{myInvite.role !== 'member' ? ` as ${myInvite.role}` : ''}.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Accept to become a member instantly — no request needed.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => respondToInvite(true)} disabled={inviteBusy} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondToInvite(false)} disabled={inviteBusy}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Reapply cooldown notice ── */}
      {!isMember && myRequest?.status === 'declined' && cooldownLeft > 0 && (
        <Card className="border-0 ring-1 ring-red-200 dark:ring-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Your request was declined. You can submit another request in {cooldownLeft} day{cooldownLeft === 1 ? '' : 's'}.
            </p>
            {myRequest.decline_reason && (
              <p className="mt-1 text-sm text-muted-foreground">Reason: {myRequest.decline_reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
          <TabsTrigger value="feed" className="rounded-lg gap-2">
            Feed {announcements.length > 0 && <span className="text-[10px] font-bold bg-muted rounded-full px-1.5 py-0.5">{announcements.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="workshops" className="rounded-lg gap-2">
            Workshops {workshops.length > 0 && <span className="text-[10px] font-bold bg-muted rounded-full px-1.5 py-0.5">{workshops.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="members" className="rounded-lg gap-2">
            Members {memberCount > 0 && <span className="text-[10px] font-bold bg-muted rounded-full px-1.5 py-0.5">{memberCount}</span>}
          </TabsTrigger>
          {currentUserId && canApply && (
            <TabsTrigger value="join" className="rounded-lg">Join</TabsTrigger>
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {org.bio ? (
                <Card className="border-0 ring-1 ring-border">
                  <CardContent className="pt-5">
                    <p className="text-sm leading-relaxed text-muted-foreground">{org.bio}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No description yet.</p>
                </div>
              )}

              {/* Owner card */}
              {ownerMember?.profile && (
                <Card className="border-0 ring-1 ring-border">
                  <CardContent className="pt-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Owner</p>
                    <Link href={`/profile/${ownerMember.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <Avatar className="h-10 w-10 ring-2 ring-border">
                        <AvatarImage src={ownerMember.profile.avatar_url ?? ''} />
                        <AvatarFallback className="font-bold">{ownerMember.profile.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{ownerMember.profile.name}</p>
                        {ownerMember.profile.bio && <p className="text-xs text-muted-foreground line-clamp-1">{ownerMember.profile.bio}</p>}
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar: contact + stats */}
            <div className="space-y-4">
              <Card className="border-0 ring-1 ring-border">
                <CardContent className="pt-5 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Info</p>
                  {org.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${org.email}`} className="hover:underline truncate">{org.email}</a>
                    </div>
                  )}
                  {org.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{org.phone}</span>
                    </div>
                  )}
                  {(org.city || org.country) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{[org.city, org.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    {org.membership_type === 'open'
                      ? <><Users className="h-4 w-4 text-emerald-500 shrink-0" /><span>Open to join</span></>
                      : org.membership_type === 'request'
                      ? <><Mail className="h-4 w-4 text-yellow-500 shrink-0" /><span>Request to join</span></>
                      : <><Lock className="h-4 w-4 text-muted-foreground shrink-0" /><span>Invitation only</span></>}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <Card className="border-0 ring-1 ring-border">
                <CardContent className="pt-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Stats</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-xl bg-muted/40">
                      <p className="text-2xl font-bold">{memberCount}</p>
                      <p className="text-xs text-muted-foreground">Members</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-muted/40">
                      <p className="text-2xl font-bold">{members.filter(m => m.role === 'admin' || m.role === 'owner').length}</p>
                      <p className="text-xs text-muted-foreground">Admins</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Feed */}
        <TabsContent value="feed" className="space-y-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-2xl">
                <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-medium">No announcements yet</p>
                <p className="text-sm text-muted-foreground mt-1">Stay tuned for updates from {org.name}!</p>
              </div>
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id} className="border-0 ring-1 ring-border shadow-sm overflow-hidden">
                  <div className={`h-1.5 w-full ${
                    ann.type === 'alert' ? 'bg-red-500' : 
                    ann.type === 'event' ? 'bg-blue-500' : 
                    ann.type === 'milestone' ? 'bg-amber-500' : 'bg-violet-500'
                  }`} />
                  <CardContent className="pt-5 pb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 ring-1 ring-border">
                          <AvatarImage src={org.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px] font-bold">{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-bold">{org.name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(ann.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px] h-5 px-1.5">{ann.type}</Badge>
                    </div>
                    <h3 className="text-lg font-bold leading-tight">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Workshops */}
        <TabsContent value="workshops" className="space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Upcoming Workshops</h3>
                <p className="text-sm text-muted-foreground">Join group learning sessions hosted by {org.name}.</p>
              </div>
            </div>

            {workshops.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-2xl">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-medium">No workshops scheduled</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later for new group sessions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {workshops.map((ws) => {
                  const isRegistered = !!myAttendance[ws.id]
                  return (
                    <Card key={ws.id} className="border-0 ring-1 ring-border shadow-sm flex flex-col h-full">
                      <CardContent className="pt-6 flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Badge variant={ws.status === 'scheduled' ? 'default' : 'secondary'} className="text-[10px] uppercase h-5">
                              {ws.status}
                            </Badge>
                            <h4 className="text-lg font-bold leading-tight">{ws.title}</h4>
                          </div>
                          <Avatar className="h-10 w-10 ring-2 ring-border shrink-0">
                            <AvatarImage src={org.avatar_url ?? ''} />
                            <AvatarFallback className="font-bold">{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </div>

                        {ws.description && (
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {ws.description}
                          </p>
                        )}

                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-violet-500 shrink-0" />
                            <span className="font-medium">{new Date(ws.scheduled_at).toLocaleDateString()} at {new Date(ws.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-violet-500 shrink-0" />
                            <span>{ws.duration_minutes} minutes</span>
                          </div>
                          {ws.location && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-violet-500 shrink-0" />
                              <span className="truncate">{ws.location}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="bg-muted/30 border-t pt-4 rounded-b-xl flex flex-col gap-2">
                        {isRegistered && (
                          <div className="w-full flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">Confirmation code</span>
                            <span className="font-mono tracking-widest font-bold">{myAttendance[ws.id].confirmation_code}</span>
                          </div>
                        )}
                        <div className="w-full flex gap-2">
                          {isRegistered ? (
                            <Button
                              variant="outline"
                              className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => cancelWorkshop(ws.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" /> Registered
                            </Button>
                          ) : (
                            <Button
                              className="w-full gap-2"
                              disabled={ws.status !== 'scheduled'}
                              onClick={() => registerWorkshop(ws.id)}
                            >
                              Register
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => toast.info('Workshop details coming soon!')}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          {members.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium">No members yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to join!</p>
            </div>
          ) : (
            <>
              {/* Role sections */}
              {(['owner', 'admin', 'moderator', 'instructor', 'member'] as const).map((role) => {
                const group = members.filter(m => m.role === role)
                if (!group.length) return null
                return (
                  <div key={role} className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admins' : role === 'moderator' ? 'Moderators' : role === 'instructor' ? 'Instructors / Mentors' : 'Members'}
                      </h3>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">{group.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.map((member) => (
                        <MemberCard key={member.id} member={member} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </TabsContent>

        {/* Join */}
        {currentUserId && canApply && (
          <TabsContent value="join" className="max-w-lg mx-auto">
            {org.membership_type === 'open' && (
              <Card className="border-0 ring-1 ring-border">
                <CardContent className="pt-6 pb-6 text-center space-y-4">
                  <Users className="h-12 w-12 mx-auto text-violet-500" />
                  <div>
                    <p className="font-semibold text-lg">Open Organization</p>
                    <p className="text-sm text-muted-foreground mt-1">Anyone can join instantly.</p>
                  </div>
                  <Button onClick={joinOpen} disabled={joinLoading} className="w-full gap-2">
                    {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Join {org.name}
                  </Button>
                </CardContent>
              </Card>
            )}

            {org.membership_type === 'request' && (
              <Card className="border-0 ring-1 ring-border">
                <CardContent className="pt-6 pb-6 space-y-4">
                  <div className="text-center mb-2">
                    <Mail className="h-12 w-12 mx-auto text-violet-500 mb-2" />
                    <p className="font-semibold text-lg">Request Membership</p>
                    <p className="text-sm text-muted-foreground">An admin will review and approve your request.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reqMsg">Why do you want to join? <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="reqMsg"
                      placeholder="Tell the admins why you'd like to be a member..."
                      value={requestMsg}
                      onChange={(e) => setRequestMsg(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reqSkills">Your skills (optional)</Label>
                    <Input
                      id="reqSkills"
                      placeholder="e.g. Python, Design, Teaching..."
                      value={requestSkills}
                      onChange={(e) => setRequestSkills(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={submitRequest}
                    disabled={joinLoading || !requestMsg.trim()}
                    className="w-full gap-2"
                  >
                    {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Submit Request
                  </Button>
                </CardContent>
              </Card>
            )}

            {org.membership_type === 'invitation' && (
              <Card className="border-0 ring-1 ring-border">
                <CardContent className="pt-6 pb-6 space-y-4">
                  <div className="text-center mb-2">
                    <KeyRound className="h-12 w-12 mx-auto text-violet-500 mb-2" />
                    <p className="font-semibold text-lg">Enter Organization Code</p>
                    <p className="text-sm text-muted-foreground">Ask a member for the organization code to join.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Organization Code</Label>
                    <Input
                      id="code"
                      placeholder="SKL-XXXX-0000"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      className="font-mono text-center text-lg tracking-widest"
                    />
                  </div>
                  <Button
                    onClick={joinByCode}
                    disabled={joinLoading || codeInput.length < 4}
                    className="w-full gap-2"
                  >
                    {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Join with Code
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function MemberCard({ member }: { member: OrganizationMember }) {
  const roleBadgeClass: Record<string, string> = {
    owner:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    admin:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    moderator:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    instructor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    member:     'bg-muted text-muted-foreground',
  }
  return (
    <Link href={`/profile/${member.user_id}`} className="group">
      <Card className="hover:ring-2 hover:ring-primary/50 transition-all h-full">
        <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
          <Avatar className="h-16 w-16 ring-4 ring-border group-hover:ring-primary/20 transition-all">
            <AvatarImage src={member.profile?.avatar_url ?? ''} />
            <AvatarFallback className="text-lg font-bold bg-violet-100 text-violet-700">
              {member.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold text-sm group-hover:text-primary transition-colors">
              {member.profile?.name ?? 'Unknown'}
            </p>
            <Badge className={`text-[10px] uppercase font-bold px-1.5 h-4 border-0 ${roleBadgeClass[member.role] ?? ''}`}>
              {member.role}
            </Badge>
          </div>
          {member.profile?.bio && (
            <p className="text-xs text-muted-foreground line-clamp-2">{member.profile.bio}</p>
          )}
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1 group-hover:bg-primary/10 group-hover:text-primary">
            View Profile <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}
