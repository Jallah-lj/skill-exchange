'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Loader2,
  Pencil, Trash2, Pin, Reply, Copy, Building2, Send, Check,
} from 'lucide-react'
import type { OrganizationPost, Profile, Organization, PostComment } from '@/lib/types'
import { Linkify } from '@/components/linkify'
import { PostImagesUpload } from '@/components/post-images-upload'
import { MentionTextarea } from '@/components/mention-textarea'
import { newMentionHandles, notifyMentions } from '@/lib/mentions'
import { PostImageCarousel } from '@/components/post-image-carousel'
import { ImageLightbox } from '@/components/image-lightbox'
import { type Visibility, VISIBILITY_OPTIONS, VISIBILITY_META } from '@/lib/post-visibility'

const TEXTAREA_CLASSNAME =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const EDIT_CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'project', label: 'Project' },
  { value: 'help_wanted', label: 'Help Wanted' },
  { value: 'event', label: 'Event' },
] as const

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: diffDays >= 365 ? 'numeric' : undefined,
  })
}

interface PostCardProps {
  post: OrganizationPost & {
    author?: Profile | null
    organization?: Organization | null
    is_liked_by_user?: boolean
    is_bookmarked_by_user?: boolean
    post_likes?: Array<{ count: number }>
    post_bookmarks?: Array<{ count: number }>
    post_comments?: Array<{ count: number }>
  }
  onLikeChange?: () => void
  onBookmarkChange?: (bookmarked: boolean) => void
  onDeleted?: () => void
}

