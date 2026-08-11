-- ── Browse / Profile Discovery Migration ───────────────────────────────────
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- Professional headline (e.g. "Full Stack Developer | MIT")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headline text;

-- Availability status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability text DEFAULT 'available';
DO $$ BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_availability_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_availability_check
    CHECK (availability IN ('available', 'busy', 'unavailable'));
EXCEPTION WHEN others THEN NULL; END $$;

-- Networking intentions (e.g. '{"Looking for Mentor","Hiring"}')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS intents text[] DEFAULT '{}';
