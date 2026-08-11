'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Home, Bookmark, Compass, MessageSquare, LayoutDashboard, Calendar, UserCircle } from 'lucide-react'
import type { Profile } from '@/lib/types'

// ─── Nav item config ─────────────────────────────────────────────────────────

interface NavItem {
  href:     string
  icon:     React.FC<{ className?: string }>
  label:    string
  hasBadge?: boolean
  isCenter?: boolean
}

// 3 tabs either side of the raised centre button keeps the bar visually
// symmetric. Search itself isn't a tab — it lives in the persistent search
// bar at the top of every page (components/navbar.tsx) instead of a
// separate page, so there's nothing left for a bottom-nav tab to link to.
const NAV: NavItem[] = [
  { href: '/home',      icon: Home,            label: 'Home'      },
  { href: '/saved',     icon: Bookmark,        label: 'Saved'     },
  { href: '/browse',    icon: Compass,         label: 'Browse'    },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', isCenter: true  },
  { href: '/matches',   icon: MessageSquare,   label: 'Matches',   hasBadge: true  },
  { href: '/sessions',  icon: Calendar,        label: 'Sessions'  },
  { href: '/profile',   icon: UserCircle,      label: 'Profile'   },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function MobileBottomNav() {
  const pathname = usePathname()
  const supabase  = createClient()

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [unreadMsgs, setUnreadMsgs] = useState(0)

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
    }
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  // ── Unread message count ──────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    const fetch = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .is('read_at', null)
      setUnreadMsgs(count ?? 0)
    }

    fetch()
    let alive = true
    const ch = supabase
      .channel(`mob_unread:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => alive && fetch())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => alive && fetch())
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [profile])

  return (
    /* Outer shell — provides the raised-centre cutout illusion via overflow-visible */
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Hairline separator + glass background */}
      <div className="relative border-t bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-around h-[60px] px-1 max-w-lg mx-auto">
          {NAV.map(({ href, icon: Icon, label, hasBadge, isCenter }) => {
            const active   = pathname?.startsWith(href) ?? false
            const badgeNum = hasBadge ? unreadMsgs : 0

            /* ── Center (Dashboard) tab ────────────────────────────────── */
            if (isCenter) {
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex flex-1 flex-col items-center justify-end pb-1.5"
                >
                  {/* Elevated pill button — bottom edge sits at -top-5 (20px) + h (54px) = 34px
                      down from the tab's top, so the label below (justify-end + pb-1.5) must
                      clear that; centering this flex item instead of bottom-anchoring it was
                      what let the label creep up underneath the button. */}
                  <div className={cn(
                    'absolute -top-5 flex h-[54px] w-[54px] items-center justify-center rounded-2xl shadow-lg shadow-violet-500/30 transition-all duration-200 active:scale-95',
                    active
                      ? 'bg-violet-700 scale-105'
                      : 'bg-violet-600 hover:bg-violet-700',
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold tracking-wide leading-none transition-colors',
                    active ? 'text-violet-600' : 'text-muted-foreground',
                  )}>
                    {label}
                  </span>
                </Link>
              )
            }

            /* ── Profile tab — shows real avatar ──────────────────────── */
            const isProfile = href === '/profile'

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-1 flex-col items-center gap-0.5 py-2 group"
              >
                {/* Active pill indicator at top */}
                <span className={cn(
                  'absolute top-0 h-[3px] w-8 rounded-full transition-all duration-300',
                  active ? 'bg-violet-600 opacity-100' : 'opacity-0',
                )} />

                {/* Icon / avatar */}
                <div className="relative mt-1">
                  {isProfile && profile ? (
                    <Avatar className={cn(
                      'h-[26px] w-[26px] transition-all duration-200',
                      active ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-background scale-110' : 'group-hover:scale-105',
                    )}>
                      <AvatarImage src={profile.avatar_url ?? ''} />
                      <AvatarFallback className="text-[9px] font-bold">
                        {profile.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Icon className={cn(
                      'h-[22px] w-[22px] transition-all duration-200',
                      active
                        ? 'text-violet-600 scale-110'
                        : 'text-muted-foreground group-hover:text-foreground group-hover:scale-105',
                    )} />
                  )}

                  {/* Badge */}
                  {badgeNum > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
                      {badgeNum > 9 ? '9+' : badgeNum}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span className={cn(
                  'text-[10px] font-medium leading-none transition-colors',
                  active ? 'text-violet-600 font-semibold' : 'text-muted-foreground',
                )}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* iOS home-indicator safe-area spacer */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  )
}
