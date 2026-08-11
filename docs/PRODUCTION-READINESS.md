# SkillSwap — Production Readiness

_Audit date: July 12, 2026_

## Status summary

| Area | Status |
|---|---|
| API route authentication | ✅ All 12 API routes verify auth; admin routes verify `role = 'admin'` |
| Row Level Security | ✅ Every table created in `lib/supabase/migrations/` enables RLS with policies |
| Secrets hygiene | ✅ `.env.local` git-ignored, never committed; service-role key used only server-side (`lib/supabase/admin.ts`) |
| XSS vectors | ✅ No `dangerouslySetInnerHTML` anywhere |
| Middleware protection | ✅ `proxy.ts` gates all protected prefixes, enforces suspended/banned/disabled/locked accounts |
| TypeScript errors | ✅ 0 in app code (3 remain in root-owned files — see "Blocked items") |
| 404 / error pages | ✅ `app/not-found.tsx`, `app/error.tsx` |
| Legal pages | ✅ `/terms`, `/privacy`, `/guidelines` + signup consent + footer links |
| PWA | ✅ `app/manifest.ts`, icons (192/512/apple), `app/robots.ts` |
| Dead code | ✅ Removed unused `MobileFloatingNav` |

## Blocked items (need your action)

1. **Root-owned files** — 16 files/dirs are owned by root (leftover sudo). Two need code fixes
   that are already known:
   ```bash
   sudo chown -R jallah:jallah ~/Desktop/Today/skill-exchange
   ```
   Then fix remaining 3 TS errors in:
   - `app/(main)/orgs/invite/[id]/page.tsx` (2× `asChild` → `nativeButton={false} render={...}`)
   - `app/onboarding/page.tsx` (Select `onValueChange` null guard at line 174)

2. **Pending SQL migrations** — run any not-yet-applied files from `lib/supabase/migrations/`
   in the Supabase SQL Editor (see `docs/DEPLOYMENT.md` §Database).

## Pre-launch checklist

- [ ] Run `npm run build` locally — must complete with no errors
- [ ] All migrations applied to the production Supabase project (not just dev)
- [ ] Supabase Storage buckets exist: `avatars`, `attachments`, `covers`, `kyc-docs` (+ org buckets)
- [ ] Environment variables set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set as **server-only** (no `NEXT_PUBLIC_` prefix) — never expose it
- [ ] Supabase Auth: set Site URL + redirect URLs to the production domain
- [ ] Email templates (confirm signup, reset password) customized in Supabase Auth settings
- [ ] Create at least one admin: `UPDATE profiles SET role = 'admin' WHERE id = '<your-user-id>';`
- [ ] Test the blocked-account flow (suspend a test user, confirm they're signed out and blocked)
- [ ] Test account deletion end-to-end with a test user
- [ ] Lighthouse pass on `/` (landing) — aim for 90+ performance/accessibility

## Known non-blocking notes

- `supabase/functions/` (Deno edge functions) are excluded from the Next.js typecheck —
  they run in Deno, not Node, and are checked by Supabase's own tooling on deploy.
- The `posts` admin Content system, Support Center, satisfaction ratings, and attachments all
  depend on migrations dated 2026-07-11 — confirm all are applied before launch.
- `public/logo.png` has a dark background baked in; a transparent export would look better on
  the light theme (swap the same file, no code change needed).
