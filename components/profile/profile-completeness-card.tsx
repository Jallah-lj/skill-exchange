'use client'

import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileCompletenessCardProps {
  hasAvatar: boolean
  hasCover: boolean
  hasHeadline: boolean
  hasBio: boolean
  hasLocation: boolean
  hasTeachSkill: boolean
  hasLearnSkill: boolean
}

export function ProfileCompletenessCard({
  hasAvatar,
  hasCover,
  hasHeadline,
  hasBio,
  hasLocation,
  hasTeachSkill,
  hasLearnSkill,
}: ProfileCompletenessCardProps) {
  const checklist = [
    { label: 'Add a profile photo', done: hasAvatar },
    { label: 'Add a cover photo', done: hasCover },
    { label: 'Write a headline', done: hasHeadline },
    { label: 'Write a bio', done: hasBio },
    { label: 'Add your location', done: hasLocation },
    { label: 'Add a skill you can teach', done: hasTeachSkill },
    { label: 'Add a skill you want to learn', done: hasLearnSkill },
  ]

  const doneCount = checklist.filter((c) => c.done).length
  const percent = Math.round((doneCount / checklist.length) * 100)

  if (percent === 100) return null

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Profile completeness</p>
          <p className="text-sm font-semibold text-muted-foreground">{percent}%</p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ul className="grid gap-1.5">
          {checklist.map((item) => (
            <li key={item.label} className={cn('flex items-center gap-2 text-sm', item.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
