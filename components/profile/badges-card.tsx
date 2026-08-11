'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Award, Star, TrendingUp, UserCheck, Crown, BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BadgeType } from '@/lib/types'

const BADGE_CONFIG: Record<BadgeType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  verified:       { label: 'Verified Member', color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',       icon: BadgeCheck },
  top_teacher:    { label: 'Top Teacher',     color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800', icon: Star },
  top_learner:    { label: 'Top Learner',     color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800', icon: TrendingUp },
  trusted:        { label: 'Trusted',         color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800', icon: UserCheck },
  community_star: { label: 'Community Star',  color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800', icon: Crown },
  early_adopter:  { label: 'Early Adopter',   color: 'text-pink-700 dark:text-pink-400',    bg: 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-800',        icon: Award },
}

export function BadgesCard({ badges }: { badges: { badge_type: BadgeType }[] }) {
  if (badges.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-violet-500" />
          Your badges
          <span className="ml-auto text-xs font-normal text-muted-foreground">{badges.length} earned</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => {
            const cfg = BADGE_CONFIG[b.badge_type]
            if (!cfg) return null
            const Icon = cfg.icon
            return (
              <span
                key={b.badge_type}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                  cfg.bg, cfg.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </span>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
