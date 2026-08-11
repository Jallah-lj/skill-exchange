import { createClient } from '@/lib/supabase/client'
import type { NotificationType } from '@/lib/types'

interface OrgNotification {
  userId: string
  type: NotificationType
  title: string
  body?: string
  href?: string
}

/** Insert in-app notifications; failures are non-fatal (the action itself already succeeded). */
export async function sendOrgNotifications(notifications: OrgNotification[]) {
  if (notifications.length === 0) return
  const supabase = createClient()
  await supabase.from('notifications').insert(
    notifications.map((n) => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    }))
  )
}

/** User ids of everyone who manages an org (owner/admin/moderator). */
export async function getOrgManagerIds(orgId: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin', 'moderator'])
  return (data ?? []).map((m) => m.user_id)
}

/** User ids of every member of an org, regardless of role. */
export async function getOrgMemberIds(orgId: string, excludeUserId?: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
  return (data ?? []).map((m) => m.user_id).filter((id) => id !== excludeUserId)
}

/** Days remaining on a declined request's cooldown; 0 when expired/waived/absent. */
export function cooldownDaysLeft(req: {
  status: string
  cooldown_until?: string | null
  cooldown_waived_at?: string | null
}): number {
  if (req.status !== 'declined' || !req.cooldown_until || req.cooldown_waived_at) return 0
  const msLeft = new Date(req.cooldown_until).getTime() - Date.now()
  return msLeft > 0 ? Math.ceil(msLeft / 86_400_000) : 0
}
