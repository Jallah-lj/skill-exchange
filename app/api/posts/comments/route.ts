import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyMentions } from '@/lib/mentions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ comments: [] })
    }

    const { data: comments, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error || !comments) {
      return NextResponse.json({ comments: [] })
    }

    const userIds = [...new Set(comments.map(comment => comment.user_id))] as string[]
    const { data: users } = userIds.length
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds)
      : { data: [] as Array<{ id: string; name: string; avatar_url: string | null }> }

    const userById = new Map((users ?? []).map(user => [user.id, user]))

    return NextResponse.json({
      comments: comments.map(comment => ({
        ...comment,
        user: userById.get(comment.user_id) ?? null,
      })),
    })
  } catch (error) {
    console.error('Comments fetch error:', error)
    return NextResponse.json({ comments: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, content, parentId, asOrganization } = await request.json()

    if (!postId || !content?.trim()) {
      return NextResponse.json({ error: 'Invalid comment' }, { status: 400 })
    }

    // Only actual org managers may speak as the organization.
    let asOrgFlag = false
    if (asOrganization) {
      const { data: postRow } = await supabase
        .from('organization_posts')
        .select('organization_id, organization:organizations(owner_id)')
        .eq('id', postId)
        .single()
      if (postRow) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', postRow.organization_id)
          .eq('user_id', user.id)
          .maybeSingle()
        const isOwner = (postRow.organization as { owner_id?: string } | null)?.owner_id === user.id
        asOrgFlag = isOwner || ['owner', 'admin', 'moderator'].includes(membership?.role ?? '')
      }
    }

    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
      parent_id: parentId ?? null,
      as_organization: asOrgFlag,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Notify the right person (never self); failures are non-fatal
    try {
      const { data: commenter } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      const commenterName = asOrgFlag ? 'An organization' : (commenter?.name ?? 'Someone')

      if (parentId) {
        // Reply → notify the parent comment's author
        const { data: parent } = await supabase
          .from('post_comments')
          .select('user_id')
          .eq('id', parentId)
          .single()
        if (parent?.user_id && parent.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: parent.user_id,
            type: 'comment_reply',
            title: `${commenterName} replied to your comment`,
            body: content.trim().slice(0, 120),
            href: `/posts/${postId}`,
          })
        }
      } else {
        // Top-level comment → notify the post author
        const { data: post } = await supabase
          .from('organization_posts')
          .select('author_id, title')
          .eq('id', postId)
          .single()
        if (post?.author_id && post.author_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.author_id,
            type: 'post_comment',
            title: `${commenterName} commented on your post`,
            body: content.trim().slice(0, 120),
            href: `/posts/${postId}`,
          })
        }
      }
    } catch (notifyError) {
      console.error('Comment notification failed:', notifyError)
    }

    const { data: commenter } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    void notifyMentions(supabase, {
      text: content,
      actorName: commenter?.name ?? 'Someone',
      title: `${commenter?.name ?? 'Someone'} mentioned you in a comment`,
      href: `/posts/${postId}`,
      excludeUserId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Comments post error:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
