'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, FileText, BookOpen, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Linkify } from '@/components/linkify'

interface Post {
  id: string
  title: string
  content: string
  type: 'article' | 'resource' | 'announcement'
  category: string | null
  published_at: string | null
  created_at: string
  profiles?: { name: string } | null
}

const TYPE_CONFIG = {
  article:      { label: 'Article',      icon: FileText,  color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  resource:     { label: 'Resource',     icon: BookOpen,  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
} as const

export default function ResourcesPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'article' | 'resource' | 'announcement'>('all')
  const [openPost, setOpenPost] = useState<Post | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('posts')
        .select('*, profiles(name)')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false })
      setPosts((data as Post[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const counts = {
    all: posts.length,
    article: posts.filter((p) => p.type === 'article').length,
    resource: posts.filter((p) => p.type === 'resource').length,
    announcement: posts.filter((p) => p.type === 'announcement').length,
  }

  const filtered = posts.filter((p) => tab === 'all' || p.type === tab)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resources</h1>
        <p className="text-muted-foreground mt-1">Articles, guides, and announcements from the SkillSwap team.</p>
      </div>

      <div className="flex bg-muted/50 rounded-lg p-1 gap-0.5 w-fit">
        {(['all', 'article', 'resource', 'announcement'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="ml-1.5 text-xs opacity-60">{counts[t]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1">Check back later for new content.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => {
            const cfg = TYPE_CONFIG[post.type]
            const Icon = cfg.icon
            return (
              <Card
                key={post.id}
                className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                onClick={() => setOpenPost(post)}
              >
                <CardContent className="pt-5 pb-5 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn('text-[10px] gap-1 border', cfg.color)}>
                      <Icon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </Badge>
                    {post.category && <span className="text-xs text-muted-foreground">{post.category}</span>}
                  </div>
                  <h3 className="text-lg font-semibold leading-tight">{post.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{post.content}</p>
                  <p className="text-xs text-muted-foreground pt-1">
                    {post.profiles?.name ?? 'SkillSwap Team'} · {new Date(post.published_at ?? post.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!openPost} onOpenChange={(open) => !open && setOpenPost(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {openPost && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{openPost.title}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('text-[10px] gap-1 border', TYPE_CONFIG[openPost.type].color)}>
                    {TYPE_CONFIG[openPost.type].label}
                  </Badge>
                  <span>
                    {openPost.profiles?.name ?? 'SkillSwap Team'} · {new Date(openPost.published_at ?? openPost.created_at).toLocaleDateString()}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                <Linkify text={openPost.content} />
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
