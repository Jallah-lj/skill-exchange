'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
  Loader2, ArrowLeft, Settings, Users, Mail, UserPlus, Shield,
  Save, Trash2, ShieldAlert, KeyRound, CheckCircle2, XCircle, Clock,
  Copy, RefreshCw, Lock, Eye, EyeOff, Megaphone, Calendar, MapPin, MessageSquare, Inbox, Send, Layout, Globe, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import type { Organization, OrganizationMember, OrganizationInvite, OrganizationRole, OrganizationJoinRequest, OrgVisibility, OrgMembershipType, OrganizationAnnouncement, Workshop, OrganizationThread, OrganizationMessage, WorkshopAttendee, OrganizationPost } from '@/lib/types'
import { OrgOverviewTab } from '@/components/orgs/org-overview-tab'
import { OrgMembersTab } from '@/components/orgs/org-members-tab'
import { OrgBrandingSettings } from '@/components/orgs/org-branding-settings'
import { OrgDangerZone } from '@/components/orgs/org-danger-zone'
import { OrgRequestsTab } from '@/components/orgs/org-requests-tab'
import { OrgInviteCodes } from '@/components/orgs/org-invite-codes'
import { OrgUserInviteSearch } from '@/components/orgs/org-user-invite-search'
import { OrgMembershipSettings } from '@/components/orgs/org-membership-settings'
import { PostImageUpload } from '@/components/orgs/post-image-upload'
import { ManagedPostCard } from '@/components/orgs/managed-post-card'
import { OrgAnalyticsTab } from '@/components/orgs/org-analytics-tab'
import { MentionTextarea } from '@/components/mention-textarea'
import { notifyMentions } from '@/lib/mentions'
import { getOrgMemberIds, sendOrgNotifications } from '@/lib/org-notifications'

const ALL_ROLES: OrganizationRole[] = ['owner', 'admin', 'moderator', 'instructor', 'member']

const TEXTAREA_CLASSNAME =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

function Separator({ className }: { className?: string }) {
  return <div className={`h-px bg-border ${className ?? ''}`} />
}