export function PostCard({ post, onLikeChange, onBookmarkChange, onDeleted }: PostCardProps) {
  const supabase = createClient()

  const [isLiking, setIsLiking] = useState(false)
  const [isBookmarking, setIsBookmarking] = useState(false)
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false)
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked_by_user || false)
  const [viewOpen, setViewOpen] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Viewer context (loaded when the dialog opens)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [viewerIsManager, setViewerIsManager] = useState(false)
  const [isAuthor, setIsAuthor] = useState(false)

  // Editable post fields (local overrides so edits show immediately)
  const [displayTitle, setDisplayTitle] = useState(post.title)
  const [displayContent, setDisplayContent] = useState(post.content)
  const [displayCategory, setDisplayCategory] = useState(post.category)
  const [displayVisibility, setDisplayVisibility] = useState<Visibility>(post.visibility ?? 'public')
  const [images, setImages] = useState<string[]>(
    post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : [])
  )
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(post.title ?? '')
  const [editContent, setEditContent] = useState(post.content ?? '')
  const [editCategory, setEditCategory] = useState(post.category)
  const [editImages, setEditImages] = useState<string[]>(images)
  const [editVisibility, setEditVisibility] = useState<Visibility>(post.visibility ?? 'public')
  const [connections, setConnections] = useState<Profile[]>([])
  const [editAudience, setEditAudience] = useState<Set<string>>(new Set())
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthor(!!user && user.id === post.author_id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Comment interaction state
  const [replyTo, setReplyTo] = useState<PostComment | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [postAsOrg, setPostAsOrg] = useState(false)

  const likeCount = post.post_likes?.[0]?.count || 0
  const commentCount = post.post_comments?.[0]?.count || 0

  const handleLike = async () => {
    setIsLiking(true)
    try {
      const response = await fetch('/api/posts/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, action: 'like' }),
      })
      if (!response.ok) throw new Error('Failed to like post')
      setIsLiked(!isLiked)
      onLikeChange?.()
    } catch {
      toast.error('Failed to update like')
    } finally {
      setIsLiking(false)
    }
  }

  const handleBookmark = async () => {
    setIsBookmarking(true)
    try {
      const response = await fetch('/api/posts/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, action: 'bookmark' }),
      })
      if (!response.ok) throw new Error('Failed to bookmark post')
      const nextBookmarked = !isBookmarked
      setIsBookmarked(nextBookmarked)
      onBookmarkChange?.(nextBookmarked)
      toast.success(nextBookmarked ? 'Post saved' : 'Post removed from saved')
    } catch {
      toast.error('Failed to update bookmark')
    } finally {
      setIsBookmarking(false)
    }
  }

  const loadComments = async () => {
    setLoadingComments(true)
    try {
      const response = await fetch(`/api/posts/comments?postId=${post.id}`)
      if (!response.ok) throw new Error('Failed to load comments')
      const { comments: nextComments } = await response.json()
      setComments(nextComments ?? [])
    } catch {
      toast.error('Failed to load comments')
    } finally {
      setLoadingComments(false)
    }
  }

  const handleViewOpen = (open: boolean) => {
    setViewOpen(open)
    if (open) {
      void loadComments()
      void (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setViewerId(user?.id ?? null)
        if (user) {
          // Count a unique view per user; duplicate opens are ignored.
          // Fire-and-forget — swallow failures (offline, table missing).
          supabase.from('post_views').upsert(
            { post_id: post.id, user_id: user.id },
            { onConflict: 'post_id,user_id', ignoreDuplicates: true }
          ).then(() => {}, () => {})
        }
        if (user && post.organization?.id) {
          const { data } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', post.organization.id)
            .eq('user_id', user.id)
            .maybeSingle()
          setViewerIsManager(['owner', 'admin', 'moderator'].includes(data?.role ?? ''))
        }
      })()
    } else {
      setReplyTo(null)
      setEditingId(null)
    }
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const response = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, content: commentText, parentId: replyTo?.id ?? null, asOrganization: postAsOrg }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to post comment')
      }
      setCommentText('')
      setReplyTo(null)
      await loadComments()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to post comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const saveCommentEdit = async (comment: PostComment) => {
    if (!editText.trim()) return
    setBusyCommentId(comment.id)
    const nextContent = editText.trim()
    const { error } = await supabase
      .from('post_comments')
      .update({ content: nextContent, updated_at: new Date().toISOString() })
      .eq('id', comment.id)
    if (error) toast.error('Failed to edit comment')
    else {
      setComments((prev) => prev.map((c) => c.id === comment.id
        ? { ...c, content: nextContent, updated_at: new Date().toISOString() }
        : c))
      setEditingId(null)
      const added = newMentionHandles(comment.content, nextContent)
      if (added.length && viewerId) {
        const { data: me } = await supabase.from('profiles').select('name').eq('id', viewerId).single()
        void notifyMentions(supabase, {
          text: added.map((h) => `@${h}`).join(' '),
          actorName: me?.name ?? 'Someone',
          title: `${me?.name ?? 'Someone'} mentioned you in a comment`,
          href: `/posts/${post.id}`,
          excludeUserId: viewerId,
        })
      }
    }
    setBusyCommentId(null)
  }

  const deleteComment = async (comment: PostComment) => {
    setBusyCommentId(comment.id)
    const { error } = await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', comment.id)
    if (error) toast.error('Failed to delete comment')
    else setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parent_id !== comment.id))
    setBusyCommentId(null)
  }

  const togglePin = async (comment: PostComment) => {
    setBusyCommentId(comment.id)
    const next = !comment.is_pinned
    const { error } = await supabase.from('post_comments').update({ is_pinned: next }).eq('id', comment.id)
    if (error) toast.error('Failed to update pin')
    else {
      setComments((prev) => prev.map((c) => c.id === comment.id ? { ...c, is_pinned: next } : c))
      toast.success(next ? 'Comment pinned' : 'Comment unpinned')
    }
    setBusyCommentId(null)
  }

  const postUrl = () => `${window.location.origin}/posts/${post.id}`

  const copyPostLink = () => {
    navigator.clipboard.writeText(postUrl())
    toast.success('Post link copied to clipboard')
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: displayTitle ?? '', text: displayContent ?? '', url: postUrl() })
    } else {
      copyPostLink()
    }
  }

  const isPersonalPost = !post.organization_id

  const openEdit = () => {
    setEditTitle(displayTitle ?? '')
    setEditContent(displayContent ?? '')
    setEditCategory(displayCategory)
    setEditImages(images)
    setEditVisibility(displayVisibility)
    setEditOpen(true)
    if (isPersonalPost) void loadConnectionsAndAudience()
  }

  const loadConnectionsAndAudience = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: matchRows }, { data: audienceRows }] = await Promise.all([
      supabase.from('match_requests')
        .select('from_user_id, to_user_id, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
        .eq('status', 'accepted')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
      supabase.from('post_audience').select('user_id').eq('post_id', post.id),
    ])
    const conns = (matchRows ?? [])
      .map((m: any) => (m.from_user_id === user.id ? m.to_profile : m.from_profile))
      .filter(Boolean) as Profile[]
    setConnections(conns)
    setEditAudience(new Set((audienceRows ?? []).map((r: any) => r.user_id as string)))
  }

  const toggleEditAudienceMember = (userId: string) => {
    setEditAudience((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const saveEdit = async () => {
    const trimmedTitle = editTitle.trim()
    const trimmedContent = editContent.trim()
    if (!trimmedTitle && !trimmedContent && editImages.length === 0) {
      toast.error('Add a title, some content, or a photo')
      return
    }
    const effectiveVisibility: Visibility = isPersonalPost ? editVisibility : 'public'
    if (effectiveVisibility === 'specific' && editAudience.size === 0) {
      toast.error('Pick at least one person to share this with')
      return
    }
    setSavingEdit(true)
    const patch = {
      title: trimmedTitle || null,
      content: trimmedContent || null,
      category: editCategory,
      image_url: editImages[0] ?? null,
      image_urls: editImages,
      visibility: effectiveVisibility,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('organization_posts').update(patch).eq('id', post.id)
    if (error) {
      toast.error(error.message || 'Failed to update post')
    } else {
      if (isPersonalPost) {
        // Simplest correct way to keep the audience list in sync with the picker.
        await supabase.from('post_audience').delete().eq('post_id', post.id)
        if (effectiveVisibility === 'specific' && editAudience.size > 0) {
          await supabase.from('post_audience').insert(
            [...editAudience].map((userId) => ({ post_id: post.id, user_id: userId }))
          )
        }
      }
      const added = newMentionHandles(`${displayTitle} ${displayContent}`, `${patch.title} ${patch.content}`)
      setDisplayTitle(patch.title)
      setDisplayContent(patch.content)
      setDisplayCategory(patch.category)
      setDisplayVisibility(patch.visibility)
      setImages(editImages)
      setEditOpen(false)
      toast.success('Post updated')
      if (added.length) {
        void notifyMentions(supabase, {
          text: added.map((h) => `@${h}`).join(' '),
          actorName: post.author?.name ?? 'Someone',
          title: `${post.author?.name ?? 'Someone'} mentioned you in a post`,
          href: `/posts/${post.id}`,
          excludeUserId: post.author_id ?? undefined,
        })
      }
    }
    setSavingEdit(false)
  }

  const deletePost = async () => {
    if (!confirm('Move this post to Trash? You can restore it from Settings within 30 days.')) return
    setDeleting(true)
    const { error } = await supabase.from('organization_posts').update({ deleted_at: new Date().toISOString() }).eq('id', post.id)
    if (error) {
      toast.error(error.message || 'Failed to delete post')
      setDeleting(false)
    } else {
      toast.success('Post moved to Trash')
      onDeleted?.()
    }
  }

  const categoryColors: Record<string, string> = {
    opportunity: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    news: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    project: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    help_wanted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    event: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  }
  const categoryLabel = displayCategory === 'help_wanted'
    ? 'Help Wanted'
    : displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1)

  // Threaded comment tree: pinned roots first, then oldest → newest at every level
  const byOldest = (a: PostComment, b: PostComment) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  const roots = comments
    .filter((c) => !c.parent_id)
    .sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned) || byOldest(a, b))
  const childrenOf = (id: string) => comments.filter((c) => c.parent_id === id).sort(byOldest)

  const renderComment = (comment: PostComment, depth: number) => {
    const own = viewerId === comment.user_id
    const busy = busyCommentId === comment.id
    const asOrg = comment.as_organization && post.organization
    const displayName = asOrg ? post.organization!.name : (comment.user?.name || 'Anonymous')
    const displayAvatar = asOrg ? (post.organization!.avatar_url || '') : (comment.user?.avatar_url || '')
    return (
      <div
        key={comment.id}
        className={`flex gap-3 rounded-lg border p-3 ${depth > 0 ? 'bg-muted/20' : ''} ${comment.is_pinned ? 'border-violet-300 dark:border-violet-800' : ''}`}
        style={depth > 0 ? { marginLeft: Math.min(depth, 4) * 24 } : undefined}
      >
        <Avatar className='h-8 w-8 shrink-0'>
          <AvatarImage src={displayAvatar} alt={displayName} />
          <AvatarFallback>{displayName[0] || '?'}</AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2 text-sm'>
            <span className='font-medium'>{displayName}</span>
            {asOrg && (
              <Badge variant='secondary' className='h-5 gap-1 px-1.5 text-[10px] text-violet-700 dark:text-violet-300'>
                <Building2 className='h-2.5 w-2.5' /> Organization
              </Badge>
            )}
            <span className='text-muted-foreground text-xs'>{timeAgo(comment.created_at)}</span>
            {comment.updated_at && <span className='text-muted-foreground text-xs'>(edited)</span>}
            {comment.is_pinned && (
              <Badge variant='secondary' className='h-5 gap-1 px-1.5 text-[10px] text-violet-700 dark:text-violet-300'>
                <Pin className='h-2.5 w-2.5' /> Pinned
              </Badge>
            )}
          </div>

          {editingId === comment.id ? (
            <div className='mt-2 space-y-2'>
              <MentionTextarea
                value={editText}
                onChange={setEditText}
                rows={2}
              />
              <div className='flex gap-2'>
                <Button size='xs' onClick={() => saveCommentEdit(comment)} disabled={busy || !editText.trim()}>
                  {busy ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Save'}
                </Button>
                <Button size='xs' variant='ghost' onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className='text-sm text-foreground/90 mt-1 whitespace-pre-wrap'>
              <Linkify text={comment.content} />
            </p>
          )}

          {/* Comment actions — every comment can be replied to */}
          {editingId !== comment.id && (
            <div className='mt-1.5 flex flex-wrap items-center gap-3'>
              {viewerId && (
                <button
                  type='button'
                  onClick={() => { setReplyTo(comment); setEditingId(null) }}
                  className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                >
                  <Reply className='h-3 w-3' /> Reply
                </button>
              )}
              {(own || viewerIsManager) && (
                <button
                  type='button'
                  onClick={() => { setEditingId(comment.id); setEditText(comment.content); setReplyTo(null) }}
                  className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
                >
                  <Pencil className='h-3 w-3' /> Edit
                </button>
              )}
              {(own || viewerIsManager) && (
                <button
                  type='button'
                  onClick={() => deleteComment(comment)}
                  disabled={busy}
                  className='flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500'
                >
                  <Trash2 className='h-3 w-3' /> Delete
                </button>
              )}
              {viewerIsManager && depth === 0 && (
                <button
                  type='button'
                  onClick={() => togglePin(comment)}
                  disabled={busy}
                  className='flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-500'
                >
                  <Pin className='h-3 w-3' /> {comment.is_pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderThread = (comment: PostComment, depth = 0): React.ReactNode => (
    <div key={comment.id} className='space-y-2'>
      {renderComment(comment, depth)}
      {childrenOf(comment.id).map((child) => renderThread(child, depth + 1))}
    </div>
  )

  return (
    <>
    <Card className='mb-4 overflow-hidden hover:shadow-md transition-shadow'>
      {/* Header */}
      <div className='p-4 border-b border-gray-200 dark:border-gray-800'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3 flex-1'>
            <Avatar className='h-10 w-10'>
              <AvatarImage
                src={(post.organization ? post.organization.avatar_url : post.author?.avatar_url) || ''}
                alt={post.organization ? post.organization.name : post.author?.name}
              />
              <AvatarFallback>{(post.organization ? post.organization.name : post.author?.name)?.[0]}</AvatarFallback>
            </Avatar>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2'>
                <div>
                  {post.organization ? (
                    <Link href={`/orgs/${post.organization.slug}`} className='font-semibold hover:underline truncate'>
                      {post.organization.name}
                    </Link>
                  ) : post.author ? (
                    <Link href={`/profile/${post.author.id}`} className='font-semibold hover:underline truncate'>
                      {post.author.name}
                    </Link>
                  ) : (
                    <span className='font-semibold'>Unknown Author</span>
                  )}
                </div>
              </div>
              <p className='flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400'>
                {timeAgo(post.created_at)}
                {displayVisibility !== 'public' && (() => {
                  const { icon: VisIcon, label } = VISIBILITY_META[displayVisibility]
                  return (
                    <span className='inline-flex items-center gap-0.5 text-gray-400 dark:text-gray-500' title={label}>
                      · <VisIcon className='h-3 w-3' />
                    </span>
                  )
                })()}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className='h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors' aria-label='Post options'>
              <MoreHorizontal className='h-4 w-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => handleViewOpen(true)} className='cursor-pointer gap-2'>
                <MessageCircle className='h-4 w-4' /> View post & comments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyPostLink} className='cursor-pointer gap-2'>
                <Copy className='h-4 w-4' /> Copy post
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBookmark} className='cursor-pointer gap-2'>
                <Bookmark className='h-4 w-4' /> {isBookmarked ? 'Remove from saved' : 'Save post'}
              </DropdownMenuItem>
              {post.organization?.slug && (
                <DropdownMenuItem nativeButton={false} render={<Link href={`/orgs/${post.organization.slug}`} />} className='cursor-pointer gap-2'>
                  <Building2 className='h-4 w-4' /> View organization
                </DropdownMenuItem>
              )}
              {isAuthor && (
                <DropdownMenuItem onClick={openEdit} className='cursor-pointer gap-2'>
                  <Pencil className='h-4 w-4' /> Edit post
                </DropdownMenuItem>
              )}
              {isAuthor && (
                <DropdownMenuItem onClick={deletePost} disabled={deleting} className='cursor-pointer gap-2 text-red-600 focus:text-red-600'>
                  <Trash2 className='h-4 w-4' /> Delete post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content — click text to open the full view; images have their own carousel + lightbox */}
      <div className='p-4'>
        <div
          role='button'
          tabIndex={0}
          className='block w-full cursor-pointer text-left'
          onClick={() => handleViewOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewOpen(true) } }}
        >
          <div className='flex items-center gap-2 mb-3'>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${categoryColors[displayCategory]}`}>
              {categoryLabel}
            </span>
          </div>

          {displayTitle && <h3 className='text-lg font-semibold mb-2 line-clamp-2'>{displayTitle}</h3>}
          {displayContent && (
            <p className='text-gray-700 dark:text-gray-300 text-sm mb-3 line-clamp-3 whitespace-pre-wrap'>
              <Linkify text={displayContent} />
            </p>
          )}
        </div>

        {images.length > 0 && (
          <div className='mb-1'>
            <PostImageCarousel images={images} alt={displayTitle ?? ''} onImageClick={setLightboxIndex} />
          </div>
        )}
      </div>

      {/* Stats */}
      {(likeCount > 0 || commentCount > 0) && (
        <div className='px-4 py-2 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 flex gap-4'>
          {likeCount > 0 && <span>{likeCount} like{likeCount !== 1 ? 's' : ''}</span>}
          {commentCount > 0 && (
            <button type='button' className='hover:underline' onClick={() => handleViewOpen(true)}>
              {commentCount} comment{commentCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className='px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex gap-2'>
        <Button
          variant='ghost'
          size='sm'
          className={`flex-1 gap-2 ${isLiked ? 'text-red-600' : ''}`}
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart className='h-4 w-4' fill={isLiked ? 'currentColor' : 'none'} />
          Like
        </Button>
        <Button variant='ghost' size='sm' className='flex-1 gap-2' onClick={() => handleViewOpen(true)}>
          <MessageCircle className='h-4 w-4' />
          Comment
        </Button>
        <Button variant='ghost' size='sm' className='flex-1 gap-2' onClick={handleShare}>
          <Share2 className='h-4 w-4' />
          Share
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className={`flex-1 gap-2 ${isBookmarked ? 'text-blue-600' : ''}`}
          onClick={handleBookmark}
          disabled={isBookmarking}
        >
          <Bookmark className='h-4 w-4' fill={isBookmarked ? 'currentColor' : 'none'} />
          Save
        </Button>
      </div>

      {/* Full post view + discussion */}
      <Dialog open={viewOpen} onOpenChange={handleViewOpen}>
        <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='pr-8'>{displayTitle || 'Post'}</DialogTitle>
            <DialogDescription className='flex flex-wrap items-center gap-2'>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[displayCategory]}`}>
                {categoryLabel}
              </span>
              {post.organization?.name && <span>from {post.organization.name}</span>}
              <span>· {timeAgo(post.created_at)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {displayContent && (
              <p className='text-sm text-foreground/90 whitespace-pre-wrap'>
                <Linkify text={displayContent} />
              </p>
            )}

            {images.length > 0 && (
              <PostImageCarousel images={images} alt={displayTitle ?? ''} onImageClick={setLightboxIndex} size='large' />
            )}

            <div className='border-t pt-4 space-y-3'>
              <p className='text-sm font-semibold'>
                Comments {comments.length > 0 && `(${comments.length})`}
              </p>

              {loadingComments ? (
                <div className='flex justify-center py-6'><Loader2 className='h-5 w-5 animate-spin text-muted-foreground' /></div>
              ) : roots.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No comments yet. Be the first to reply.</p>
              ) : (
                <div className='space-y-3'>
                  {roots.map((comment) => renderThread(comment))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className='space-y-2 border-t pt-4'>
              {replyTo && (
                <div className='flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground'>
                  <span>
                    Replying to <span className='font-medium text-foreground'>
                      {replyTo.as_organization && post.organization ? post.organization.name : (replyTo.user?.name ?? 'comment')}
                    </span>
                  </span>
                  <button type='button' onClick={() => setReplyTo(null)} className='hover:text-foreground'>Cancel</button>
                </div>
              )}
              <MentionTextarea
                value={commentText}
                onChange={setCommentText}
                placeholder={replyTo ? 'Write a reply... use @ to mention someone' : 'Write a comment... use @ to mention someone'}
                rows={3}
              />
              <div className='flex items-center justify-between gap-3'>
                {viewerIsManager && post.organization ? (
                  <label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={postAsOrg}
                      onChange={(e) => setPostAsOrg(e.target.checked)}
                    />
                    Post as <span className='font-medium text-foreground'>{post.organization.name}</span>
                  </label>
                ) : <span />}
                <Button onClick={submitComment} disabled={submittingComment || !commentText.trim()} className='gap-2'>
                  {submittingComment ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                  {replyTo ? 'Post reply' : 'Post comment'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit post */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4'>
            <div className='grid gap-1.5'>
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={(v) => { if (v) setEditCategory(v as typeof editCategory) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} label={c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isPersonalPost && (
              <div className='grid gap-1.5'>
                <Label>Who can see this?</Label>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                  {VISIBILITY_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type='button'
                      onClick={() => setEditVisibility(value)}
                      title={description}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                        editVisibility === value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                      }`}
                    >
                      <Icon className='h-4 w-4' />
                      <span className='text-xs font-medium'>{label}</span>
                    </button>
                  ))}
                </div>

                {editVisibility === 'specific' && (
                  connections.length === 0 ? (
                    <p className='text-xs text-muted-foreground'>No connections to share with yet.</p>
                  ) : (
                    <div className='max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2'>
                      {connections.map((c) => {
                        const checked = editAudience.has(c.id)
                        return (
                          <button
                            key={c.id}
                            type='button'
                            onClick={() => toggleEditAudienceMember(c.id)}
                            className={`flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-muted ${checked ? 'bg-muted' : ''}`}
                          >
                            <Avatar className='h-6 w-6 shrink-0'>
                              <AvatarImage src={c.avatar_url ?? ''} />
                              <AvatarFallback className='text-[10px]'>{c.name?.slice(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                            </Avatar>
                            <span className='min-w-0 flex-1 truncate'>{c.name}</span>
                            {checked && <Check className='h-3.5 w-3.5 shrink-0 text-primary' />}
                          </button>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )}

            <div className='grid gap-1.5'>
              <Label>Content</Label>
              <MentionTextarea rows={6} value={editContent} onChange={setEditContent} className={TEXTAREA_CLASSNAME} />
            </div>
            <div className='grid gap-1.5'>
              <Label>Photos</Label>
              <PostImagesUpload imageUrls={editImages} onChange={setEditImages} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditOpen(false)} disabled={savingEdit}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

    {images.length > 0 && (
      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        alt={displayTitle ?? ''}
        open={lightboxIndex !== null}
        onOpenChange={(open) => { if (!open) setLightboxIndex(null) }}
      />
    )}
    </>
  )
}
