'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ThumbsUp, Pin, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserSkill } from '@/lib/types'
import type { ReceivedEndorsement, MatchedConnection } from '@/hooks/use-profile'
import { RequestEndorsementDialog } from '@/components/profile/request-endorsement-dialog'

interface EndorsementsSectionProps {
  endorsements: ReceivedEndorsement[]
  isEditing: boolean
  togglingId: string | null
  onTogglePin: (id: string, pinned: boolean) => void
  onToggleHide: (id: string, hidden: boolean) => void
  matches: MatchedConnection[]
  teachSkills: UserSkill[]
  onRequestEndorsement: (recipientId: string, skillName: string) => Promise<boolean>
}

export function EndorsementsSection({
  endorsements,
  isEditing,
  togglingId,
  onTogglePin,
  onToggleHide,
  matches,
  teachSkills,
  onRequestEndorsement,
}: EndorsementsSectionProps) {
  const visibleEndorsements = endorsements.filter((e) => !e.hidden)
  const hiddenEndorsements = endorsements.filter((e) => e.hidden)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThumbsUp className="h-5 w-5 text-violet-500" />
          Endorsements received
          {endorsements.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {visibleEndorsements.length} visible · {hiddenEndorsements.length} hidden
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Pin endorsements to highlight them on your public profile. Hidden ones won't appear publicly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RequestEndorsementDialog matches={matches} teachSkills={teachSkills} onRequest={onRequestEndorsement} />

        {endorsements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No endorsements yet.</p>
        ) : (
          <div className="space-y-2">
            {endorsements.map((e) => {
              const isBusy = togglingId === e.id
              return (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-opacity',
                    e.hidden && 'opacity-50',
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={e.endorser?.avatar_url ?? ''} />
                    <AvatarFallback className="text-xs">
                      {e.endorser?.name?.slice(0, 2).toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.endorser?.name ?? 'Someone'}</p>
                    <p className="text-xs text-muted-foreground">
                      endorsed your <span className="font-medium text-foreground">{e.skill_name}</span> skill
                    </p>
                  </div>

                  {e.pinned && (
                    <Badge variant="secondary" className="text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-400 text-xs shrink-0">
                      Featured
                    </Badge>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onTogglePin(e.id, !e.pinned)}
                        disabled={isBusy}
                        title={e.pinned ? 'Remove from featured' : 'Feature on profile'}
                        aria-label={e.pinned ? 'Remove from featured' : 'Feature on profile'}
                        className={cn(
                          'h-9 w-9 rounded-full flex items-center justify-center transition-colors hover:bg-accent disabled:opacity-50',
                          e.pinned && 'text-yellow-500',
                        )}
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onToggleHide(e.id, !e.hidden)}
                        disabled={isBusy}
                        title={e.hidden ? 'Show on public profile' : 'Hide from public profile'}
                        aria-label={e.hidden ? 'Show on public profile' : 'Hide from public profile'}
                        className="h-9 w-9 rounded-full flex items-center justify-center transition-colors hover:bg-accent disabled:opacity-50 text-muted-foreground"
                      >
                        {e.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
