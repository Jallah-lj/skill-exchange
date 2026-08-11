'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Eye, Heart, MessageCircle, Bookmark, TrendingUp, TrendingDown, Minus, PenSquare, Building2 } from 'lucide-react'
import type { OrganizationPost, Organization } from '@/lib/types'

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

function PostStatsRow({ postId }: { postId: string }) {
  const supabase = createClient()
  const [stats, setStats] = useState<EngagementStats | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      const [{ data: likes }, { data: commentRows }, { count: bookmarks }, { data: views }] = await Promise.all([
        supabase.from('post_likes').select('created_at').eq('post_id', postId),
        supabase.from('post_comments').select('created_at').eq('post_id', postId),
        supabase.from('post_bookmarks').select('id', { count: 'exact', head: true }).eq('post_id', postId),
        supabase.from('post_views').select('created_at').eq('post_id', postId),
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
  }, [postId])

  if (!stats) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-muted/20 px-4 py-3">
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
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-semibold">{stats.comments}</span>
        <GrowthBadge current={stats.commentsLast7} previous={stats.commentsPrev7} label="Comments" />
      </div>
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold">{stats.bookmarks}</span>
        <span className="text-xs text-muted-foreground">saves</span>
      </div>
    </div>
  )
}

type MyPost = OrganizationPost & { organization?: Organization | null }

export function MyPostsSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [posts, setPosts] = useState<MyPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('organization_posts')
        .select('*, organization:organizations(*)')
        .eq('author_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) console.error('Failed to load your posts:', error.message, error.code)
      setPosts((data as MyPost[]) ?? [])
      setLoading(false)
    }
    load()
  }, [userId, supabase])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenSquare className="h-4 w-4 text-violet-500" />
          Your posts
          {!loading && <span className="ml-auto text-xs font-normal text-muted-foreground">{posts.length} total</span>}
        </CardTitle>
        <CardDescription>Views, likes, comments, and saves for everything you've posted.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">You haven't posted anything yet.</p>
            <Link href="/home" className="text-sm text-violet-600 hover:underline dark:text-violet-400">
              Share something on the community feed →
            </Link>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize text-[10px] px-1.5 h-5">{post.category.replace('_', ' ')}</Badge>
                    {post.organization && (
                      <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 h-5">
                        <Building2 className="h-2.5 w-2.5" /> {post.organization.name}
                      </Badge>
                    )}
                  </div>
                  <Link href={`/posts/${post.id}`} className="font-semibold hover:underline line-clamp-1">
                    {post.title || post.content || 'Untitled post'}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Posted {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <PostStatsRow postId={post.id} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
