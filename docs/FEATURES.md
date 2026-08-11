# SkillSwap — Feature Map

_Last updated: July 12, 2026_

## Member-facing

| Route | Feature |
|---|---|
| `/` | Landing page (public) with testimonials, categories, legal footer |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth (email + Google), terms consent on signup, blocked-account messaging |
| `/onboarding` | First-run profile setup |
| `/home` | Community feed — create posts (multi-image), like/comment/save, @mentions |
| `/browse` | Discover members by skills taught/wanted |
| `/matches` | Match requests + accepted matches |
| `/chat/[matchId]` | 1:1 chat — text, attachments, voice messages |
| `/sessions` | Scheduled skill sessions + registered org workshops (confirmation codes) |
| `/sessions/[id]/room` | Live session room — notes, shared code editor |
| `/dashboard` | Personal overview; `/dashboard/analytics` for growth stats |
| `/profile` | Own profile — skills, username (@mention handle), avatar, endorsements, content analytics |
| `/profile/[id]` | Public profile view |
| `/orgs` | Organizations — create, join by code/invite, org feed, workshops, org dashboard |
| `/resources` | Published platform content (articles/announcements/guides from admin Content) |
| `/saved` | Saved posts |
| `/support` | Support Center — tickets with categories, chat-style thread, attachments, resolution confirmation + star rating |
| `/verify` | Identity verification (KYC document upload) |
| `/settings` | Account, appearance, notifications, account deletion |
| `/terms`, `/privacy`, `/guidelines` | Legal & policy pages (public) |

## Cross-cutting systems

- **Notifications** — bell panel on mobile navbar + desktop sidebar; types cover matches,
  mentions, badges, KYC, account status, role changes, reports, announcements, warnings,
  support replies.
- **@Mentions** — `@username` in posts/comments autocompletes, links to profile, notifies.
- **Badges** — awarded by admins or auto-award API; verified badge synced with KYC status.
- **Splash intro** — once-per-session animated brand reveal (`components/splash-intro.tsx`).
- **PWA** — installable; manifest + icons wired.

## Admin console (`/admin`)

| Route | Feature |
|---|---|
| `/admin` | Overview dashboard |
| `/admin/users` | User management; per-user page: suspend/disable/lock/ban (middleware-enforced), force logout, reset password, role, badges, KYC |
| `/admin/orgs` | Organization management |
| `/admin/swaps`, `/admin/sessions` | Exchange + session oversight |
| `/admin/trust`, `/admin/reports` | Trust & Safety — reports with reporter/reported notifications |
| `/admin/verification` | KYC review (approve/reject syncs verified badge) |
| `/admin/content` | Content Management — create/publish articles to `/resources` |
| `/admin/support` | Support Center — ticket queue, chat replies, attachments, auto-assign, Analytics tab (response/resolution times, categories, top bugs, agent performance, satisfaction) |
| `/admin/announcements`, `/admin/notifications` | Broadcast + targeted notifications |
| `/admin/growth`, `/admin/activity`, `/admin/security` | Campaigns, activity log, security events |
| `/admin/roles`, `/admin/settings` | Role + platform settings |

## Database

Live schema = `lib/types.ts` (source of truth) + dated migrations in `lib/supabase/migrations/`
run manually in the Supabase SQL Editor. `schema.sql` is historical — do not trust it alone
(known drift).
