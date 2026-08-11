'use server'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, action } = await request.json()

    if (action === 'like') {
      // Check if already liked
      const { data: existing } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert([{ post_id: postId, user_id: user.id }])

        // Notify the post author (never for self-likes); failures are non-fatal
        const [{ data: post }, { data: liker }] = await Promise.all([
          supabase.from('organization_posts').select('author_id, title').eq('id', postId).single(),
          supabase.from('profiles').select('name').eq('id', user.id).single(),
        ])
        if (post?.author_id && post.author_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.author_id,
            type: 'post_like',
            title: `${liker?.name ?? 'Someone'} liked your post`,
            body: post.title || 'your post',
            href: `/posts/${postId}`,
          })
        }
      }
    } else if (action === 'bookmark') {
      // Check if already bookmarked
      const { data: existing } = await supabase
        .from('post_bookmarks')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        // Remove bookmark
        await supabase
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
      } else {
        // Add bookmark
        await supabase
          .from('post_bookmarks')
          .insert([{ post_id: postId, user_id: user.id }])
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Action error:', error)
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 })
  }
}
