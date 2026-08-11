'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { PostCard } from '@/components/post-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingCategories, type PostCategory } from '@/components/home/trending-categories'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { OrganizationPost, Profile, Organization } from '@/lib/types'

type Post = OrganizationPost & {
  author?: Profile | null
  organization?: Organization | null
  is_liked_by_user?: boolean
  is_bookmarked_by_user?: boolean
  post_likes?: Array<{ count: number }>
  post_bookmarks?: Array<{ count: number }>
  matched_skills?: string[]
}

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [category, setCategory] = useState<PostCategory | 'all'>('all')
  const observerTarget = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)

  const loadMorePosts = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return

    isLoadingRef.current = true
    setIsLoading(true)
    try {
      const response = await fetch(`/api/posts/feed?page=${page}&limit=10`)
      if (!response.ok) throw new Error('Failed to fetch posts')

      const { posts: newPosts, hasMore: more } = await response.json()

      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id))
        return [...prev, ...(newPosts as Post[]).filter(p => !existingIds.has(p.id))]
      })
      setHasMore(more)
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Error loading posts:', error)
      if (page === 0) {
        toast.error('Failed to load feed')
      }
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
      setIsInitialLoading(false)
    }
  }, [page, hasMore])

  const filteredPosts = useMemo(() => {
    if (category === 'all') return posts
    return posts.filter((post) => post.category === category)
  }, [posts, category])

  // Initial load
  useEffect(() => {
    loadMorePosts()
  }, [])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          loadMorePosts()
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [loadMorePosts, isLoading, hasMore])

  // Loading skeleton
  if (isInitialLoading) {
    return (
      <div className='max-w-2xl mx-auto'>
        <div className='mb-4 rounded-xl border bg-card p-4'>
          <TrendingCategories value={category} onChange={setCategory} />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className='mb-4'>
            <Skeleton className='h-96 w-full' />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div className='max-w-2xl mx-auto text-center py-12'>
        <p className='text-gray-500 dark:text-gray-400 mb-4'>No posts yet. Check back soon!</p>
        <Button variant='outline' onClick={() => {
          setPosts([])
          setPage(0)
          setHasMore(true)
          loadMorePosts()
        }}>
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <div className='mb-4 rounded-xl border bg-card p-4'>
        <TrendingCategories value={category} onChange={setCategory} />
      </div>

      {filteredPosts.length === 0 ? (
        <div className='rounded-xl border border-dashed p-10 text-center'>
          <p className='text-sm text-muted-foreground'>No posts in this category yet.</p>
          <Button variant='outline' className='mt-4' onClick={() => setCategory('all')}>
            Clear filter
          </Button>
        </div>
      ) : (
        filteredPosts.map(post => (
          <div key={post.id}>
            {post.matched_skills && post.matched_skills.length > 0 && (
              <div className='mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-violet-600 dark:text-violet-400'>
                <Sparkles className='h-3.5 w-3.5' />
                Matches your skills: {post.matched_skills.slice(0, 2).join(', ')}
                {post.matched_skills.length > 2 && ` +${post.matched_skills.length - 2} more`}
              </div>
            )}
            <PostCard
              post={post}
              onBookmarkChange={(bookmarked) => {
                if (!bookmarked) {
                  setPosts((prev) => prev.filter((item) => item.id !== post.id))
                }
              }}
              onDeleted={() => setPosts((prev) => prev.filter((item) => item.id !== post.id))}
            />
          </div>
        ))
      )}

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className='py-4 text-center'>
        {isLoading && (
          <div className='flex items-center justify-center gap-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span className='text-gray-500'>Loading more posts...</span>
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className='text-gray-500 dark:text-gray-400'>No more posts to load</p>
        )}
      </div>
    </div>
  )
}
