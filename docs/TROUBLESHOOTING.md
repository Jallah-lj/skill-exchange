# SkillSwap — Troubleshooting

Recurring failure patterns in this codebase and their proven fixes. Check here
before debugging from scratch — most of these have bitten more than once.

## "No X found" but the data exists
**Cause A — the table was never created.** Several admin pages were built against
tables no migration created (`posts`, `support_tickets`). An unchecked Supabase
`error` makes that look like an empty list.
**Fix:** check `error` in every query; if the table is missing, add a dated migration.

**Cause B — ambiguous FK embed.** A table with two FKs to `profiles`
(e.g. `support_tickets.user_id` + `assigned_to`) makes `profiles(name)` ambiguous;
PostgREST errors and the page shows empty.
**Fix:** disambiguate: `profiles!support_tickets_user_id_fkey(name)`.

## "Could not find the '<column>' column ... in the schema cache"
The migration adding that column hasn't been run on the live database. Run the
relevant file from `lib/supabase/migrations/` in the Supabase SQL Editor.

## `policy "..." already exists` when re-running migrations
`CREATE POLICY` is not idempotent. Every policy needs
`DROP POLICY IF EXISTS "<name>" ON <table>;` immediately before it.

## Check-constraint violation after changing an enum-style CHECK
Order matters: **drop the old constraint first**, then `UPDATE` old values to new
ones, then add the new constraint. Updating first fails because the old constraint
still rejects the new values.

## `asChild` TypeError / unknown prop
This project's `Button` wraps **Base UI**, not Radix. Replace
`<Button asChild><Link .../></Button>` with
`<Button nativeButton={false} render={<Link ... />}>children</Button>`.

## Select state becomes null / type error on onValueChange
Base UI's `Select.onValueChange` passes `string | null`.
Always guard: `onValueChange={(v) => { if (v) setState(v) }}`.

## Force logout: "invalid JWT: token is malformed"
`auth.admin.signOut()` takes a session JWT, not a user id. The supported approach
is password rotation: `admin.updateUserById(userId, { password: randomUUID() })`.

## Dialog/content flickers or "shakes"
A component defined inside another component's render body remounts every render
(worst with any interval-driven state in the parent). Hoist it to module scope.

## Nav link "missing" for some users
Four independent nav components exist (mobile navbar, mobile bottom tabs, desktop
sidebar, admin sidebar). Verify which one the reporter is actually seeing.

## Build fails with EACCES on .next/
Files owned by root from an old sudo run:
`sudo chown -R <user>:<user> <project-dir>`.
