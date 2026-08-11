# SkillSwap — Architecture

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React, TypeScript, Tailwind CSS |
| UI primitives | Base UI (`@base-ui/react`) — **not Radix**: use `render`/`nativeButton`, never `asChild` |
| Backend | Supabase — Postgres, Auth (GoTrue), Storage, Edge Functions (Deno) |
| Auth transport | Cookie-based sessions via `@supabase/ssr` |
| Hosting | Vercel (app) + Supabase cloud (data) |

## Request flow

```
Browser ──► proxy.ts (middleware)          gate: session refresh, account-status
                │                          enforcement, route protection, admin role
                ▼
        App Router page (mostly client components)
                │
                ├──► supabase-js (anon key) ──► PostgREST ──► RLS-protected tables
                │
                └──► /api/* route handlers ──► auth re-check ──► service-role client
                                                                (admin operations only)
```

Two data paths exist deliberately:
1. **Direct from the client** with the anon key — safe because RLS is the boundary.
2. **API routes** for anything needing the service-role key (admin user management,
   KYC document access) — always after a server-side role check.

## Directory map

```
app/
  page.tsx            landing (public)
  (auth)/             login, signup, forgot/reset password
  (legal)/            terms, privacy, guidelines (public)
  (main)/             the member app (Navbar/Sidebar layout)
  admin/              admin console (own layout + role gate)
  api/                route handlers (admin ops, posts, orgs, health)
  auth/callback/      OAuth code exchange
components/           shared components; ui/ = design-system primitives
lib/                  clients, types (schema source of truth), pure logic
lib/supabase/migrations/  dated SQL, run manually in Supabase SQL Editor
supabase/functions/   Deno edge functions (excluded from Next typecheck)
docs/                 this documentation
proxy.ts              Next.js middleware (this project's middleware.ts)
```

## Navigation surfaces (important!)

There are **four independent nav components** — a link added to one does not appear
in the others. When changing navigation, update all that apply:

1. `components/navbar.tsx` — mobile top bar (`md:hidden`)
2. `components/mobile-bottom-nav.tsx` — mobile bottom tabs
3. `components/ui/sidebar.tsx` (`AppSidebar`) — desktop sidebar (`hidden md:flex`)
4. `app/admin/layout.tsx` — admin console sidebar

## Schema source of truth

The live database has drifted from `schema.sql`. Treat `lib/types.ts` as the schema
reference and apply changes only through new dated files in `lib/supabase/migrations/`.
All migrations must be idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` before
`CREATE POLICY`).

## Key conventions

- Toasts via `sonner`; icons via `lucide-react`.
- Every Supabase query's `error` must be checked — silent failures have repeatedly
  masked missing tables and ambiguous FK embeds (see docs/TROUBLESHOOTING.md).
- Tables with two FKs to `profiles` need explicit embed hints:
  `profiles!<table>_<column>_fkey(...)`.
- `Select.onValueChange` receives `string | null` — always null-guard before setState.
