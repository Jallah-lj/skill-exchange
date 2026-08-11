'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save, SlidersHorizontal } from 'lucide-react'
import type { Organization } from '@/lib/types'

const COOLDOWN_OPTIONS = [7, 14, 30, 60, 90]
const ROLES = ['member', 'instructor', 'moderator', 'admin'] as const

interface OrgMembershipSettingsProps {
  org: Organization
  onUpdated: (patch: Partial<Organization>) => void
}

export function OrgMembershipSettings({ org, onUpdated }: OrgMembershipSettingsProps) {
  const supabase = createClient()

  const [cooldown, setCooldown] = useState(String(org.reapply_cooldown_days ?? 30))
  const [maxMembers, setMaxMembers] = useState(org.max_members != null ? String(org.max_members) : '')
  const [defaultRole, setDefaultRole] = useState(org.default_member_role ?? 'member')
  const [autoExpire, setAutoExpire] = useState(org.auto_expire_requests_days != null ? String(org.auto_expire_requests_days) : '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const patch = {
      reapply_cooldown_days: parseInt(cooldown, 10),
      max_members: maxMembers ? parseInt(maxMembers, 10) : null,
      default_member_role: defaultRole,
      auto_expire_requests_days: autoExpire ? parseInt(autoExpire, 10) : null,
    }
    const { error } = await supabase.from('organizations').update(patch).eq('id', org.id)
    if (error) toast.error('Failed to save membership settings')
    else {
      onUpdated(patch)
      toast.success('Membership settings saved')
    }
    setSaving(false)
  }

  return (
    <Card className="border-0 ring-1 ring-border shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-violet-500" /> Membership Controls
        </CardTitle>
        <CardDescription>Defaults for join requests, member limits, and roles.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Default reapply waiting period</Label>
          <Select value={cooldown} onValueChange={(v) => { if (v) setCooldown(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COOLDOWN_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Pre-selected when declining a request; adjustable per decline.</p>
        </div>

        <div className="grid gap-1.5">
          <Label>Default role for new members</Label>
          <Select value={defaultRole} onValueChange={(v) => { if (v) setDefaultRole(v as typeof ROLES[number]) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Applied on open joins and approved requests.</p>
        </div>

        <div className="grid gap-1.5">
          <Label>Maximum members (blank = unlimited)</Label>
          <Input type="number" min="1" placeholder="e.g. 500" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Joins are blocked once the limit is reached.</p>
        </div>

        <div className="grid gap-1.5">
          <Label>Auto-expire pending requests after (days, blank = never)</Label>
          <Input type="number" min="1" placeholder="e.g. 14" value={autoExpire} onChange={(e) => setAutoExpire(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Stale requests are auto-declined when the dashboard loads.</p>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 pt-6 border-t rounded-b-xl">
        <Button onClick={save} disabled={saving} className="ml-auto gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save membership settings
        </Button>
      </CardFooter>
    </Card>
  )
}
