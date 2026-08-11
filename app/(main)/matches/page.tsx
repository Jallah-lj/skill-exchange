'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Check, X, Clock, Users, UserX } from 'lucide-react'
import type { MatchRequest, Profile } from '@/lib/types'

interface MatchWithProfile extends MatchRequest {
  otherUser: Profile
  isIncoming: boolean
}

export default function MatchesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [matches, setMatches] = useState<MatchWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [activeTab, setActiveTab] = useState('incoming')

  const [unmatchTarget, setUnmatchTarget] = useState<string | null>(null)
  const [unmatching, setUnmatching] = useState(false)

  useEffect(() => {
    loadMatches()
  }, [])

  const loadMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setCurrentUserId(user.id)

    const { data: matchData } = await supabase
      .from('match_requests')
      .select('*, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    const enriched: MatchWithProfile[] = (matchData ?? []).map((m: any) => ({
      ...m,
      otherUser: m.from_user_id === user.id ? m.to_profile : m.from_profile,
      isIncoming: m.to_user_id === user.id,
    }))

    setMatches(enriched)
    const hasIncoming = enriched.some((m: any) => m.to_user_id === user.id && m.status === 'pending')
    setActiveTab(hasIncoming ? 'incoming' : 'accepted')
    setLoading(false)
  }

  const respondToRequest = async (matchId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('match_requests')
      .update({ status })
      .eq('id', matchId)

    if (error) { toast.error('Failed to update request'); return }
    toast.success(status === 'accepted' ? 'Match accepted! You can now chat.' : 'Request declined.')
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, status } : m))

    if (status === 'accepted') {
      const match = matches.find((m) => m.id === matchId)
      if (match) {
        const { data: me } = await supabase.from('profiles').select('name').eq('id', currentUserId).single()
        await supabase.from('notifications').insert({
          user_id: match.from_user_id,
          type: 'match_accepted',
          title: `${me?.name ?? 'Someone'} accepted your match request`,
          href: `/chat/${matchId}`,
        })
      }
    }
  }

  const confirmUnmatch = async () => {
    if (!unmatchTarget) return
    setUnmatching(true)
    const { error } = await supabase
      .from('match_requests')
      .update({ status: 'unmatched', unmatched_at: new Date().toISOString() })
      .eq('id', unmatchTarget)

    if (error) {
      toast.error('Failed to disconnect.')
      setUnmatching(false)
      return
    }

    setMatches((prev) => prev.filter((m) => m.id !== unmatchTarget))
    setUnmatchTarget(null)
    setUnmatching(false)
    toast.success('Disconnected successfully.')
  }

  const incoming = matches.filter((m) => m.isIncoming && m.status === 'pending')
  const sent     = matches.filter((m) => !m.isIncoming && m.status === 'pending')
  const accepted = matches.filter((m) => m.status === 'accepted' && !m.unmatched_at)

  const unmatchTargetUser = unmatchTarget
    ? matches.find((m) => m.id === unmatchTarget)?.otherUser
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const MatchCard = ({ match }: { match: MatchWithProfile }) => (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={match.otherUser.avatar_url ?? ''} />
            <AvatarFallback>{match.otherUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{match.otherUser.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(match.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {match.status === 'accepted' && (
              <>
                <Button size="sm" nativeButton={false} render={<Link href={`/chat/${match.id}`} />}>
                  <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUnmatchTarget(match.id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Disconnect"
                >
                  <UserX className="h-4 w-4" />
                </Button>
              </>
            )}
            {match.status === 'pending' && match.isIncoming && (
              <>
                <Button size="sm" onClick={() => respondToRequest(match.id, 'accepted')}>
                  <Check className="h-4 w-4 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => respondToRequest(match.id, 'declined')}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            {match.status === 'pending' && !match.isIncoming && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3.5 w-3.5" /> Pending
              </Badge>
            )}
            {match.status === 'declined' && (
              <Badge variant="outline" className="text-muted-foreground">Declined</Badge>
            )}
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/profile/${match.otherUser.id}`} />}>
              Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Matches</h1>
        <p className="text-muted-foreground mt-1">Manage your match requests and connected people.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="incoming">
            Incoming {incoming.length > 0 && <Badge className="ml-1.5 h-5 min-w-5 px-1">{incoming.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="accepted">
            <Users className="h-3.5 w-3.5 mr-1.5" /> Matches ({accepted.length})
          </TabsTrigger>
          <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-3 mt-4">
          {incoming.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No incoming requests right now.</p>
          ) : (
            incoming.map((m) => <MatchCard key={m.id} match={m} />)
          )}
        </TabsContent>

        <TabsContent value="accepted" className="space-y-3 mt-4">
          {accepted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No matches yet.</p>
              <Button size="sm" variant="outline" className="mt-3" nativeButton={false} render={<Link href="/browse" />}>
                Browse skills
              </Button>
            </div>
          ) : (
            accepted.map((m) => <MatchCard key={m.id} match={m} />)
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3 mt-4">
          {sent.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No pending requests sent.</p>
          ) : (
            sent.map((m) => <MatchCard key={m.id} match={m} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Unmatch confirmation dialog */}
      <Dialog open={!!unmatchTarget} onOpenChange={(o) => { if (!o) setUnmatchTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect from {unmatchTargetUser?.name ?? 'this user'}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              This will end your match connection. Your chat history will be preserved but you'll both be removed from each other's matches list.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setUnmatchTarget(null)}
                disabled={unmatching}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmUnmatch}
                disabled={unmatching}
              >
                {unmatching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Disconnect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
