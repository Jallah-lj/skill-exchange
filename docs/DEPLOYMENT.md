# SkillSwap — Deployment Guide

## 1. Database (Supabase)

Apply, in the SQL Editor of the **production** project, in order:

1. `lib/supabase/schema.sql` — base schema (only on a fresh project)
2. `lib/supabase/org-migration.sql` and the other org migration files
3. Every file in `lib/supabase/migrations/` in date order — all are idempotent
   (safe to re-run)

Then create Storage buckets (Dashboard → Storage):

| Bucket | Public |
|---|---|
| `avatars` | ✅ |
| `covers` | ✅ |
| `attachments` | per your chat setup (shared by chat + support tickets) |
| `kyc-docs` | ❌ never public |

Uncomment and run the storage policies at the bottom of `schema.sql`.

## 2. Auth configuration

- Site URL → `https://your-domain.com`
- Redirect URLs → add `https://your-domain.com/**`
- Enable Google provider (if using Google sign-in) with production OAuth credentials
- Customize email templates (confirmation, password reset)

## 3. Vercel

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only, no NEXT_PUBLIC_ prefix
```

Push to the repo's main branch or `vercel --prod`. The build must pass
`npm run build` locally first.

## 4. First admin

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<your-auth-user-id>';
```

## 5. Post-deploy smoke test

1. Sign up a fresh account → onboarding → profile
2. Create a post on /home, mention someone, check the notification
3. Send + accept a match request, exchange a chat message + attachment
4. Open a support ticket, reply from /admin/support, resolve, confirm + rate
5. Suspend the test user from admin → confirm they're immediately signed out
6. Delete the test account from Settings