export default function OrgDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router   = useRouter()
  const supabase = createClient()

  const [org, setOrg]           = useState<Organization | null>(null)
  const [members, setMembers]   = useState<OrganizationMember[]>([])
  const [invites, setInvites]   = useState<OrganizationInvite[]>([])
  const [requests, setRequests] = useState<OrganizationJoinRequest[]>([])
  const [userRole, setUserRole] = useState<OrganizationRole | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]   = useState(true)

  // Announcements
  const [announcements, setAnnouncements] = useState<OrganizationAnnouncement[]>([])
  const [annTitle, setAnnTitle]           = useState('')
  const [annContent, setAnnContent]       = useState('')
  const [annType, setAnnType]             = useState<'news' | 'event' | 'alert' | 'milestone'>('news')
  const [postingAnn, setPostingAnn]       = useState(false)
  const [editingAnn, setEditingAnn]       = useState<OrganizationAnnouncement | null>(null)
  const [editAnnTitle, setEditAnnTitle]   = useState('')
  const [editAnnContent, setEditAnnContent] = useState('')
  const [editAnnType, setEditAnnType]     = useState<'news' | 'event' | 'alert' | 'milestone'>('news')
  const [savingAnnEdit, setSavingAnnEdit] = useState(false)

  // Workshops
  const [workshops, setWorkshops]         = useState<Workshop[]>([])
  const [wsTitle, setWsTitle]             = useState('')
  const [wsDesc, setWsDesc]               = useState('')
  const [wsDate, setWsDate]               = useState('')
  const [wsDuration, setWsDuration]       = useState('60')
  const [wsMaxParticipants, setWsMaxParticipants] = useState('')
  const [wsLocation, setWsLocation]       = useState('')
  const [wsIsPublic, setWsIsPublic]       = useState(false)
  const [creatingWs, setCreatingWs]       = useState(false)
  const [editingWs, setEditingWs]         = useState<Workshop | null>(null)
  const [editWsTitle, setEditWsTitle]     = useState('')
  const [editWsDesc, setEditWsDesc]       = useState('')
  const [editWsDate, setEditWsDate]       = useState('')
  const [editWsDuration, setEditWsDuration] = useState('60')
  const [editWsMaxParticipants, setEditWsMaxParticipants] = useState('')
  const [editWsLocation, setEditWsLocation] = useState('')
  const [editWsIsPublic, setEditWsIsPublic] = useState(false)
  const [savingWsEdit, setSavingWsEdit]   = useState(false)

  // Posts
  const [posts, setPosts]                 = useState<OrganizationPost[]>([])
  const [postTitle, setPostTitle]         = useState('')
  const [postContent, setPostContent]     = useState('')
  const [postCategory, setPostCategory]   = useState<'opportunity' | 'news' | 'project' | 'help_wanted' | 'event'>('news')
  const [postImageUrl, setPostImageUrl]   = useState('')
  const [creatingPost, setCreatingPost]   = useState(false)

  // Workshop Attendees
  const [selectedWs, setSelectedWs]       = useState<Workshop | null>(null)
  const [attendees, setAttendees]         = useState<WorkshopAttendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)

  // Messaging (Inbox)
  const [threads, setThreads]             = useState<OrganizationThread[]>([])
  const [selectedThread, setSelectedThread] = useState<OrganizationThread | null>(null)
  const [messages, setMessages]           = useState<OrganizationMessage[]>([])
  const [replyContent, setReplyContent]   = useState('')
  const [sendingReply, setSendingReply]   = useState(false)

  // Settings form
  const [name, setName]                   = useState('')
  const [bio, setBio]                     = useState('')
  const [website, setWebsite]             = useState('')
  const [email, setEmail]                 = useState('')
  const [phone, setPhone]                 = useState('')
  const [country, setCountry]             = useState('')
  const [city, setCity]                   = useState('')
  const [visibility, setVisibility]       = useState<OrgVisibility>('public')
  const [membershipType, setMembershipType] = useState<OrgMembershipType>('open')
  const [internalOnly, setInternalOnly]   = useState(false)
  const [emailDomain, setEmailDomain]     = useState('')
  const [saving, setSaving]               = useState(false)

  // Invite dialog
  const [inviteOpen, setInviteOpen]       = useState(false)
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState<'admin' | 'member'>('member')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Org code
  const [regeneratingCode, setRegeneratingCode] = useState(false)

  // Refs for stable subscription
  const threadsRef = useRef<OrganizationThread[]>(threads)
  const selectedThreadIdRef = useRef<string | null>(selectedThread?.id || null)

  useEffect(() => { threadsRef.current = threads }, [threads])
  useEffect(() => { selectedThreadIdRef.current = selectedThread?.id || null }, [selectedThread?.id])

  useEffect(() => { load() }, [slug])

  // Real-time Messaging Subscription
  useEffect(() => {
    if (!org?.id) return

    // Unique name per session to avoid collisions during StrictMode double-mount
    const subscriptionName = `org-inbox-${org.id}-${Math.random().toString(36).slice(2, 7)}`
    
    const channel = supabase
      .channel(subscriptionName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'organization_messages',
        },
        async (payload) => {
          const newMsg = payload.new as OrganizationMessage
          const currentThreads = threadsRef.current
          const currentSelectedId = selectedThreadIdRef.current
          
          // Verify if message belongs to our org's threads
          const threadExists = currentThreads.some(t => t.id === newMsg.thread_id)
          if (!threadExists) return

          // Update thread's last_message_at
          setThreads(prev => 
            prev.map(t => t.id === newMsg.thread_id ? { ...t, last_message_at: newMsg.created_at } : t)
                .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          )

          // If this thread is currently selected, add the message
          if (currentSelectedId === newMsg.thread_id) {
            const { data: sender } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).single()
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, { ...newMsg, sender: sender as any }]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [org?.id]) // ONLY depend on org.id to keep subscription stable

  const load = async () => {
    const { data: orgData } = await supabase.from('organizations').select('*').eq('slug', slug).single()
    if (!orgData) { router.push('/404'); return }
    setOrg(orgData)
    syncForm(orgData)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    // Fetch members with explicit FK to avoid ambiguity
    const { data: memberData, error: memberErr } = await supabase
      .from('organization_members')
      .select('*, profile:profiles!organization_members_user_id_fkey(*)')
      .eq('organization_id', orgData.id)

    let resolvedMembers: OrganizationMember[] = []
    if (memberErr || !memberData) {
      // Fallback: two-step fetch
      const { data: membersOnly } = await supabase.from('organization_members').select('*').eq('organization_id', orgData.id)
      if (membersOnly?.length) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', membersOnly.map(m => m.user_id))
        const pMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))
        resolvedMembers = membersOnly.map(m => ({ ...m, profile: pMap[m.user_id] })) as any
      }
    } else {
      resolvedMembers = memberData as any
    }
    setMembers(resolvedMembers)

    // Check admin
    const myMembership = resolvedMembers.find(m => m.user_id === user.id)
    const isOwner = orgData.owner_id === user.id
    if (!myMembership && !isOwner) {
      toast.error('No permission to manage this organization')
      router.push(`/orgs/${slug}`)
      return
    }
    setUserRole((myMembership?.role ?? 'owner') as OrganizationRole)

    // Fetch invites + join requests + announcements + workshops + threads + posts in parallel
    const [
      { data: inviteData }, 
      { data: reqData, error: reqErr }, 
      { data: annData }, 
      { data: wsData }, 
      { data: threadData },
      { data: postData }
    ] = await Promise.all([
      supabase.from('organization_invites').select('*').eq('organization_id', orgData.id).eq('status', 'pending'),
      supabase
        .from('organization_join_requests')
        .select('*, profile:profiles!organization_join_requests_user_id_fkey(*), reviewer:profiles!organization_join_requests_reviewed_by_fkey(*)')
        .eq('organization_id', orgData.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('organization_announcements')
        .select('*, author:profiles!organization_announcements_author_id_fkey(*)')
        .eq('organization_id', orgData.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workshops')
        .select('*, instructor:profiles!workshops_instructor_id_fkey(*)')
        .eq('organization_id', orgData.id)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('organization_threads')
        .select('*, user:profiles!organization_threads_user_id_fkey(*)')
        .eq('organization_id', orgData.id)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('organization_posts')
        .select('*, author:profiles!organization_posts_author_id_fkey(*)')
        .eq('organization_id', orgData.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])

    setInvites(inviteData ?? [])
    setAnnouncements((annData as any) ?? [])
    setWorkshops((wsData as any) ?? [])
    setThreads((threadData as any) ?? [])
    setPosts((postData as any) ?? [])

    let allRequests: OrganizationJoinRequest[] = []
    if (reqErr || !reqData) {
      // Fallback for join requests
      const { data: reqOnly } = await supabase.from('organization_join_requests').select('*').eq('organization_id', orgData.id).order('created_at', { ascending: false })
      if (reqOnly?.length) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', reqOnly.map(r => r.user_id))
        const pMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]))
        allRequests = reqOnly.map(r => ({ ...r, profile: pMap[r.user_id] })) as any
      }
    } else {
      allRequests = reqData as any
    }

    // Auto-expire stale pending requests if the org has that configured
    const expireDays = (orgData as Organization).auto_expire_requests_days
    if (expireDays) {
      const cutoff = Date.now() - expireDays * 86_400_000
      const stale = allRequests.filter(r => r.status === 'pending' && new Date(r.created_at).getTime() < cutoff)
      if (stale.length > 0) {
        const reviewedAt = new Date().toISOString()
        await supabase
          .from('organization_join_requests')
          .update({ status: 'declined', decline_reason: `Request expired automatically after ${expireDays} days`, reviewed_at: reviewedAt })
          .in('id', stale.map(r => r.id))
        allRequests = allRequests.map(r => stale.some(s => s.id === r.id)
          ? { ...r, status: 'declined' as const, decline_reason: `Request expired automatically after ${expireDays} days`, reviewed_at: reviewedAt }
          : r)
      }
    }
    setRequests(allRequests)

    setLoading(false)
  }

  const syncForm = (o: Organization) => {
    setName(o.name)
    setBio(o.bio ?? '')
    setWebsite(o.website ?? '')
    setEmail((o as any).email ?? '')
    setPhone((o as any).phone ?? '')
    setCountry((o as any).country ?? '')
    setCity((o as any).city ?? '')
    setVisibility(((o as any).visibility ?? 'public') as OrgVisibility)
    setMembershipType(((o as any).membership_type ?? 'open') as OrgMembershipType)
    setInternalOnly(o.internal_only_swapping)
    setEmailDomain((o as any).email_domain ?? '')
  }

  // ── Settings save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!org) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name, bio: bio || null, website: website || null,
          email: email || null, phone: phone || null,
          country: country || null, city: city || null,
          visibility, membership_type: membershipType,
          internal_only_swapping: internalOnly,
          email_domain: emailDomain || null,
        })
        .eq('id', org.id)
      if (error) throw error
      toast.success('Settings saved!')
      setOrg({ ...org, name, bio, website, internal_only_swapping: internalOnly } as any)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Announcements ──────────────────────────────────────────────────────────
  const postAnnouncement = async () => {
    if (!org || !annTitle || !annContent) return
    setPostingAnn(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('organization_announcements')
        .insert({
          organization_id: org.id,
          author_id: user?.id,
          title: annTitle,
          content: annContent,
          type: annType,
        })
        .select('*, author:profiles!organization_announcements_author_id_fkey(*)')
        .single()
      if (error) throw error
      setAnnouncements(prev => [data as any, ...prev])
      setAnnTitle('')
      setAnnContent('')
      toast.success('Announcement posted!')

      const memberIds = await getOrgMemberIds(org.id, user?.id)
      await sendOrgNotifications(memberIds.map((id) => ({
        userId: id,
        type: 'org_announcement' as const,
        title: `${org.name} posted: ${annTitle}`,
        href: `/orgs/${org.slug}`,
      })))
    } catch (err: any) {
      toast.error(err.message || 'Failed to post announcement')
    } finally {
      setPostingAnn(false)
    }
  }

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    try {
      const { error } = await supabase.from('organization_announcements').delete().eq('id', id)
      if (error) throw error
      setAnnouncements(prev => prev.filter(a => a.id !== id))
      toast.success('Announcement deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  const openEditAnnouncement = (ann: OrganizationAnnouncement) => {
    setEditingAnn(ann)
    setEditAnnTitle(ann.title)
    setEditAnnContent(ann.content)
    setEditAnnType(ann.type)
  }

  const updateAnnouncement = async () => {
    if (!editingAnn || !editAnnTitle.trim() || !editAnnContent.trim()) return
    setSavingAnnEdit(true)
    try {
      const patch = {
        title: editAnnTitle.trim(),
        content: editAnnContent.trim(),
        type: editAnnType,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('organization_announcements')
        .update(patch)
        .eq('id', editingAnn.id)
      if (error) throw error
      setAnnouncements(prev => prev.map(a => a.id === editingAnn.id ? { ...a, ...patch } : a))
      setEditingAnn(null)
      toast.success('Announcement updated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update announcement')
    } finally {
      setSavingAnnEdit(false)
    }
  }

  // ── Workshops ──────────────────────────────────────────────────────────────
  const createWorkshop = async () => {
    if (!org || !wsTitle || !wsDate) return
    setCreatingWs(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('workshops')
        .insert({
          organization_id: org.id,
          instructor_id: user?.id,
          title: wsTitle,
          description: wsDesc || null,
          scheduled_at: new Date(wsDate).toISOString(),
          duration_minutes: parseInt(wsDuration),
          max_participants: wsMaxParticipants ? parseInt(wsMaxParticipants) : null,
          location: wsLocation || null,
          is_public: wsIsPublic,
        })
        .select('*, instructor:profiles!workshops_instructor_id_fkey(*)')
        .single()
      if (error) throw error
      setWorkshops(prev => [...prev, data as any].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))
      setWsTitle('')
      setWsDesc('')
      setWsDate('')
      setWsDuration('60')
      setWsMaxParticipants('')
      setWsLocation('')
      setWsIsPublic(false)
      toast.success('Workshop scheduled!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule workshop')
    } finally {
      setCreatingWs(false)
    }
  }

  const deleteWorkshop = async (id: string) => {
    if (!confirm('Cancel and delete this workshop?')) return
    try {
      const { error } = await supabase.from('workshops').delete().eq('id', id)
      if (error) throw error
      setWorkshops(prev => prev.filter(w => w.id !== id))
      toast.success('Workshop deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openEditWorkshop = (ws: Workshop) => {
    setEditingWs(ws)
    setEditWsTitle(ws.title)
    setEditWsDesc(ws.description ?? '')
    setEditWsDate(toDatetimeLocal(ws.scheduled_at))
    setEditWsDuration(String(ws.duration_minutes))
    setEditWsMaxParticipants(ws.max_participants ? String(ws.max_participants) : '')
    setEditWsLocation(ws.location ?? '')
    setEditWsIsPublic(ws.is_public)
  }

  const updateWorkshop = async () => {
    if (!editingWs || !editWsTitle.trim() || !editWsDate) return
    setSavingWsEdit(true)
    try {
      const patch = {
        title: editWsTitle.trim(),
        description: editWsDesc.trim() || null,
        scheduled_at: new Date(editWsDate).toISOString(),
        duration_minutes: parseInt(editWsDuration),
        max_participants: editWsMaxParticipants ? parseInt(editWsMaxParticipants) : null,
        location: editWsLocation.trim() || null,
        is_public: editWsIsPublic,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('workshops')
        .update(patch)
        .eq('id', editingWs.id)
      if (error) throw error
      setWorkshops(prev => prev
        .map(w => w.id === editingWs.id ? { ...w, ...patch } : w)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))
      setEditingWs(null)
      toast.success('Workshop updated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workshop')
    } finally {
      setSavingWsEdit(false)
    }
  }

  const viewAttendees = async (ws: Workshop) => {
    setSelectedWs(ws)
    setLoadingAttendees(true)
    const { data, error } = await supabase
      .from('workshop_attendees')
      .select('*, profile:profiles!workshop_attendees_user_id_fkey(*)')
      .eq('workshop_id', ws.id)
    
    if (error) toast.error('Failed to load attendees')
    else setAttendees((data as any) ?? [])
    setLoadingAttendees(false)
  }

  const markAttended = async (attendeeId: string) => {
    const { error } = await supabase
      .from('workshop_attendees')
      .update({ status: 'attended' })
      .eq('id', attendeeId)

    if (error) {
      toast.error(error.message || 'Failed to check in attendee')
    } else {
      setAttendees(prev => prev.map(a => a.id === attendeeId ? { ...a, status: 'attended' } : a))
      toast.success('Checked in!')
    }
  }

  // ── Public Posts ──────────────────────────────────────────────────────────
  const createPost = async () => {
    if (!org || !postTitle || !postContent) return
    setCreatingPost(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('organization_posts')
        .insert({
          organization_id: org.id,
          author_id: user?.id,
          title: postTitle,
          content: postContent,
          category: postCategory,
          image_url: postImageUrl || null,
          is_published: true,
        })
        .select('*, author:profiles!organization_posts_author_id_fkey(*)')
        .single()
      if (error) throw error
      setPosts(prev => [data as any, ...prev])
      void notifyMentions(supabase, {
        text: `${postTitle} ${postContent}`,
        actorName: org?.name ?? 'Someone',
        title: `${org?.name ?? 'An organization'} mentioned you in a post`,
        href: `/posts/${data.id}`,
        excludeUserId: user?.id,
      })
      setPostTitle('')
      setPostContent('')
      setPostCategory('news')
      setPostImageUrl('')
      toast.success('Post published to browse page!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create post')
    } finally {
      setCreatingPost(false)
    }
  }

  const deletePost = async (id: string) => {
    if (!confirm('Move this post to Trash? You can restore it from Settings within 30 days.')) return
    try {
      const { error } = await supabase.from('organization_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setPosts(prev => prev.filter(p => p.id !== id))
      toast.success('Post moved to Trash')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post')
    }
  }

  const togglePostPublish = async (post: OrganizationPost) => {
    try {
      const { error } = await supabase
        .from('organization_posts')
        .update({ is_published: !post.is_published })
        .eq('id', post.id)
      if (error) throw error
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_published: !post.is_published } : p))
      toast.success(post.is_published ? 'Post hidden' : 'Post published')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update post')
    }
  }

  // ── Messaging (Inbox) ──────────────────────────────────────────────────────
  const fetchMessages = async (thread: OrganizationThread) => {
    setSelectedThread(thread)
    setMessages([])
    const { data, error } = await supabase
      .from('organization_messages')
      .select('*, sender:profiles!organization_messages_sender_id_fkey(*)')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
    
    if (error) toast.error('Failed to load messages')
    else setMessages((data as any) ?? [])
  }

  const sendReply = async () => {
    if (!selectedThread || !replyContent) return
    setSendingReply(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('organization_messages')
        .insert({
          thread_id: selectedThread.id,
          sender_id: user?.id,
          content: replyContent,
        })
        .select('*, sender:profiles!organization_messages_sender_id_fkey(*)')
        .single()
      
      if (error) throw error

      // Update thread last_message_at
      await supabase.from('organization_threads').update({ last_message_at: new Date().toISOString() }).eq('id', selectedThread.id)

      setMessages(prev => [...prev, data as any])
      setReplyContent('')
      setThreads(prev => prev.map(t => t.id === selectedThread.id ? { ...t, last_message_at: new Date().toISOString() } : t).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()))
      toast.success('Reply sent')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply')
    } finally {
      setSendingReply(false)
    }
  }

  // ── Member management ──────────────────────────────────────────────────────
  const updateRole = async (memberId: string, newRole: OrganizationRole) => {
    try {
      const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId)
      if (error) throw error
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      toast.success('Role updated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role')
    }
  }

  const removeMember = async (memberId: string, memberName?: string) => {
    if (!confirm(`Remove ${memberName ?? 'this member'} from the organization?`)) return
    try {
      const { error } = await supabase.from('organization_members').delete().eq('id', memberId)
      if (error) throw error
      setMembers(prev => prev.filter(m => m.id !== memberId))
      toast.success('Member removed')
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member')
    }
  }

  // ── Contact an applicant via the org inbox ─────────────────────────────────
  const contactApplicant = async (userId: string, name?: string) => {
    if (!org) return
    try {
      const { error } = await supabase
        .from('organization_threads')
        .upsert(
          { organization_id: org.id, user_id: userId },
          { onConflict: 'organization_id,user_id' }
        )
      if (error) throw error
      const { data: threadData } = await supabase
        .from('organization_threads')
        .select('*, user:profiles!organization_threads_user_id_fkey(*)')
        .eq('organization_id', org.id)
        .order('last_message_at', { ascending: false })
      setThreads((threadData as any) ?? [])
      setActiveTab('inbox')
      toast.info(`Thread with ${name ?? 'applicant'} is ready in the inbox`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to open a thread')
    }
  }

  // ── Invites ────────────────────────────────────────────────────────────────
  const sendInvite = async () => {
    if (!org) return
    setSendingInvite(true)
    try {
      const res = await fetch('/api/orgs/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')
      setInvites(prev => [...prev, data.invite])
      toast.success(`Invite sent to ${inviteEmail}`)
      setInviteOpen(false)
      setInviteEmail('')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSendingInvite(false)
    }
  }

  const cancelInvite = async (id: string) => {
    try {
      const { error } = await supabase.from('organization_invites').delete().eq('id', id)
      if (error) throw error
      setInvites(prev => prev.filter(i => i.id !== id))
      toast.success('Invite cancelled')
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invite')
    }
  }

  // ── Org code ───────────────────────────────────────────────────────────────
  const copyCode = () => {
    if (!org?.org_code) return
    navigator.clipboard.writeText(org.org_code)
    toast.success('Code copied!')
  }

  const regenerateCode = async () => {
    if (!org) return
    if (!confirm('Regenerate the org code? The old code will stop working immediately.')) return
    setRegeneratingCode(true)
    try {
      const { data, error } = await supabase.rpc('generate_org_code') as any
      if (error) throw error
      const newCode = data as string
      const { error: updateErr } = await supabase.from('organizations').update({ org_code: newCode }).eq('id', org.id)
      if (updateErr) throw updateErr
      setOrg({ ...org, org_code: newCode } as any)
      toast.success('New code generated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate code')
    } finally {
      setRegeneratingCode(false)
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

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <Link href={`/orgs/${slug}`}>
        <Button variant="ghost" size="sm" className="gap-2 mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Profile
        </Button>
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="h-16 w-16 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 font-bold text-2xl overflow-hidden">
          {org.avatar_url
            ? <img src={org.avatar_url} alt="" className="h-full w-full object-cover" />
            : org.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{org.name} — Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage settings, members, and join requests.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2 rounded-lg"><Layout className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2 rounded-lg"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="general"  className="gap-2 rounded-lg"><Settings className="h-4 w-4" /> General</TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2 rounded-lg"><Megaphone className="h-4 w-4" /> Announcements</TabsTrigger>
          <TabsTrigger value="workshops" className="gap-2 rounded-lg"><Calendar className="h-4 w-4" /> Workshops</TabsTrigger>
          <TabsTrigger value="posts" className="gap-2 rounded-lg"><Layout className="h-4 w-4" /> Public Posts</TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2 rounded-lg"><Inbox className="h-4 w-4" /> Inbox</TabsTrigger>
          <TabsTrigger value="members"  className="gap-2 rounded-lg"><Users className="h-4 w-4" /> Members <span className="text-[10px] font-bold bg-muted rounded-full px-1.5">{members.length}</span></TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 rounded-lg">
            <UserPlus className="h-4 w-4" /> Requests
            {pendingCount > 0 && <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="invites"  className="gap-2 rounded-lg"><Mail className="h-4 w-4" /> Invites</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <OrgOverviewTab
            slug={slug}
            memberCount={members.length}
            pendingRequestCount={pendingCount}
            announcementCount={announcements.length}
            workshopCount={workshops.length}
            threadCount={threads.length}
            postCount={posts.length}
            onNavigate={setActiveTab}
          />
        </TabsContent>

        {/* ── Analytics ── */}
        <TabsContent value="analytics">
          <OrgAnalyticsTab org={org} />
        </TabsContent>

        {/* ── General Settings ── */}
        <TabsContent value="general" className="space-y-6">
          <OrgBrandingSettings
            orgId={org.id}
            avatarUrl={org.avatar_url ?? ''}
            coverUrl={org.cover_image_url ?? ''}
            onUpdated={(patch) => setOrg((prev) => prev ? { ...prev, ...patch } : prev)}
          />

          <OrgMembershipSettings
            org={org}
            onUpdated={(patch) => setOrg((prev) => prev ? { ...prev, ...patch } : prev)}
          />
          <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <Card className="border-0 ring-1 ring-border shadow-md">
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>Update your organization's public profile and membership rules.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="bio">Description</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@org.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 XXX XXX XXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City / Country</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kigali, Rwanda" />
                  </div>
                </div>

                <Separator className="my-2" />

                {/* Visibility */}
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['public','Public',Eye],['private','Private',Lock],['hidden','Hidden',EyeOff]] as const).map(([val, label, Icon]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setVisibility(val as OrgVisibility)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${
                          visibility === val ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Membership type */}
                <div className="space-y-2">
                  <Label>How people join</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['open','Open',Users],['request','Request',Mail],['invitation','Code Only',KeyRound]] as const).map(([val, label, Icon]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMembershipType(val as OrgMembershipType)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all ${
                          membershipType === val ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email domain */}
                <div className="space-y-2">
                  <Label htmlFor="emailDomain">Email Domain Auto-Join</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">@</span>
                    <Input id="emailDomain" className="pl-7" placeholder="ur.ac.rw" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value.replace(/^@/, ''))} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Anyone signing up with this email domain automatically joins.</p>
                </div>

                {/* Org code display */}
                {(org as any).org_code && (
                  <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
                    <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-violet-500" /> Organization Code</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-lg font-bold tracking-widest bg-background border rounded-lg px-4 py-2 text-center">
                        {(org as any).org_code}
                      </code>
                      <Button type="button" variant="outline" size="icon" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
                      <Button type="button" variant="outline" size="icon" onClick={regenerateCode} disabled={regeneratingCode}>
                        {regeneratingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Share this code so people can join without an email invite.</p>
                  </div>
                )}

                {/* Internal-only toggle */}
                <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-violet-500" /> Internal Only Swapping
                    </Label>
                    <p className="text-xs text-muted-foreground">Members can only swap skills with other members of this org.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInternalOnly(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${internalOnly ? 'bg-primary' : 'bg-input'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${internalOnly ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 pt-6 border-t rounded-b-xl">
                <Button type="submit" disabled={saving} className="ml-auto gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </form>

          {userRole === 'owner' && (
            <OrgDangerZone
              orgId={org.id}
              orgName={org.name}
              currentUserId={currentUserId}
              members={members}
              onTransferred={load}
            />
          )}
        </TabsContent>

        {/* ── Announcements ── */}
        <TabsContent value="announcements" className="space-y-6">
          <Card className="border-0 ring-1 ring-border shadow-md">
            <CardHeader>
              <CardTitle>Post Announcement</CardTitle>
              <CardDescription>Broadcast news or updates to all organization members.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3 space-y-2">
                  <Label htmlFor="ann-title">Title</Label>
                  <Input
                    id="ann-title"
                    placeholder="e.g. New Workshop Series!"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ann-type">Type</Label>
                  <Select value={annType} onValueChange={(v) => setAnnType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-content">Content</Label>
                <Textarea
                  id="ann-content"
                  placeholder="What's happening?"
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t pt-4 rounded-b-xl">
              <Button
                onClick={postAnnouncement}
                disabled={postingAnn || !annTitle || !annContent}
                className="ml-auto gap-2"
              >
                {postingAnn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                Post Announcement
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold px-1">Past Announcements</h3>
            {announcements.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">No announcements posted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <Card key={ann.id} className="border-0 ring-1 ring-border shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 h-5">{ann.type}</Badge>
                            <CardTitle className="text-base">{ann.title}</CardTitle>
                          </div>
                          <CardDescription className="text-xs">
                            Posted on {new Date(ann.created_at).toLocaleDateString()} by {org.name}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditAnnouncement(ann)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteAnnouncement(ann.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Dialog open={!!editingAnn} onOpenChange={(open) => !open && setEditingAnn(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit announcement</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>Title</Label>
                  <Input value={editAnnTitle} onChange={(e) => setEditAnnTitle(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={editAnnType} onValueChange={(v) => { if (v) setEditAnnType(v as any) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="milestone">Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Content</Label>
                  <Textarea rows={5} value={editAnnContent} onChange={(e) => setEditAnnContent(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingAnn(null)} disabled={savingAnnEdit}>Cancel</Button>
                <Button onClick={updateAnnouncement} disabled={savingAnnEdit || !editAnnTitle.trim() || !editAnnContent.trim()}>
                  {savingAnnEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Workshops ── */}
        <TabsContent value="workshops" className="space-y-6">
          <Card className="border-0 ring-1 ring-border shadow-md">
            <CardHeader>
              <CardTitle>Schedule a Workshop</CardTitle>
              <CardDescription>Create a group session for members to learn together.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ws-title">Workshop Title</Label>
                  <Input
                    id="ws-title"
                    placeholder="e.g. Intro to UI Design"
                    value={wsTitle}
                    onChange={(e) => setWsTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-date">Date & Time</Label>
                  <Input
                    id="ws-date"
                    type="datetime-local"
                    value={wsDate}
                    onChange={(e) => setWsDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-duration">Duration (minutes)</Label>
                  <Input
                    id="ws-duration"
                    type="number"
                    value={wsDuration}
                    onChange={(e) => setWsDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-max">Max Participants (optional)</Label>
                  <Input
                    id="ws-max"
                    type="number"
                    placeholder="No limit"
                    value={wsMaxParticipants}
                    onChange={(e) => setWsMaxParticipants(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="ws-location">Location / Link</Label>
                  <Input
                    id="ws-location"
                    placeholder="e.g. Google Meet link or Room 302"
                    value={wsLocation}
                    onChange={(e) => setWsLocation(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="ws-desc">Description</Label>
                  <Textarea
                    id="ws-desc"
                    placeholder="What will participants learn?"
                    rows={3}
                    value={wsDesc}
                    onChange={(e) => setWsDesc(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" /> List on global browse page
                      </Label>
                      <p className="text-xs text-muted-foreground">Make this workshop discoverable to everyone on the platform.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWsIsPublic(v => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${wsIsPublic ? 'bg-primary' : 'bg-input'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${wsIsPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t pt-4 rounded-b-xl">
              <Button
                onClick={createWorkshop}
                disabled={creatingWs || !wsTitle || !wsDate}
                className="ml-auto gap-2"
              >
                {creatingWs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Schedule Workshop
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold px-1">Upcoming & Past Workshops</h3>
            {workshops.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">No workshops scheduled yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workshops.map((ws) => (
                  <div key={ws.id} className="flex flex-wrap items-center justify-between p-4 border rounded-xl hover:bg-muted/10 transition-colors gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={ws.status === 'scheduled' ? 'default' : 'secondary'} className="text-[10px] uppercase h-5">
                          {ws.status}
                        </Badge>
                        <p className="font-bold truncate">{ws.title}</p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(ws.scheduled_at).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ws.location || 'No location'}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ws.max_participants ? `Max ${ws.max_participants}` : 'Unlimited'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => viewAttendees(ws)}
                      >
                        <Users className="h-4 w-4" />
                        Attendees
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditWorkshop(ws)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteWorkshop(ws.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Dialog open={!!editingWs} onOpenChange={(open) => !open && setEditingWs(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit workshop</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Workshop Title</Label>
                    <Input value={editWsTitle} onChange={(e) => setEditWsTitle(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Date & Time</Label>
                    <Input type="datetime-local" value={editWsDate} onChange={(e) => setEditWsDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={editWsDuration} onChange={(e) => setEditWsDuration(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Max Participants (optional)</Label>
                    <Input type="number" placeholder="No limit" value={editWsMaxParticipants} onChange={(e) => setEditWsMaxParticipants(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 grid gap-1.5">
                    <Label>Location / Link</Label>
                    <Input value={editWsLocation} onChange={(e) => setEditWsLocation(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 grid gap-1.5">
                    <Label>Description</Label>
                    <Textarea rows={3} value={editWsDesc} onChange={(e) => setEditWsDesc(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between gap-4 p-4 border rounded-xl bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" /> List on global browse page
                      </Label>
                      <p className="text-xs text-muted-foreground">Make this workshop discoverable to everyone on the platform.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditWsIsPublic(v => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${editWsIsPublic ? 'bg-primary' : 'bg-input'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${editWsIsPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingWs(null)} disabled={savingWsEdit}>Cancel</Button>
                <Button onClick={updateWorkshop} disabled={savingWsEdit || !editWsTitle.trim() || !editWsDate}>
                  {savingWsEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!selectedWs} onOpenChange={(open) => !open && setSelectedWs(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Attendees: {selectedWs?.title}</DialogTitle>
                <DialogDescription>
                  List of users registered for this workshop.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[400px] overflow-y-auto py-4 space-y-4">
                {loadingAttendees ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : attendees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No one has registered yet.</p>
                  </div>
                ) : (
                  attendees.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-xl transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={att.profile?.avatar_url ?? ''} />
                        <AvatarFallback className="font-bold">{att.profile?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{att.profile?.name}</p>
                        <p className="text-xs text-muted-foreground">Registered on {new Date(att.created_at).toLocaleDateString()}</p>
                        <p className="text-xs font-mono tracking-wider text-muted-foreground">Code: {att.confirmation_code}</p>
                      </div>
                      {att.status === 'registered' ? (
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => markAttended(att.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Check in
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase">{att.status}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelectedWs(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Public Posts ── */}
        <TabsContent value="posts" className="space-y-6">
          <Card className="border-0 ring-1 ring-border shadow-md">
            <CardHeader>
              <CardTitle>Create Public Post</CardTitle>
              <CardDescription>Share opportunities, news, or requests with the entire platform community.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3 space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    placeholder="e.g. Seeking Summer Interns!"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-cat">Category</Label>
                  <Select value={postCategory} onValueChange={(v) => setPostCategory(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="help_wanted">Help Wanted</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-content">Content</Label>
                <MentionTextarea
                  id="post-content"
                  placeholder="Describe your opportunity or news in detail... use @ to mention a user or organization"
                  rows={6}
                  value={postContent}
                  onChange={setPostContent}
                  className={TEXTAREA_CLASSNAME}
                />
              </div>
              <div className="space-y-2">
                <Label>Photo (optional)</Label>
                <PostImageUpload imageUrl={postImageUrl} onChange={setPostImageUrl} />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t pt-4 rounded-b-xl">
              <Button
                onClick={createPost}
                disabled={creatingPost || !postTitle || !postContent}
                className="ml-auto gap-2"
              >
                {creatingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layout className="h-4 w-4" />}
                Publish to Browse
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold px-1">Managed Posts</h3>
            {posts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl">
                <Layout className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm font-medium text-muted-foreground">No public posts yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {posts.map((post) => (
                  <ManagedPostCard
                    key={post.id}
                    post={post}
                    orgName={org.name}
                    orgAvatarUrl={org.avatar_url}
                    onUpdated={(updated) => setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))}
                    onTogglePublish={() => togglePostPublish(post)}
                    onDelete={() => deletePost(post.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Inbox (Messaging) ── */}
        <TabsContent value="inbox" className="space-y-6">
          <Card className="border-0 ring-1 ring-border shadow-md overflow-hidden h-[600px] flex flex-col sm:flex-row">
            {/* Thread list */}
            <div className="w-full sm:w-80 border-r flex flex-col bg-muted/10">
              <div className="p-4 border-b bg-background/50">
                <h3 className="font-bold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Threads</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">No messages yet.</p>
                  </div>
                ) : (
                  threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => fetchMessages(t)}
                      className={`w-full text-left p-4 border-b hover:bg-muted/30 transition-colors ${selectedThread?.id === t.id ? 'bg-muted/50 ring-1 ring-inset ring-primary/20' : ''}`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <Avatar className="h-8 w-8 ring-1 ring-border">
                          <AvatarImage src={t.user?.avatar_url ?? ''} />
                          <AvatarFallback className="text-[10px] font-bold">{t.user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{t.user?.name || 'User'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(t.last_message_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {t.subject && <p className="text-xs font-medium truncate text-muted-foreground">{t.subject}</p>}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col bg-background">
              {selectedThread ? (
                <>
                  <div className="p-4 border-b bg-background flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 ring-1 ring-border">
                        <AvatarImage src={selectedThread.user?.avatar_url ?? ''} />
                        <AvatarFallback className="text-[10px] font-bold">{selectedThread.user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{selectedThread.user?.name || 'User'}</p>
                        <p className="text-[10px] text-muted-foreground">Direct Message Thread</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m) => {
                      const isMe = m.sender_id !== selectedThread.user_id
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                            {m.content}
                            <p className={`text-[10px] mt-1 opacity-70 ${isMe ? 'text-right' : 'text-left'}`}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="p-4 border-t bg-muted/10">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a reply..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                      />
                      <Button size="icon" onClick={sendReply} disabled={sendingReply || !replyContent}>
                        {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <Inbox className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Select a thread to view messages</p>
                  <p className="text-xs mt-1">Direct inquiries from users will appear here.</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members">
          <OrgMembersTab
            members={members}
            userRole={userRole ?? 'member'}
            currentUserId={currentUserId}
            onUpdateRole={updateRole}
            onRemove={removeMember}
          />
        </TabsContent>

        {/* ── Join Requests ── */}
        <TabsContent value="requests">
          <OrgRequestsTab
            org={org}
            requests={requests}
            memberCount={members.length}
            onRequestsChanged={setRequests}
            onApproved={load}
            onContact={contactApplicant}
          />
        </TabsContent>

        {/* ── Invites (codes, direct user invites, email) ── */}
        <TabsContent value="invites" className="space-y-6">
          <OrgInviteCodes org={org} />
          <OrgUserInviteSearch org={org} memberUserIds={members.map(m => m.user_id)} />
          <Card className="border-0 ring-1 ring-border shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Email Invitations</CardTitle>
                  <CardDescription>Send email invites to specific people.</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> New Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium">No active invitations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invite.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-7 text-[10px] uppercase font-bold px-2">{invite.role}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => cancelInvite(invite.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a new member</DialogTitle>
            <DialogDescription>They'll receive an email to join your organization.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); sendInvite() }} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email Address</Label>
              <Input id="inv-email" type="email" placeholder="name@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-role">Initial Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sendingInvite || !inviteEmail} className="gap-2">
                {sendingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
