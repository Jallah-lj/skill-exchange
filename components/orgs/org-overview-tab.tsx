'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserPlus, Megaphone, Calendar, Inbox, Layout, ExternalLink, ArrowRight } from 'lucide-react'

interface OrgOverviewTabProps {
  slug: string
  memberCount: number
  pendingRequestCount: number
  announcementCount: number
  workshopCount: number
  threadCount: number
  postCount: number
  onNavigate: (tab: string) => void
}

export function OrgOverviewTab({
  slug,
  memberCount,
  pendingRequestCount,
  announcementCount,
  workshopCount,
  threadCount,
  postCount,
  onNavigate,
}: OrgOverviewTabProps) {
  const stats = [
    { label: 'Members', value: memberCount, icon: Users, tab: 'members' },
    { label: 'Pending requests', value: pendingRequestCount, icon: UserPlus, tab: 'requests', highlight: pendingRequestCount > 0 },
    { label: 'Announcements', value: announcementCount, icon: Megaphone, tab: 'announcements' },
    { label: 'Workshops', value: workshopCount, icon: Calendar, tab: 'workshops' },
    { label: 'Inbox threads', value: threadCount, icon: Inbox, tab: 'inbox' },
    { label: 'Public posts', value: postCount, icon: Layout, tab: 'posts' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onNavigate(s.tab)}
            className={`rounded-xl border p-4 text-left transition-all hover:border-muted-foreground/40 ${
              s.highlight ? 'border-primary/50 bg-primary/5' : 'border-border'
            }`}
          >
            <s.icon className={`h-4 w-4 ${s.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="mt-2 text-2xl font-bold leading-none">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 ring-1 ring-border shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Reach your members</CardTitle>
            <CardDescription>Keep the organization active and informed.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-between" onClick={() => onNavigate('announcements')}>
              <span className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Post an announcement</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="justify-between" onClick={() => onNavigate('workshops')}>
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule a workshop</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="justify-between" onClick={() => onNavigate('inbox')}>
              <span className="flex items-center gap-2"><Inbox className="h-4 w-4" /> Answer member messages</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 ring-1 ring-border shadow-md">
          <CardHeader>
            <CardTitle className="text-base">Grow the organization</CardTitle>
            <CardDescription>Bring in new members and review who's waiting.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-between" onClick={() => onNavigate('invites')}>
              <span className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite people</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="justify-between" onClick={() => onNavigate('requests')}>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Review join requests
                {pendingRequestCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {pendingRequestCount}
                  </span>
                )}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="justify-between"
              nativeButton={false}
              render={<Link href={`/orgs/${slug}`} target="_blank" />}
            >
              <span className="flex items-center gap-2"><ExternalLink className="h-4 w-4" /> View public page</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
