'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LayoutDashboard, Users, Flag, Calendar, Activity,
  ChevronRight, LogOut, Bell, Megaphone,
  ShieldCheck, Menu, X, ArrowLeftRight, ShieldAlert,
  FileText, Fingerprint, Shield, Headphones,
  Settings, TrendingUp, Building2,
} from 'lucide-react'
import { LogoMark } from '@/components/logo'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  badge?: number | null
}

interface NavSection {
  title: string
  items: NavItem[]
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [admin, setAdmin] = useState<Profile | null>(null)
  const [pendingReports, setPendingReports] = useState(0)
  const [openTickets, setOpenTickets] = useState(0)
  const [pendingVerifications, setPendingVerifications] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshBadges = async () => {
    const [{ count: reports }, { count: tickets }, { count: kyc }] = await Promise.all([
      supabase.from('reports').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'escalated']),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
    ])
    setPendingReports(reports ?? 0)
    setOpenTickets(tickets ?? 0)
    setPendingVerifications(kyc ?? 0)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setAdmin(data)
      await refreshBadges()
    }
    load()
    reportIntervalRef.current = setInterval(refreshBadges, 30_000)
    return () => {
      if (reportIntervalRef.current) clearInterval(reportIntervalRef.current)
    }
  }, [])

  const navSections: NavSection[] = [
    {
      title: 'Platform',
      items: [
        { href: '/admin',          label: 'Overview',       icon: LayoutDashboard, exact: true },
        { href: '/admin/users',    label: 'Users',          icon: Users },
        { href: '/admin/orgs',     label: 'Organizations',  icon: Building2 },
        { href: '/admin/swaps',    label: 'Swap Management',icon: ArrowLeftRight },
        { href: '/admin/sessions', label: 'Sessions',       icon: Calendar },
      ],
    },
    {
      title: 'Safety',
      items: [
        { href: '/admin/trust',        label: 'Trust & Safety',     icon: ShieldAlert,  badge: pendingReports || null },
        { href: '/admin/reports',      label: 'Reports',            icon: Flag },
        { href: '/admin/verification', label: 'Verification',       icon: Fingerprint,  badge: pendingVerifications || null },
      ],
    },
    {
      title: 'Content',
      items: [
        { href: '/admin/content',       label: 'Content',       icon: FileText },
        { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      title: 'Operations',
      items: [
        { href: '/admin/support', label: 'Support',   icon: Headphones, badge: openTickets || null },
      ],
    },
    {
      title: 'Growth',
      items: [
        { href: '/admin/growth',   label: 'Growth & Marketing', icon: TrendingUp },
      ],
    },
    {
      title: 'Admin',
      items: [
        { href: '/admin/roles',    label: 'Admin Roles',  icon: ShieldCheck },
        { href: '/admin/security', label: 'Security',     icon: Shield },
        { href: '/admin/activity', label: 'Audit Log',    icon: Activity },
        { href: '/admin/settings', label: 'Settings',     icon: Settings },
      ],
    },
  ]

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Network error — session is cleared locally regardless
    }
    router.push('/')
    router.refresh()
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn(
      'flex flex-col h-full bg-gray-950 text-gray-300',
      mobile ? 'w-full' : 'w-64'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800 shrink-0">
        <LogoMark className="h-8 shrink-0" />
        <div>
          <p className="font-bold text-white text-sm leading-none">SkillSwap</p>
          <p className="text-[10px] text-violet-400 font-semibold tracking-widest uppercase mt-0.5">Admin Console</p>
        </div>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Admin badge */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600/10 border border-violet-500/20">
          <ShieldCheck className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="text-xs text-violet-300 font-medium">Administrator Access</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest px-3 py-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, exact, badge }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                      isActive
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin profile */}
      <div className="p-3 border-t border-gray-800 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer group">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-violet-500/30">
            <AvatarImage src={admin?.avatar_url ?? ''} />
            <AvatarFallback className="bg-violet-700 text-white text-xs">
              {admin?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{admin?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-violet-400">Super Admin</p>
          </div>
          <button
            onClick={handleSignOut}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col shrink-0 border-r border-gray-800">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 shrink-0 bg-white dark:bg-gray-900 border-b flex items-center gap-4 px-6">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-violet-600 font-medium">Admin</span>
            {pathname !== '/admin' && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="capitalize font-medium text-foreground">
                  {pathname.split('/').filter(Boolean).slice(1).join(' / ')}
                </span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Live badges in topbar */}
            {openTickets > 0 && (
              <Link href="/admin/support" className="relative">
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center hover:bg-blue-100 transition-colors">
                  <Headphones className="h-4 w-4 text-blue-500" />
                </div>
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {openTickets > 9 ? '9+' : openTickets}
                </span>
              </Link>
            )}
            {pendingReports > 0 && (
              <Link href="/admin/reports" className="relative">
                <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center hover:bg-red-100 transition-colors">
                  <Flag className="h-4 w-4 text-red-500" />
                </div>
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingReports > 9 ? '9+' : pendingReports}
                </span>
              </Link>
            )}
            <div className="h-8 w-px bg-border" />
            <Avatar className="h-8 w-8">
              <AvatarImage src={admin?.avatar_url ?? ''} />
              <AvatarFallback className="bg-violet-700 text-white text-xs">
                {admin?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-7xl mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
