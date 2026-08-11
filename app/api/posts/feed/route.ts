import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const limit = parseInt(searchParams.get('limit') || '10')

    const offset = page * limit

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Prefer engagement counts; fall back to a plain query so the feed still
    // loads even if the likes/bookmarks tables are not present yet.
    let { data: posts, error } = await supabase
      .from('organization_posts')
      .select('*, post_likes(count), post_bookmarks(count), post_comments(count)')
      .eq('is_published', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      ({ data: posts, error } = await supabase
        .from('organization_posts')
        .select('*')
        .eq('is_published', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1))
    }

    if (error || !posts) {
      console.error('Feed query error:', error)
      return NextResponse.json({ posts: [], hasMore: false, page })
    }

    const authorIds = [...new Set(posts.map(post => post.author_id).filter(Boolean))] as string[]
    const organizationIds = [...new Set(posts.map(post => post.organization_id).filter(Boolean))] as string[]

    const [{ data: authors }, { data: organizations }, { data: authorSkills }, { data: mySkills }] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('id, name, avatar_url, headline').in('id', authorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; avatar_url: string | null; headline: string | null }> }),
      organizationIds.length
        ? supabase.from('organizations').select('id, name, slug, avatar_url').in('id', organizationIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string; avatar_url: string | null }> }),
      // Author skills, to score each post's relevance against the viewer's own skills below.
      authorIds.length
        ? supabase.from('user_skills').select('user_id, skill_name, type').in('user_id', authorIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; skill_name: string; type: 'teach' | 'learn' }> }),
      user
        ? supabase.from('user_skills').select('skill_name, type').eq('user_id', user.id)
        : Promise.resolve({ data: [] as Array<{ skill_name: string; type: 'teach' | 'learn' }> }),
    ])

    const authorById = new Map((authors ?? []).map(author => [author.id, author]))
    const organizationById = new Map((organizations ?? []).map(organization => [organization.id, organization]))

    // Relevance: a post's author teaching what the viewer wants to learn (or
    // vice versa) surfaces it as a skill match, matching the same logic
    // /browse uses to score people. Case-insensitive compare, original
    // casing kept for display.
    const myLearnNames = new Set((mySkills ?? []).filter(s => s.type === 'learn').map(s => s.skill_name.toLowerCase()))
    const myTeachNames = new Set((mySkills ?? []).filter(s => s.type === 'teach').map(s => s.skill_name.toLowerCase()))
    const skillsByAuthor = new Map<string, Array<{ skill_name: string; type: 'teach' | 'learn' }>>()
    for (const s of authorSkills ?? []) {
      const list = skillsByAuthor.get(s.user_id) ?? []
      list.push(s)
      skillsByAuthor.set(s.user_id, list)
    }

    const matchedSkillsFor = (authorId: string | null): string[] => {
      if (!authorId || (myLearnNames.size === 0 && myTeachNames.size === 0)) return []
      const seen = new Set<string>()
      const matched: string[] = []
      for (const s of skillsByAuthor.get(authorId) ?? []) {
        const lower = s.skill_name.toLowerCase()
        const isMatch = (s.type === 'teach' && myLearnNames.has(lower)) || (s.type === 'learn' && myTeachNames.has(lower))
        if (isMatch && !seen.has(lower)) {
          seen.add(lower)
          matched.push(s.skill_name)
        }
      }
      return matched
    }

    const postsWithRelations = posts.map(post => {
      const matched_skills = matchedSkillsFor(post.author_id)
      return {
        ...post,
        author: post.author_id ? authorById.get(post.author_id) ?? null : null,
        organization: organizationById.get(post.organization_id) ?? null,
        matched_skills,
      }
    })

    // Stable sort (Array#sort is stable in Node/V8) bubbles skill-relevant
    // posts to the top of *this page* without disturbing recency order
    // within/across relevance groups, so infinite scroll pagination still
    // makes sense post-to-post.
    postsWithRelations.sort((a, b) => b.matched_skills.length - a.matched_skills.length)

    // Check if user has liked or bookmarked each post
    let postsWithUserActions = postsWithRelations

    if (user) {
      const postIds = posts.map(p => p.id)

      const { data: userLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds)

      const { data: userBookmarks } = await supabase
        .from('post_bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds)

      const likedPostIds = new Set(userLikes?.map(l => l.post_id) || [])
      const bookmarkedPostIds = new Set(userBookmarks?.map(b => b.post_id) || [])

      postsWithUserActions = postsWithRelations.map(post => ({
        ...post,
        is_liked_by_user: likedPostIds.has(post.id),
        is_bookmarked_by_user: bookmarkedPostIds.has(post.id),
      }))
    }

    return NextResponse.json({
      posts: postsWithUserActions,
      hasMore: posts.length === limit,
      page,
    })
  } catch (error) {
    console.error('Feed error:', error)
    return NextResponse.json({ posts: [], hasMore: false, page: 0 })
  }
}
