'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Megaphone, Lightbulb, Rocket, HandHelping, CalendarClock, Layers, Loader2 } from 'lucide-react'

export type PostCategory = 'news' | 'opportunity' | 'project' | 'help_wanted' | 'event'

const CATEGORY_META: Record<PostCategory, { label: string; icon: typeof Megaphone; activeClass: string }> = {
  news: { label: 'News', icon: Megaphone, activeClass: 'bg-purple-600 text-white dark:bg-purple-500' },
  opportunity: { label: 'Opportunity', icon: Lightbulb, activeClass: 'bg-blue-600 text-white dark:bg-blue-500' },
  project: { label: 'Project', icon: Rocket, activeClass: 'bg-green-600 text-white dark:bg-green-500' },
  help_wanted: { label: 'Help Wanted', icon: HandHelping, activeClass: 'bg-orange-600 text-white dark:bg-orange-500' },
  event: { label: 'Event', icon: CalendarClock, activeClass: 'bg-pink-600 text-white dark:bg-pink-500' },
}

const CATEGORY_ORDER: PostCategory[] = ['news', 'opportunity', 'project', 'help_wanted', 'event']
const WINDOW_DAYS = 7

interface TrendingCategoriesProps {
  value: PostCategory | 'all'
  onChange: (value: PostCategory | 'all') => void
}

export function TrendingCategories({ value, onChange }: TrendingCategoriesProps) {
  const supabase = createClient()
  const [counts, setCounts] = useState<Record<PostCategory, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const results = await Promise.all(
        CATEGORY_ORDER.map((category) =>
          supabase
            .from('organization_posts')
            .select('id', { count: 'exact', head: true })
            .eq('category', category)
            .eq('is_published', true)
            .is('deleted_at', null)
            .gte('created_at', since)
        )
      )
      if (cancelled) return
      const next = {} as Record<PostCategory, number>
      CATEGORY_ORDER.forEach((category, i) => { next[category] = results[i].count ?? 0 })
      setCounts(next)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const sortedCategories = counts
    ? [...CATEGORY_ORDER].sort((a, b) => counts[b] - counts[a])
    : CATEGORY_ORDER

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1">
      <button
        onClick={() => onChange('all')}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border',
          value === 'all'
            ? 'bg-foreground text-background border-transparent'
            : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        All
      </button>

      {counts === null ? (
        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading trends…
        </span>
      ) : (
        sortedCategories.map((category) => {
          const { label, icon: Icon, activeClass } = CATEGORY_META[category]
          const count = counts[category]
          const isActive = value === category
          return (
            <button
              key={category}
              onClick={() => onChange(category)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border',
                isActive
                  ? `${activeClass} border-transparent`
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span className={cn('text-[10px] tabular-nums', isActive ? 'opacity-80' : 'text-muted-foreground/70')}>
                  {count}
                </span>
              )}
            </button>
          )
        })
      )}
    </div>
  )
}
