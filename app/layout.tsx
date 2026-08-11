import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { SplashIntro } from '@/components/splash-intro'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SkillSwap — Exchange Skills, Grow Together',
  description:
    'Connect with people who can teach what you want to learn, and teach what they want to know. Pure skill barter.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets content extend under the iOS notch/home-indicator so
  // env(safe-area-inset-*) actually resolves to a real value instead of 0 —
  // required for the bottom nav's safe-area spacer to do anything on iPhone.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#050505' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SplashIntro />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
