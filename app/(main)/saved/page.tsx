'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/post-card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { OrganizationPost, Profile, Organization } from '@/lib/types'

type SavedPost = OrganizationPost & {
  author?: Profile | null
  organization?: Organization | null
  is_bookmarked_by_user?: boolean
}

export default function SavedPostsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSaved = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const response = await fetch('/api/posts/saved')
        if (!response.ok) throw new Error('Failed to fetch saved posts')
        const { posts: savedPosts } = await response.json()
        setPosts(savedPosts ?? [])
      } catch (error) {
        toast.error('Failed to load saved posts')
      } finally {
        setLoading(false)
      }
    }

    loadSaved()
  }, [router, supabase])

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-2'>Saved Posts</h1>
        <p className='text-muted-foreground'>Posts you bookmarked for later</p>
      </div>

      <div className='max-w-2xl mx-auto'>
        {loading ? (
          <div className='space-y-4'>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className='h-80 w-full' />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className='rounded-xl border border-dashed p-10 text-center'>
            <p className='text-sm text-muted-foreground'>You haven't saved any posts yet.</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onBookmarkChange={(bookmarked) => {
                  if (!bookmarked) {
                    setPosts((prev) => prev.filter((item) => item.id !== post.id))
                  }
                }}
                onDeleted={() => setPosts((prev) => prev.filter((item) => item.id !== post.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
