import { Navbar } from '@/components/navbar'
import { AppSidebar } from '@/components/ui/sidebar'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { QuickSearch } from '@/components/quick-search'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ── Mobile layout ──────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Sticky top bar — includes the global search (Navbar) */}
        <Navbar />

        {/* Page content — pb accounts for bottom nav + safe area */}
        <main className="flex-1 w-full min-w-0 max-w-2xl mx-auto overflow-x-clip px-4 py-6 pb-[calc(60px+env(safe-area-inset-bottom)+16px)]">
          {children}
        </main>

        {/* Professional bottom tab bar */}
        <MobileBottomNav />
      </div>

      {/* ── Desktop layout ─────────────────────────────────────────────── */}
      <div className="hidden md:flex h-screen w-screen flex-row">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden ml-[3.05rem]">
          {/* Sticky top bar — the single global search entry point, on every page */}
          <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b bg-background/90 px-6 backdrop-blur-md">
            <QuickSearch className="w-full max-w-md" />
          </div>
          <main className="flex-1 overflow-auto py-8 px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
