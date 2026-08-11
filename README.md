# SkillSwap

A skill-exchange platform: teach what you know, learn what you love. Members match
for barter-style skill trades — no money, no credits — with sessions, chat,
organizations, workshops, and a full admin console.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind · Base UI · Supabase
(Postgres + Auth + Storage, RLS-first security)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev                  # http://localhost:3000
```

Required environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only; never expose to the client
```

Database setup: apply `lib/supabase/schema.sql`, then every file in
`lib/supabase/migrations/` in date order, in the Supabase SQL Editor.
Full steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npx tsc --noEmit` | Typecheck |

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, request flow, directory map, conventions |
| [docs/FEATURES.md](docs/FEATURES.md) | Complete feature map (member + admin) |
| [docs/API.md](docs/API.md) | API routes + new-route checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model, operational rules, incident response |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase + Vercel deployment |
| [docs/PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) | Audit status + pre-launch checklist |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Known failure patterns + fixes |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change history |

## Contributing notes

- `lib/types.ts` is the schema source of truth; the live DB has drifted from `schema.sql`.
- New tables: dated SQL file in `lib/supabase/migrations/`, RLS enabled in the same file,
  `DROP POLICY IF EXISTS` before every `CREATE POLICY`.
- This project uses **Base UI**, not Radix: `nativeButton={false} render={...}`, never `asChild`.
- Four separate nav components exist — see docs/ARCHITECTURE.md before touching navigation.
