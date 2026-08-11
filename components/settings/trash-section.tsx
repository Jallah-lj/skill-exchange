'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Trash2, RotateCcw, XCircle, Loader2, FileText, MessageSquare } from 'lucide-react'

interface TrashedPost {
  id: string
  title: string
  content: string
  deleted_at: string
  organization_id: string | null
}
interface TrashedComment {
  id: string
  content: string
  deleted_at: string
  post_id: string
}

const RETENTION_DAYS = 30

function daysLeft(deletedAt: string) {
  const purgeAt = new Date(deletedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function TrashSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [posts, setPosts] = useState<TrashedPost[]>([])
  const [comments, setComments] = useState<TrashedComment[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Best-effort: permanently clear anything past the 30-day window before
    // rendering, so the list a user sees always reflects the real retention
    // rule (works even without a server-side cron job configured).
    await supabase.rpc('purge_expired_trash')

    const [{ data: p }, { data: c }] = await Promise.all([
      supabase
        .from('organization_posts')
        .select('id, title, content, deleted_at, organization_id')
        .eq('author_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('post_comments')
        .select('id, content, deleted_at, post_id')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ])
    setPosts((p as TrashedPost[]) ?? [])
    setComments((c as TrashedComment[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const restorePost = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('organization_posts').update({ deleted_at: null }).eq('id', id)
    if (error) toast.error('Failed to restore post')
    else { toast.success('Post restored'); setPosts((prev) => prev.filter((p) => p.id !== id)) }
    setBusyId(null)
  }

  const purgePost = async (id: string) => {
    if (!confirm('Permanently delete this post? This cannot be undone.')) return
    setBusyId(id)
    const { error } = await supabase.from('organization_posts').delete().eq('id', id)
    if (error) toast.error('Failed to delete post')
    else { toast.success('Post permanently deleted'); setPosts((prev) => prev.filter((p) => p.id !== id)) }
    setBusyId(null)
  }

  const restoreComment = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('post_comments').update({ deleted_at: null }).eq('id', id)
    if (error) toast.error('Failed to restore comment')
    else { toast.success('Comment restored'); setComments((prev) => prev.filter((c) => c.id !== id)) }
    setBusyId(null)
  }

  const purgeComment = async (id: string) => {
    if (!confirm('Permanently delete this comment? This cannot be undone.')) return
    setBusyId(id)
    const { error } = await supabase.from('post_comments').delete().eq('id', id)
    if (error) toast.error('Failed to delete comment')
    else { toast.success('Comment permanently deleted'); setComments((prev) => prev.filter((c) => c.id !== id)) }
    setBusyId(null)
  }

  const total = posts.length + comments.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Trash
        </CardTitle>
        <CardDescription>
          Deleted posts and comments stay here for {RETENTION_DAYS} days before being permanently removed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trash2 className="h-7 w-7 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <Tabs defaultValue="posts">
            <TabsList>
              <TabsTrigger value="posts" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Posts ({posts.length})</TabsTrigger>
              <TabsTrigger value="comments" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comments ({comments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-4 space-y-2.5">
              {posts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No deleted posts.</p>
              ) : (
                posts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.title || 'Untitled post'}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{p.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Deleted {new Date(p.deleted_at).toLocaleDateString()} · {daysLeft(p.deleted_at)} days left
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === p.id} onClick={() => restorePost(p.id)}>
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" disabled={busyId === p.id} onClick={() => purgePost(p.id)}>
                        <XCircle className="h-3 w-3" /> Delete forever
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="comments" className="mt-4 space-y-2.5">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No deleted comments.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{c.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Deleted {new Date(c.deleted_at).toLocaleDateString()} · {daysLeft(c.deleted_at)} days left
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busyId === c.id} onClick={() => restoreComment(c.id)}>
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" disabled={busyId === c.id} onClick={() => purgeComment(c.id)}>
                        <XCircle className="h-3 w-3" /> Delete forever
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
