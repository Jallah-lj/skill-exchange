# SkillSwap — Security Model

_Last reviewed: July 12, 2026_

## Layers of defense

### 1. Middleware (`proxy.ts`) — the front gate
- Refreshes the Supabase session on every request.
- Redirects unauthenticated users away from all protected prefixes:
  `/browse /matches /sessions /dashboard /profile /chat /settings /admin /support`.
- Enforces account status **on every request**: `suspended`, `disabled`, `banned`, and
  `locked_until` accounts are force-signed-out and bounced to `/login?blocked=<reason>`.
- `/admin/*` additionally requires `profiles.role = 'admin'` (checked in the database,
  not from the client).

### 2. Row Level Security — the real wall
Every table has RLS enabled. The middleware and UI are conveniences; **RLS is the actual
security boundary**. Patterns used:
- Own-row access: `auth.uid() = user_id` (tickets, notifications, saved posts…)
- Participant access: membership subqueries (messages visible only to the two matched users;
  support messages to ticket owner + admins)
- Role escalation: `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`

When adding a table: create it in a dated file in `lib/supabase/migrations/`, enable RLS
in the same file, and use `DROP POLICY IF EXISTS` before every `CREATE POLICY`
(policies are not idempotent otherwise).

### 3. API routes — server-side re-verification
Every route under `app/api/` calls `supabase.auth.getUser()` and returns 401/403 before
doing anything. Admin routes re-check `role = 'admin'` from the database. The service-role
client (`lib/supabase/admin.ts`) is only ever constructed server-side, only after an
admin check has passed.

### 4. Uploads
- Support attachments: strict allowlist (`lib/support-attachments.ts`) — images, PDF, Word,
  logs, video only, with per-type size caps and MIME/extension cross-check.
  **Executables are rejected outright** — there is no AV scanning service, so nothing
  executable is ever accepted.
- KYC documents go to the restricted `kyc-docs` bucket, fetched for admins through an
  authenticated API route — never a public URL.

## Operational rules

1. **Never** prefix the service-role key with `NEXT_PUBLIC_`.
2. Never call `lib/supabase/admin.ts` from a file with `'use client'`.
3. Force-logout is implemented as password rotation (`updateUserById(id, { password: randomUUID() })`)
   because GoTrue has no revoke-by-user-id — don't "fix" it back to `admin.signOut(userId)`,
   which takes a JWT, not a user id.
4. Account deletion relies on `profiles.id REFERENCES auth.users ON DELETE CASCADE` —
   deleting the auth user is sufficient; don't add manual profile deletes (racy).
5. When a page shows "No X found" unexpectedly, check the Supabase `error` object before
   assuming empty data — silent failures have twice hidden missing tables and ambiguous
   FK embeds in this project.

## Incident response quick reference

| Situation | Action |
|---|---|
| Compromised user account | Admin console → user → Force Logout + Reset Password |
| Abusive user | Admin console → Suspend (temporary) or Ban (permanent); middleware enforces immediately |
| Leaked service-role key | Rotate in Supabase dashboard → Settings → API, update Vercel env, redeploy |
| Bad content | Admin → Content/Reports → remove + notify via the notification system |
