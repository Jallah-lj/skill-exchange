import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must be called before any redirect logic
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const authOnlyPaths = ['/', '/login', '/signup']
  const protectedPrefixes = [
    '/browse', '/matches', '/sessions', '/dashboard',
    '/profile', '/chat', '/settings', '/admin', '/support',
  ]

  // Redirect helper that carries over any cookies the Supabase client staged
  // on supabaseResponse (e.g. a cleared session from signOut() below).
  const redirectWithCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  let profile: {
    role: string
    suspended: boolean
    disabled: boolean
    banned: boolean
    locked_until: string | null
  } | null = null

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, suspended, disabled, banned, locked_until')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const isLocked = !!profile?.locked_until && new Date(profile.locked_until) > new Date()
  const isBlocked = !!profile && (profile.banned || profile.disabled || profile.suspended || isLocked)

  // Account is banned / disabled / locked / suspended — kill the session and bounce out.
  if (user && isBlocked && pathname !== '/login') {
    await supabase.auth.signOut()
    const reason = profile!.banned ? 'banned' : profile!.disabled ? 'disabled' : isLocked ? 'locked' : 'suspended'
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('blocked', reason)
    return redirectWithCookies(loginUrl)
  }

  // Logged-in (and not blocked) users shouldn't see the landing/auth pages
  if (user && !isBlocked && authOnlyPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/browse', request.url))
  }

  // Protected app routes — send unauthenticated users to login
  if (!user && protectedPrefixes.some((p) => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes — check role in DB
  if (user && !isBlocked && pathname.startsWith('/admin')) {
    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/browse', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
  ],
}
