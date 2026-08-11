'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ArrowLeft, FileQuestion } from 'lucide-react'
import { PostCard } from '@/components/post-card'
import type { OrganizationPost, Profile, Organization } from '@/lib/types'

type EnrichedPost = OrganizationPost & {
  author?: Profile | null
  organization?: Organization | null
  is_liked_by_user?: boolean
  is_bookmarked_by_user?: boolean
  post_likes?: Array<{ count: number }>
  post_bookmarks?: Array<{ count: number }>
  post_comments?: Array<{ count: number }>
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [post, setPost] = useState<EnrichedPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = async () => {
    let { data, error } = await supabase
      .from('organization_posts')
      .select('*, organization:organizations(*), author:profiles!organization_posts_author_id_fkey(*), post_likes(count), post_bookmarks(count), post_comments(count)')
      .eq('id', id)
      .eq('is_published', true)
      .is('deleted_at', null)
      .maybeSingle()

    // Fall back without engagement aggregates if those tables are missing
    if (error) {
      ({ data } = await supabase
        .from('organization_posts')
        .select('*, organization:organizations(*), author:profiles!organization_posts_author_id_fkey(*)')
        .eq('id', id)
        .eq('is_published', true)
        .is('deleted_at', null)
        .maybeSingle())
    }

    if (!data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let enriched = data as EnrichedPost
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [{ data: myLike }, { data: myBookmark }] = await Promise.all([
        supabase.from('post_likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
        supabase.from('post_bookmarks').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
      ])
      enriched = { ...enriched, is_liked_by_user: !!myLike, is_bookmarked_by_user: !!myBookmark }

      // Landing on the permalink counts as a unique view
      void supabase.from('post_views').upsert(
        { post_id: id, user_id: user.id },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true }
      )
    }

    setPost(enriched)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center space-y-4">
          <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground opacity-40" />
          <div>
            <p className="font-semibold">Post not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or unpublished.</p>
          </div>
          <Button variant="outline" className="gap-2" nativeButton={false} render={<Link href="/browse" />}>
            <ArrowLeft className="h-4 w-4" /> Back to Discover
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <PostCard post={post} onLikeChange={load} onDeleted={() => router.push('/browse')} />
    </div>
  )
}
