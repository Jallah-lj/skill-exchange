'use client'

import { Suspense, useState } from 'react'
import { Feed } from '@/components/feed'
import { Skeleton } from '@/components/ui/skeleton'
import { PostComposer } from '@/components/post-composer'
import { UpcomingSessionBanner } from '@/components/home/upcoming-session-banner'
import { SuggestedMatches } from '@/components/home/suggested-matches'

function FeedSkeleton() {
  return (
    <div className='max-w-2xl mx-auto py-8'>
      {[1, 2, 3].map(i => (
        <div key={i} className='mb-4'>
          <Skeleton className='h-96 w-full' />
        </div>
      ))}
    </div>
  )
}

export default function HomePage() {
  const [feedKey, setFeedKey] = useState(0)

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-2'>Feed</h1>
        <p className='text-muted-foreground'>Stay updated with the latest posts and updates</p>
      </div>

      <div className='max-w-2xl mx-auto mb-6'>
        <UpcomingSessionBanner />
        <SuggestedMatches />
        <PostComposer onPublished={() => setFeedKey((value) => value + 1)} />
      </div>

      <Suspense fallback={<FeedSkeleton />}>
        <Feed key={feedKey} />
      </Suspense>
    </div>
  )
}
