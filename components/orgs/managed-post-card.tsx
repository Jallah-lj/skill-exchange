'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Trash2, Pencil, Heart, MessageCircle, Bookmark, TrendingUp, TrendingDown, Minus, Pin } from 'lucide-react'
import type { OrganizationPost, PostComment } from '@/lib/types'
import { PostImageUpload } from '@/components/orgs/post-image-upload'
import { MentionTextarea } from '@/components/mention-textarea'
import { Linkify } from '@/components/linkify'
import { newMentionHandles, notifyMentions } from '@/lib/mentions'

const CATEGORIES = ['opportunity', 'news', 'project', 'help_wanted', 'event'] as const

interface EngagementStats {
  likes: number
  comments: number
  bookmarks: number
  views: number
  likesLast7: number
  likesPrev7: number
  commentsLast7: number
  commentsPrev7: number
  viewsLast7: number
  viewsPrev7: number
}

interface ManagedPostCardProps {
  post: OrganizationPost
  orgName: string
  orgAvatarUrl: string | null
  onUpdated: (post: OrganizationPost) => void
  onTogglePublish: () => void
  onDelete: () => void
}

function GrowthBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = current - previous
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const color = diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-red-500' : 'text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`} title={`${label}: ${current} this week vs ${previous} last week`}>
      <Icon className="h-3 w-3" /> {diff > 0 ? `+${diff}` : diff} this week
    </span>
  )
}

export function ManagedPostCard({ post, orgName, orgAvatarUrl, onUpdated, onTogglePublish, onDelete }: ManagedPostCardProps) {
  const supabase = createClient()

  const [stats, setStats] = useState<EngagementStats | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [title, setTitle] = useState(post.title ?? '')
  const [content, setContent] = useState(post.content ?? '')
  const [category, setCategory] = useState<OrganizationPost['category']>(post.category)
  const [imageUrl, setImageUrl] = useState(post.image_url ?? '')
  const [saving, setSaving] = useState(false)

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [replyTo, setReplyTo] = useState<PostComment | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    const loadStats = async () => {
      const [{ data: likes }, { data: commentRows }, { count: bookmarks }, { data: views }] = await Promise.all([
        supabase.from('post_likes').select('created_at').eq('post_id', post.id),
        supabase.from('post_comments').select('created_at').eq('post_id', post.id).is('deleted_at', null),
        supabase.from('post_bookmarks').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('post_views').select('created_at').eq('post_id', post.id),
      ])
      const now = Date.now()
      const week = 7 * 86_400_000
      const inWindow = (rows: { created_at: string }[] | null, from: number, to: number) =>
        (rows ?? []).filter((r) => {
          const t = new Date(r.created_at).getTime()
          return t >= from && t < to
        }).length

      setStats({
        likes: likes?.length ?? 0,
        comments: commentRows?.length ?? 0,
        bookmarks: bookmarks ?? 0,
        views: views?.length ?? 0,
        likesLast7: inWindow(likes, now - week, now + 1),
        likesPrev7: inWindow(likes, now - 2 * week, now - week),
        commentsLast7: inWindow(commentRows, now - week, now + 1),
        commentsPrev7: inWindow(commentRows, now - 2 * week, now - week),
        viewsLast7: inWindow(views, now - week, now + 1),
        viewsPrev7: inWindow(views, now - 2 * week, now - week),
      })
    }
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  const saveEdit = async () => {
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle && !trimmedContent && !imageUrl) {
      toast.error('Add a title, some content, or a photo')
      return
    }
    setSaving(true)
    const patch = {
      title: trimmedTitle || null,
      content: trimmedContent || null,
      category,
      image_url: imageUrl || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('organization_posts').update(patch).eq('id', post.id)
    if (error) toast.error(error.message || 'Failed to save post')
    else {
      const added = newMentionHandles(`${post.title ?? ''} ${post.content ?? ''}`, `${patch.title ?? ''} ${patch.content ?? ''}`)
      onUpdated({ ...post, ...patch })
      setEditOpen(false)
      toast.success('Post updated')
      if (added.length) {
        const { data: { user } } = await supabase.auth.getUser()
        void notifyMentions(supabase, {
          text: added.map((h) => `@${h}`).join(' '),
          actorName: orgName,
          title: `${orgName} mentioned you in a post`,
          href: `/posts/${post.id}`,
          excludeUserId: user?.id,
        })
      }
    }
    setSaving(false)
  }

  const openComments = async () => {
    setCommentsOpen(true)
    setLoadingComments(true)
    const { data } = await supabase
      .from('post_comments')
      .select('*, user:profiles!post_comments_user_id_fkey(*)')
      .eq('post_id', post.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setComments((data as unknown as PostComment[]) ?? [])
    setLoadingComments(false)
  }

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Failed to delete comment'); return }
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id))
    setStats((prev) => prev ? { ...prev, comments: prev.comments - 1 } : prev)
    toast.success('Comment moved to Trash')
  }

  const togglePin = async (comment: PostComment) => {
    const next = !comment.is_pinned
    const { error } = await supabase.from('post_comments').update({ is_pinned: next }).eq('id', comment.id)
    if (error) { toast.error('Failed to update pin'); return }
    setComments((prev) => prev.map((c) => c.id === comment.id ? { ...c, is_pinned: next } : c))
    toast.success(next ? 'Comment pinned' : 'Comment unpinned')
  }

  const childrenOf = (id: string) =>
    comments.filter((c) => c.parent_id === id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const renderThread = (item: PostComment, depth: number): React.ReactNode => {
    const asOrg = item.as_organization
    const displayName = asOrg ? orgName : (item.user?.name ?? 'Unknown')
    const displayAvatar = asOrg ? (orgAvatarUrl ?? '') : (item.user?.avatar_url ?? '')
    return (
      <div key={item.id} className="space-y-2">
        <div
          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${depth > 0 ? 'bg-muted/20' : ''} ${item.is_pinned ? 'border-violet-300 dark:border-violet-800' : ''}`}
          style={depth > 0 ? { marginLeft: Math.min(depth, 4) * 24 } : undefined}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={displayAvatar} />
            <AvatarFallback className="text-xs font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">
              {displayName}
              {asOrg && (
                <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  Organization
                </span>
              )}
              <span className="ml-2 font-normal text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              {item.is_pinned && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm"><Linkify text={item.content} /></p>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReplyTo(item)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-3 w-3" /> Reply
              </button>
              {depth === 0 && (
                <button
                  type="button"
                  onClick={() => togglePin(item)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-500"
                >
                  <Pin className="h-3 w-3" /> {item.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Delete comment"
            onClick={() => deleteComment(item.id)}
            className="shrink-0 text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {childrenOf(item.id).map((child) => renderThread(child, depth + 1))}
      </div>
    )
  }

  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return
    setReplying(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setReplying(false); return }
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: replyText.trim(),
        parent_id: replyTo.id,
        as_organization: true,
      })
      .select('*, user:profiles!post_comments_user_id_fkey(*)')
      .single()
    if (error) toast.error(error.message || 'Failed to send reply')
    else {
      setComments((prev) => [data as unknown as PostComment, ...prev])
      setStats((prev) => prev ? { ...prev, comments: prev.comments + 1 } : prev)
      setReplyTo(null)
      setReplyText('')
      toast.success('Reply posted')
      void notifyMentions(supabase, {
        text: replyText,
        actorName: orgName,
        title: `${orgName} mentioned you in a comment`,
        href: `/posts/${post.id}`,
        excludeUserId: user.id,
      })
    }
    setReplying(false)
  }

  return (
    <Card className="border-0 ring-1 ring-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize text-[10px] px-1.5 h-5">{post.category.replace('_', ' ')}</Badge>
              {post.title && <CardTitle className="text-base">{post.title}</CardTitle>}
            </div>
            <CardDescription className="text-xs">
              Posted {new Date(post.created_at).toLocaleDateString()} by {orgName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 gap-1.5 text-xs ${post.is_published ? 'text-emerald-600' : 'text-amber-600'}`}
              onClick={onTogglePublish}
            >
              {post.is_published ? <><Eye className="h-3.5 w-3.5" /> Published</> : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete post"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.content && (
          <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{post.content}</p>
        )}

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_url} alt="" className="max-h-40 rounded-lg border object-cover" />
        )}

        {/* Engagement analytics */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/20 px-4 py-3">
          {stats ? (
            <>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{stats.views}</span>
                <GrowthBadge current={stats.viewsLast7} previous={stats.viewsPrev7} label="Views" />
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold">{stats.likes}</span>
                <GrowthBadge current={stats.likesLast7} previous={stats.likesPrev7} label="Likes" />
              </div>
              <button type="button" onClick={openComments} className="flex items-center gap-2 hover:opacity-80">
                <MessageCircle className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold">{stats.comments}</span>
                <GrowthBadge current={stats.commentsLast7} previous={stats.commentsPrev7} label="Comments" />
              </button>
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold">{stats.bookmarks}</span>
                <span className="text-xs text-muted-foreground">saves</span>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={openComments}>
                View comments
              </Button>
            </>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) setCategory(v as OrganizationPost['category']) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Content</Label>
              <MentionTextarea rows={6} value={content} onChange={setContent} />
            </div>
            <div className="grid gap-1.5">
              <Label>Photo</Label>
              <PostImageUpload imageUrl={imageUrl} onChange={setImageUrl} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !title.trim() || !content.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments dialog */}
      <Dialog open={commentsOpen} onOpenChange={(v) => { setCommentsOpen(v); if (!v) { setReplyTo(null); setReplyText('') } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comments on "{post.title || 'this post'}"</DialogTitle>
          </DialogHeader>
          {loadingComments ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {comments
                .filter((c) => !c.parent_id)
                .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((c) => renderThread(c, 0))}
            </div>
          )}

          {/* Org reply composer */}
          {replyTo && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                <span>Replying as <span className="font-medium text-foreground">{orgName}</span> to <span className="font-medium text-foreground">{replyTo.as_organization ? orgName : replyTo.user?.name ?? 'comment'}</span></span>
                <button type="button" onClick={() => setReplyTo(null)} className="hover:text-foreground">Cancel</button>
              </div>
              <MentionTextarea
                value={replyText}
                onChange={setReplyText}
                placeholder="Write your reply... use @ to mention someone"
                rows={2}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={sendReply} disabled={replying || !replyText.trim()} className="gap-2">
                  {replying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Post reply
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
