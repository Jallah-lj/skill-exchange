'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface QuickStatsCardProps {
  totalSkills: number
  teachCount: number
  learnCount: number
  visibleEndorsementsCount: number
}

export function QuickStatsCard({ totalSkills, teachCount, learnCount, visibleEndorsementsCount }: QuickStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick stats</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Total skills</p>
          <p className="text-2xl font-semibold">{totalSkills}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Teaching skills</p>
          <p className="text-2xl font-semibold">{teachCount}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Learning goals</p>
          <p className="text-2xl font-semibold">{learnCount}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Visible endorsements</p>
          <p className="text-2xl font-semibold">{visibleEndorsementsCount}</p>
        </div>
      </CardContent>
    </Card>
  )
}
