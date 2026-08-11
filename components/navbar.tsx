'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import {
  MessageSquare, LayoutDashboard, LogOut, Compass,
  User, Moon, Sun, Calendar, Settings, ChevronRight, Home, Bookmark,
} from 'lucide-react'
import { LogoMark } from '@/components/logo'
import { useTheme } from 'next-themes'
import { NotificationsPanel } from '@/components/notifications-panel'
import { QuickSearch } from '@/components/quick-search'
import type { Profile } from '@/lib/types'

// ─── Desktop nav links ────────────────────────────────────────────────────────
// Search isn't a link here anymore — QuickSearch below is the single,
// always-visible search entry point for the whole platform.

const NAV_LINKS = [
  { href: '/home',        label: 'Home',      icon: Home            },
  { href: '/saved',       label: 'Saved',     icon: Bookmark        },
  { href: '/browse',      label: 'Browse',    icon: Compass         },
  { href: '/matches',     label: 'Matches',   icon: MessageSquare   },
  { href: '/sessions',    label: 'Sessions',  icon: Calendar        },
  { href: '/dashboard',   label: 'Dashboard', icon: LayoutDashboard },
]

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname             = usePathname()
  const router               = useRouter()
  const { theme, setTheme }  = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase             = createClient()

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
    }
    getProfile()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => getProfile())
    return () => subscription.unsubscribe()
  }, [])

  // ── Unread messages badge (desktop nav only) ──────────────────────────────
  useEffect(() => {
    if (!profile) return
    const fetch = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', profile.id)
        .is('read_at', null)
      setUnreadCount(count ?? 0)
    }

    fetch()

    const interval = setInterval(fetch, 30_000)

    return () => {
      clearInterval(interval)
    }
  }, [profile])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* ── Logo ────────────────────────────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg shrink-0 select-none"
          >
            <LogoMark className="h-7" />
            <span className="hidden xs:inline">SkillSwap</span>
          </Link>

          {/* ── Global search — the one search entry point, on every page ── */}
          {profile && <QuickSearch className="min-w-0 flex-1 max-w-xs" />}

          {/* ── Desktop nav links ────────────────────────────────────────── */}
          {profile && (
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const badge  = href === '/matches' ? unreadCount : 0
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold leading-none">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── Right-side actions ─────────────────────────────────────── */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <Sun  className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* Notifications bell */}
            {profile && <NotificationsPanel userId={profile.id} />}

            {/* Profile dropdown */}
            {profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="relative ml-1 h-8 w-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url ?? ''} alt={profile.name} />
                    <AvatarFallback className="text-xs">{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-52">
                  {/* Profile summary */}
                  <div className="flex items-center gap-2.5 px-2 py-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={profile.avatar_url ?? ''} />
                      <AvatarFallback className="text-xs">{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{profile.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">View your profile</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    nativeButton={false}
                    render={<Link href="/profile" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="h-4 w-4" /> My Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    nativeButton={false}
                    render={<Link href="/settings" />}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="h-4 w-4" /> Settings
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
                  Get started
                </Button>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  )
}
