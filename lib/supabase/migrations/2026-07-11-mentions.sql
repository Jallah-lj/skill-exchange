-- ── @Mentions (users & organizations) ───────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Lets posts/comments @mention a user (by a new unique username handle) or an
-- organization (by its existing unique slug), rendered as a link + notified.

-- 1. Unique, stable handle for users (organizations already have `slug`)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Backfill existing users: derive from name, lowercase alnum, de-duplicate with a numeric suffix
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM profiles WHERE username IS NULL LOOP
    base := lower(regexp_replace(coalesce(r.name, 'user'), '[^a-zA-Z0-9]+', '', 'g'));
    IF base = '' THEN base := 'user'; END IF;
    candidate := base;
    n := 0;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = candidate) LOOP
      n := n + 1;
      candidate := base || n::text;
    END LOOP;
    UPDATE profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;

-- 2. Helper so new signups also get a username automatically
CREATE OR REPLACE FUNCTION public.generate_username(p_name text)
RETURNS text AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(p_name, 'user'), '[^a-zA-Z0-9]+', '', 'g'));
  IF base = '' THEN base := 'user'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- 3. Wire it into the existing signup trigger (replaces the function body only;
--    the "on_auth_user_created" trigger already points at this function name)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );
  INSERT INTO public.profiles (id, name, avatar_url, username)
  VALUES (
    NEW.id,
    v_name,
    NEW.raw_user_meta_data->>'avatar_url',
    generate_username(v_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
