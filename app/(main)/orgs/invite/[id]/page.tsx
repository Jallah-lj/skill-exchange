'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Building2, CheckCircle2, ShieldCheck, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import Link from 'next/link'
import type { Organization, OrganizationInvite, Profile } from '@/lib/types'

export default function OrgInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [invite, setInvite] = useState<OrganizationInvite | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [inviter, setInviter] = useState<Profile | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  const load = async () => {
    try {
      // 1. Fetch invite
      const { data: inviteData, error: inviteErr } = await supabase
        .from('organization_invites')
        .select('*, organization:organizations(*), inviter:profiles!organization_invites_inviter_id_fkey(*)')
        .eq('id', id)
        .single()

      if (inviteErr || !inviteData) {
        toast.error('Invite not found or already used.')
        router.push('/orgs')
        return
      }

      if (inviteData.status !== 'pending') {
        toast.error('This invitation is no longer active.')
        router.push('/orgs')
        return
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        toast.error('This invitation has expired.')
        router.push('/orgs')
        return
      }

      setInvite(inviteData as any)
      setOrg(inviteData.organization as any)
      setInviter(inviteData.inviter as any)

      // 2. Check current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // 3. Verify email match if logged in
      if (user && user.email?.toLowerCase() !== inviteData.email.toLowerCase()) {
        toast.error(`This invite was sent to ${inviteData.email}, but you are logged in as ${user.email}.`)
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!currentUser || !invite || !org) return
    setAccepting(true)
    try {
      // 1. Add to members
      const { error: memberErr } = await supabase
        .from('organization_members')
        .upsert({
          organization_id: org.id,
          user_id: currentUser.id,
          role: invite.role as any
        }, { onConflict: 'organization_id,user_id' })

      if (memberErr) throw memberErr

      // 2. Update invite status
      await supabase
        .from('organization_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      toast.success(`Welcome to ${org.name}!`)
      router.push(`/orgs/${org.slug}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation')
    } finally {
      setAccepting(false)
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

  const isEmailMismatch = currentUser && currentUser.email?.toLowerCase() !== invite?.email.toLowerCase()

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="border-0 ring-1 ring-border shadow-xl overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Building2 className="h-12 w-12 text-white/20 absolute" />
          <div className="h-20 w-24 rounded-2xl bg-background shadow-lg flex items-center justify-center text-violet-700 font-bold text-3xl ring-4 ring-background transform translate-y-8">
            {org.avatar_url ? (
              <img src={org.avatar_url} alt="" className="h-full w-full object-cover rounded-2xl" />
            ) : (
              org.name.slice(0, 2).toUpperCase()
            )}
          </div>
        </div>

        <CardHeader className="pt-12 text-center pb-2">
          <CardTitle className="text-2xl font-bold">{org.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-1.5">
            {org.is_verified && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 h-5 px-1.5 gap-1 font-bold text-[10px] uppercase tracking-wide"><ShieldCheck className="h-3 w-3" /> Verified Org</Badge>}
            Invitation to join as <span className="font-bold text-foreground capitalize">{invite?.role}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4 text-center">
          {inviter && (
            <div className="bg-muted/40 rounded-2xl p-4 flex items-center gap-3 text-left">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={inviter.avatar_url ?? ''} />
                <AvatarFallback className="font-bold">{inviter.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Invited by</p>
                <p className="text-sm font-bold">{inviter.name}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {org.bio || `${org.name} invited you to join their community on SkillSwap.`}
            </p>
          </div>

          {!currentUser ? (
            <div className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">Sign in to accept this invitation</p>
              <div className="flex gap-2">
                <Button className="w-full gap-2" nativeButton={false} render={<Link href={`/login?returnTo=/orgs/invite/${id}`} />}>
                  <LogIn className="h-4 w-4" /> Login
                </Button>
                <Button variant="outline" className="w-full gap-2" nativeButton={false} render={<Link href={`/signup?returnTo=/orgs/invite/${id}`} />}>
                  <UserPlus className="h-4 w-4" /> Sign Up
                </Button>
              </div>
            </div>
          ) : isEmailMismatch ? (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
              This invite was sent to <strong>{invite?.email}</strong>. You are currently logged in as {currentUser.email}. Please switch accounts to accept.
            </div>
          ) : (
            <Button 
              className="w-full h-11 text-base gap-2 bg-violet-600 hover:bg-violet-700" 
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Accept & Join Organization
            </Button>
          )}
        </CardContent>

        <CardFooter className="bg-muted/30 border-t py-3 flex justify-center">
          <Link href={`/orgs/${org.slug}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            View organization profile <ArrowRight className="h-3 w-3" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
