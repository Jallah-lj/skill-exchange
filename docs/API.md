# SkillSwap — API Reference

All routes live under `app/api/`. Every route authenticates via the caller's session
cookie; admin routes additionally verify `profiles.role = 'admin'` server-side.
Responses are JSON; failures return `{ error }` with 401/403/4xx/500.

## Public

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness + DB connectivity for uptime monitors. 200 ok / 503 degraded. No auth (exposes no data). |

## Member

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/posts/feed` | Published community feed with like/bookmark/comment counts |
| POST | `/api/posts/actions` | Like/unlike, bookmark/unbookmark, view tracking |
| GET/POST | `/api/posts/comments` | Read/create post comments |
| GET | `/api/posts/saved` | Caller's bookmarked posts |
| POST | `/api/orgs/invite` | Send org invitation (requires org owner/admin) |
| POST | `/api/verify/apply` | Submit KYC verification application |

## Admin (role-gated)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/admin/users` | User listing/management data |
| POST/DELETE | `/api/admin/users/[userId]` | `reset-password`, `force-logout` (password rotation), delete account |
| GET | `/api/admin/kyc-document` | Signed access to KYC docs (never public URLs) |
| GET/POST | `/api/admin/orgs` | Organization management |
| POST | `/api/admin/trust-scores` | Recompute trust scores |
| POST | `/api/badges/auto-award` | Run badge auto-award rules |

## Everything else

All other reads/writes go **directly from the client** to Supabase via the anon key.
That is intentional: Row Level Security is the authorization layer. See
docs/SECURITY.md before adding new tables or changing policies.

## Adding a new API route — checklist

1. `supabase.auth.getUser()` → 401 if absent.
2. Role/ownership check → 403 if insufficient.
3. Validate body fields explicitly; never spread `body` into a DB call (mass assignment).
4. Service-role client only after the checks, only if RLS can't express the rule.
5. Return specific error messages; log unexpected errors server-side.
