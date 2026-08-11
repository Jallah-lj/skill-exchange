'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Loader2, Building2, FileText, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserHit { id: string; name: string; username: string | null; avatar_url: string | null; headline: string | null }
interface OrgHit { id: string; name: string; slug: string; avatar_url: string | null }
interface PostHit { id: string; title: string | null; content: string | null }

const RECENT_KEY = 'skillswap:recent-searches'
const MAX_RECENT = 8

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecent(terms: string[]) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms)) } catch {}
}

/**
 * A single search entry point meant to be reachable from anywhere in the
 * app (embedded in the top bar on every page — see components/navbar.tsx
 * and app/(main)/layout.tsx). Live-queries people, organizations, and posts
 * as you type, right in the dropdown — there's no separate results page.
 * Focusing the input with nothing typed yet shows your recent searches
 * instead of an empty state. Post results are already scoped by the
 * organization_posts RLS visibility policy — this never sees a post the
 * viewer isn't allowed to.
 *
 * `onOpenChange` lets a hover-collapsible parent (if any) know when the
 * results dropdown is showing, so it can stay pinned open rather than
 * collapsing mid-interaction.
 */
export function QuickSearch({ className, onOpenChange }: { className?: string; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter()
  const supabase = createClient()
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [open, setOpenState] = useState(false)
  const setOpen = useCallback((next: boolean) => { setOpenState(next); onOpenChange?.(next) }, [onOpenChange])
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserHit[]>([])
  const [orgs, setOrgs] = useState<OrgHit[]>([])
  const [posts, setPosts] = useState<PostHit[]>([])
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => { setRecent(loadRecent()) }, [])

  const commitRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT)
      saveRecent(next)
      return next
    })
  }, [])

  const clearRecent = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setRecent([])
    saveRecent([])
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setUsers([]); setOrgs([]); setPosts([])
      return
    }
    setLoading(true)
    const safe = q.replace(/[%_,()]/g, ' ').trim()
    const pat = `%${safe}%`

    const [u, o, p] = await Promise.all([
      supabase.from('profiles')
        .select('id, name, username, avatar_url, headline')
        .or(`name.ilike.${pat},username.ilike.${pat},headline.ilike.${pat}`)
        .limit(4),
      supabase.from('organizations')
        .select('id, name, slug, avatar_url')
        .or(`name.ilike.${pat},bio.ilike.${pat}`)
        .limit(3),
      supabase.from('organization_posts')
        .select('id, title, content')
        .eq('is_published', true)
        .is('deleted_at', null)
        .or(`title.ilike.${pat},content.ilike.${pat}`)
        .limit(3),
    ])

    setUsers((u.data as UserHit[]) ?? [])
    setOrgs((o.data as OrgHit[]) ?? [])
    setPosts((p.data as unknown as PostHit[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim()) void runSearch(query.trim()) }, 300)
    return () => clearTimeout(t)
  }, [query, runSearch])

  // If this unmounts while still "open" (e.g. a hover-collapsible parent
  // removes it), make sure the parent hears about the close too.
  useEffect(() => () => onOpenChange?.(false), [onOpenChange])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const selectRecentTerm = (term: string) => {
    setQuery(term)
    void runSearch(term)
  }

  const goToProfile = (u: UserHit) => { commitRecentSearch(query); router.push(`/profile/${u.id}`); setOpen(false) }
  const goToOrg = (o: OrgHit) => { commitRecentSearch(query); router.push(`/orgs/${o.slug}`); setOpen(false) }
  const goToPost = (p: PostHit) => { commitRecentSearch(query); router.push(`/posts/${p.id}`); setOpen(false) }

  const hasResults = users.length > 0 || orgs.length > 0 || posts.length > 0
  const isTyping = query.trim().length >= 2
  const showDropdown = open

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRecentSearch(query) }}
          placeholder="Search SkillSwap..."
          className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {!isTyping ? (
            recent.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Start typing to search people, organizations, and posts.</p>
            ) : (
              <div className="py-1">
                <div className="flex items-center justify-between px-3 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent searches</p>
                  <button onClick={clearRecent} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                {recent.map((term) => (
                  <button
                    key={term}
                    onClick={() => selectRecentTerm(term)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{term}</span>
                    <X
                      className="h-3 w-3 shrink-0 text-muted-foreground/50 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRecent((prev) => {
                          const next = prev.filter((t) => t !== term)
                          saveRecent(next)
                          return next
                        })
                      }}
                    />
                  </button>
                ))}
              </div>
            )
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </div>
          ) : !hasResults ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No results for "{query.trim()}"</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {users.length > 0 && (
                <div className="px-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">People</p>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => goToProfile(u)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={u.avatar_url ?? ''} />
                        <AvatarFallback className="text-[9px]">{u.name?.slice(0, 2).toUpperCase() ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{u.name}</p>
                        {u.headline && <p className="truncate text-[10px] text-muted-foreground">{u.headline}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {orgs.length > 0 && (
                <div className="px-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Organizations</p>
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => goToOrg(o)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <Avatar className="h-6 w-6 shrink-0 rounded-md">
                        <AvatarImage src={o.avatar_url ?? ''} />
                        <AvatarFallback className="rounded-md text-[9px]"><Building2 className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <p className="truncate text-xs font-medium">{o.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {posts.length > 0 && (
                <div className="px-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Posts</p>
                  {posts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => goToPost(p)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="line-clamp-1 text-xs">{p.title || p.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
