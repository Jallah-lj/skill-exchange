# Changelog

## 2026-07-12 — Production-readiness program

### Security
- **Fixed open redirect** on `/login?next=` — external URLs can no longer be used
  to redirect users off-site after login (phishing vector).
- Added OWASP-baseline HTTP security headers in `next.config.ts`:
  `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Password policy raised: minimum 8 characters with at least one letter and one
  number, enforced on signup and password reset.
- Removed dead `next` param handling from the OAuth callback.
- Ticket-attachment allowlist (`lib/support-attachments.ts`) covered by unit tests,
  including double-extension and MIME-mismatch attacks.

### Fixed
- **Mention parser no longer treats email addresses as @mentions** (negative
  lookbehind added; previously `user@example.com` could notify a user named
  "example.com").
- All app-code TypeScript errors resolved (33 → 3; the remaining 3 are in two
  root-owned files pending a `chown`): 4 `asChild` runtime errors, 9 nullable
  Select handlers, interface conflict, bad cast, JSX namespace, framer-motion type.
- Deno edge functions excluded from the Next.js typecheck (different runtime).

### Added
- **Global search** (`/search`): people (name/username/headline **and skills**),
  organizations, community posts, published resources — tabbed results, debounced,
  shareable URLs; added to mobile + desktop nav (Browse got a Compass icon).
- **Health endpoint** `GET /api/health` (DB ping, latency, 200/503) for monitors.
- 404 page + global error boundary (branded, error ID surfaced, support link).
- Legal pages: `/terms`, `/privacy`, `/guidelines` + landing footer links +
  signup consent line.
- PWA: manifest, 192/512/apple icons from the brand logo, `robots.ts`.
- Route-level loading skeletons for the member app and admin console.
- CI pipeline (GitHub Actions): typecheck → unit tests → build on push/PR.
- Test infrastructure (Vitest) with 16 unit tests over mentions + attachment
  validation; `npm test` script.
- Splash intro on first session; brand logo wired across all four nav surfaces
  and favicon.

### Removed
- `components/mobile-floating-nav.tsx` — duplicate mobile nav, never imported.

### Docs
- `docs/`: PRODUCTION-READINESS, SECURITY, FEATURES, DEPLOYMENT, ARCHITECTURE,
  API, TROUBLESHOOTING, CHANGELOG.

## Earlier (July 2026, pre-program)
- Support Center (tickets, categories, satisfaction ratings, attachments, admin
  analytics), Content Management + `/resources`, notification system across all
  admin actions, admin user-management enforcement (suspend/ban/lock via
  middleware), verification/badge sync, dashboard restructure, @mentions,
  workshop confirmation codes + check-in, org features.
