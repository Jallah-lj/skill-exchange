import Link from 'next/link'
import { LogoMark } from '@/components/logo'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <LogoMark className="h-6" />
            SkillSwap
          </Link>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/guidelines" className="hover:text-foreground">Guidelines</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <article className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-4">
          {children}
        </article>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SkillSwap · <Link href="/support" className="hover:text-foreground">Contact Support</Link>
      </footer>
    </div>
  )
}
