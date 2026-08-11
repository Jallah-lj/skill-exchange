'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, MessageSquare, Users, CheckCircle, ThumbsUp, Star, BellOff, AtSign, Award, BadgeCheck, ShieldAlert, Megaphone, Info, Headphones, X, Settings2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/types'

const TYPE_ICON: Record<string, React.ReactNode> = {
  match_request:   <Users        className="h-4 w-4 text-violet-500" />,
  match_accepted:  <CheckCircle  className="h-4 w-4 text-green-500"  />,
  new_message:     <MessageSquare className="h-4 w-4 text-blue-500"  />,
  new_endorsement: <ThumbsUp     className="h-4 w-4 text-yellow-500" />,
  new_review:      <Star         className="h-4 w-4 text-yellow-500" />,
  mention:         <AtSign       className="h-4 w-4 text-violet-500" />,
  badge_awarded:   <Award        className="h-4 w-4 text-violet-500" />,
  badge_revoked:   <Award        className="h-4 w-4 text-muted-foreground" />,
  kyc_update:      <BadgeCheck   className="h-4 w-4 text-blue-500" />,
  account_status:  <ShieldAlert  className="h-4 w-4 text-orange-500" />,
  role_change:     <ShieldAlert  className="h-4 w-4 text-violet-500" />,
  report_resolved: <CheckCircle  className="h-4 w-4 text-emerald-500" />,
  announcement:    <Megaphone    className="h-4 w-4 text-violet-500" />,
  warning:         <ShieldAlert  className="h-4 w-4 text-amber-500"  />,
  info:            <Info         className="h-4 w-4 text-blue-500"   />,
  support_ticket:  <Headphones   className="h-4 w-4 text-violet-500" />,
}

interface NotificationsPanelProps {
  userId: string
  /** Popover placement relative to the bell. The mobile navbar (top-right of
   *  the screen) uses the default bottom/end; the desktop sidebar (left rail)
   *  must fly out to the right or the 320px panel hugs the screen edge. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function NotificationsPanel({ userId, side = 'bottom', align = 'end' }: NotificationsPanelProps) {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifs(data ?? [])
  }, [userId])

  useEffect(() => {
    load()
    let cancelled = false
    const channel = supabase
      .channel(`notifs:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (p) => { if (!cancelled) setNotifs((prev) => [p.new as Notification, ...prev.slice(0, 29)]) })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [userId])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
    setNotifs((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: now }))
  }, [userId])

  const dismiss = useCallback(async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id)) // optimistic
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) load() // roll back to server truth on failure
  }, [load])

  const clearAll = useCallback(async () => {
    setNotifs([]) // optimistic
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) load()
  }, [userId, load])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) markAllRead()
  }

  const unreadCount = notifs.filter((n) => !n.read_at).length

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={side} align={align} sideOffset={side === 'right' ? 10 : 4} className="w-80 max-w-[calc(100vw-2rem)] max-h-[450px] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); markAllRead() }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all read
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearAll() }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Notification settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <DropdownMenuSeparator />

        {notifs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <BellOff className="h-6 w-6 opacity-40" />
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          notifs.map((n) => (
            <DropdownMenuItem
              key={n.id}
              nativeButton={false}
              render={<Link href={n.href ?? '#'} />}
              className={cn(
                'flex items-start gap-2.5 py-2.5 cursor-pointer rounded-none',
                !n.read_at && 'bg-violet-50 dark:bg-violet-950/20',
              )}
            >
              <div className="mt-0.5 shrink-0">
                {TYPE_ICON[n.type] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm leading-snug', !n.read_at && 'font-medium')}>{n.title}</p>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                {!n.read_at && <div className="h-2 w-2 rounded-full bg-violet-500 mt-1" />}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id) }}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
