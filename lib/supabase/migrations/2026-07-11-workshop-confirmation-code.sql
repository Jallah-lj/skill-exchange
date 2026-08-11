-- ── Workshop Registration Confirmation Codes ────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Adds a short human-readable code to each workshop registration so
-- registrants and organizers have something to identify/check in with.

ALTER TABLE workshop_attendees
  ADD COLUMN IF NOT EXISTS confirmation_code text UNIQUE
    DEFAULT upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

-- Backfill any existing rows created before this column existed
UPDATE workshop_attendees
SET confirmation_code = upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8))
WHERE confirmation_code IS NULL;
