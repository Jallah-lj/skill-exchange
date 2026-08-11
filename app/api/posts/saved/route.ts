import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bookmarks, error } = await supabase
      .from('post_bookmarks')
      .select('post_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error || !bookmarks) {
      return NextResponse.json({ posts: [] })
    }

    const postIds = bookmarks.map(bookmark => bookmark.post_id)

    if (postIds.length === 0) {
      return NextResponse.json({ posts: [] })
    }

    const [{ data: posts }, { data: authors }, { data: organizations }] = await Promise.all([
      supabase
        .from('organization_posts')
        .select('*')
        .in('id', postIds)
        .eq('is_published', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, headline')
        .in('id', [...new Set((bookmarks as any[]).map(() => null).filter(Boolean))]),
      supabase
        .from('organizations')
        .select('id, name, slug, avatar_url')
        .in('id', [...new Set((bookmarks as any[]).map(() => null).filter(Boolean))]),
    ])

    const postList = posts ?? []
    const authorIds = [...new Set(postList.map(post => post.author_id).filter(Boolean))] as string[]
    const orgIds = [...new Set(postList.map(post => post.organization_id).filter(Boolean))] as string[]

    const [authorLookup, organizationLookup] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('id, name, avatar_url, headline').in('id', authorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; avatar_url: string | null; headline: string | null }> }),
      orgIds.length
        ? supabase.from('organizations').select('id, name, slug, avatar_url').in('id', orgIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string; avatar_url: string | null }> }),
    ])

    const authorMap = new Map((authorLookup.data ?? []).map(author => [author.id, author]))
    const organizationMap = new Map((organizationLookup.data ?? []).map(organization => [organization.id, organization]))

    return NextResponse.json({
      posts: postList.map(post => ({
        ...post,
        author: post.author_id ? authorMap.get(post.author_id) ?? null : null,
        organization: organizationMap.get(post.organization_id) ?? null,
        is_bookmarked_by_user: true,
      })),
    })
  } catch (error) {
    console.error('Saved posts error:', error)
    return NextResponse.json({ posts: [] })
  }
}
