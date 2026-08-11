'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Users, Trash2, ShieldAlert, Shield, Gavel, GraduationCap, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganizationMember, OrganizationRole } from '@/lib/types'

const ROLE_META: Record<OrganizationRole, { label: string; desc: string; icon: React.ElementType; badgeClass: string }> = {
  owner: {
    label: 'Owner',
    desc: 'Full control, including deletion and ownership transfer',
    icon: ShieldAlert,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  admin: {
    label: 'Admin',
    desc: 'Manage settings, members, requests, and invites',
    icon: Shield,
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
  },
  moderator: {
    label: 'Moderator',
    desc: 'Moderate announcements, posts, and the inbox',
    icon: Gavel,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  },
  instructor: {
    label: 'Instructor',
    desc: 'Create and run workshops',
    icon: GraduationCap,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  member: {
    label: 'Member',
    desc: 'Participate in the organization',
    icon: User,
    badgeClass: 'bg-muted text-muted-foreground',
  },
}

const ASSIGNABLE_ROLES: OrganizationRole[] = ['admin', 'moderator', 'instructor', 'member']

interface OrgMembersTabProps {
  members: OrganizationMember[]
  userRole: OrganizationRole
  currentUserId: string | null
  onUpdateRole: (memberId: string, role: OrganizationRole) => void
  onRemove: (memberId: string, name?: string) => void
}

export function OrgMembersTab({ members, userRole, currentUserId, onUpdateRole, onRemove }: OrgMembersTabProps) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<OrganizationRole | 'all'>('all')

  const canManage = userRole === 'owner' || userRole === 'admin'

  const roleCounts = useMemo(() => {
    const counts = { owner: 0, admin: 0, moderator: 0, instructor: 0, member: 0 }
    for (const m of members) counts[m.role] += 1
    return counts
  }, [members])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter((m) => roleFilter === 'all' || m.role === roleFilter)
      .filter((m) =>
        !q ||
        m.profile?.name?.toLowerCase().includes(q) ||
        m.profile?.location?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const order: OrganizationRole[] = ['owner', 'admin', 'moderator', 'instructor', 'member']
        const roleDiff = order.indexOf(a.role) - order.indexOf(b.role)
        if (roleDiff !== 0) return roleDiff
        return (a.profile?.name ?? '').localeCompare(b.profile?.name ?? '')
      })
  }, [members, search, roleFilter])

  return (
    <div className="space-y-6">
      {/* Role legend */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(ROLE_META) as OrganizationRole[]).map((role) => {
          const meta = ROLE_META[role]
          const Icon = meta.icon
          const active = roleFilter === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(active ? 'all' : role)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                active ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-3.5 w-3.5" /> {meta.label}
                </span>
                <span className="text-sm font-bold text-muted-foreground">{roleCounts[role]}</span>
              </div>
              <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{meta.desc}</p>
            </button>
          )
        })}
      </div>

      <Card className="border-0 ring-1 ring-border shadow-md">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription>
                {canManage ? 'Search, assign roles, and remove members.' : 'You need admin access to manage members.'}
              </CardDescription>
            </div>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-sm font-medium">
                {members.length === 0 ? 'No members yet' : 'No members match your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((member) => {
                const meta = ROLE_META[member.role]
                const isSelf = member.user_id === currentUserId
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/10">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-border">
                        <AvatarImage src={member.profile?.avatar_url ?? ''} />
                        <AvatarFallback className="bg-violet-100 font-bold text-violet-700">
                          {member.profile?.name?.slice(0, 2).toUpperCase() ?? '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {member.profile?.name ?? 'Unknown'}
                          {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.profile?.location || 'No location'}
                          {member.created_at && ` · joined ${new Date(member.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {member.role === 'owner' || !canManage || isSelf ? (
                        <Badge className={cn('h-8 gap-1.5 border-0 px-3 font-bold', meta.badgeClass)}>
                          <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                        </Badge>
                      ) : (
                        <>
                          <Select
                            value={member.role}
                            onValueChange={(v) => { if (v) onUpdateRole(member.id, v as OrganizationRole) }}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="capitalize">{ROLE_META[r].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${member.profile?.name ?? 'member'}`}
                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => onRemove(member.id, member.profile?.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
