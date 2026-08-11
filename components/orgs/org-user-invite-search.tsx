'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Search, UserPlus, Ban } from 'lucide-react'
import type { Organization, OrganizationUserInvite, Profile } from '@/lib/types'
import { sendOrgNotifications } from '@/lib/org-notifications'

const ROLES = ['member', 'instructor', 'moderator', 'admin'] as const

interface OrgUserInviteSearchProps {
  org: Organization
  memberUserIds: string[]
}

export function OrgUserInviteSearch({ org, memberUserIds }: OrgUserInviteSearchProps) {
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [role, setRole] = useState<(typeof ROLES)[number]>('member')
  const [invites, setInvites] = useState<OrganizationUserInvite[]>([])
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadInvites = async () => {
      const { data } = await supabase
        .from('organization_user_invites')
        .select('*, profile:profiles!organization_user_invites_user_id_fkey(*)')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
      setInvites((data as unknown as OrganizationUserInvite[]) ?? [])
    }
    loadInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, headline, location')
        .ilike('name', `%${q}%`)
        .limit(8)
      setResults((data as unknown as Profile[]) ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const pendingInviteFor = (userId: string) =>
    invites.find((i) => i.user_id === userId && i.status === 'pending')

  const invite = async (profile: Profile) => {
    setBusyUserId(profile.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('organization_user_invites')
        .insert({
          organization_id: org.id,
          user_id: profile.id,
          invited_by: user?.id,
          role,
        })
        .select()
        .single()
      if (error) throw error

      await sendOrgNotifications([{
        userId: profile.id,
        type: 'org_invite',
        title: `${org.name} invited you to join`,
        body: `You've been invited as ${role}. Open the organization page to respond.`,
        href: `/orgs/${org.slug}`,
      }])

      setInvites((prev) => [{ ...data, profile }, ...prev])
      toast.success(`Invitation sent to ${profile.name}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setBusyUserId(null)
    }
  }

  const revokeInvite = async (inv: OrganizationUserInvite) => {
    const respondedAt = new Date().toISOString()
    const { error } = await supabase
      .from('organization_user_invites')
      .update({ status: 'revoked', responded_at: respondedAt })
      .eq('id', inv.id)
    if (error) { toast.error('Failed to revoke'); return }

    await sendOrgNotifications([{
      userId: inv.user_id,
      type: 'org_invite_revoked',
      title: `${org.name} withdrew their invitation`,
      href: `/orgs/${org.slug}`,
    }])

    setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: 'revoked', responded_at: respondedAt } : i))
    toast.success('Invitation revoked')
  }

  const STATUS_BADGE: Record<OrganizationUserInvite['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    declined: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    revoked: 'bg-muted text-muted-foreground',
  }

  return (
    <Card className="border-0 ring-1 ring-border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-violet-500" /> Invite Existing Users
        </CardTitle>
        <CardDescription>Search people on the platform and invite them directly — no join request needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search users by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Select value={role} onValueChange={(v) => { if (v) setRole(v as typeof ROLES[number]) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">Invite as {r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {searching && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}

        {!searching && results.length > 0 && (
          <div className="space-y-2">
            {results.map((p) => {
              const isMember = memberUserIds.includes(p.id)
              const pending = pendingInviteFor(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar_url ?? ''} />
                      <AvatarFallback className="text-xs font-bold">{p.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.headline || p.location || ''}</p>
                    </div>
                  </div>
                  {isMember ? (
                    <Badge variant="outline">Already a member</Badge>
                  ) : pending ? (
                    <Badge className={`border-0 ${STATUS_BADGE.pending}`}>Invited</Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0"
                      disabled={busyUserId === p.id}
                      onClick={() => invite(p)}
                    >
                      {busyUserId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      Invite
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {invites.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase font-medium text-muted-foreground">Sent invitations</Label>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={inv.profile?.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs font-bold">{inv.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.profile?.name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      as {inv.role} · {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`border-0 capitalize ${STATUS_BADGE[inv.status]}`}>{inv.status}</Badge>
                  {inv.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke invitation"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => revokeInvite(inv)}
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
