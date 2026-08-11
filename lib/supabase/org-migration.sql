-- ── Organization System v2 Migration ─────────────────────────────────────────
-- Run this in Supabase SQL Editor. Safe to run multiple times.

-- ── 1. Extend organizations table ────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS category     text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email        text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country      text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city         text;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS visibility   text DEFAULT 'public';
DO $$ BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_visibility_check;
  ALTER TABLE organizations ADD CONSTRAINT organizations_visibility_check
    CHECK (visibility IN ('public', 'private', 'hidden'));
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS membership_type text DEFAULT 'open';
DO $$ BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_membership_type_check;
  ALTER TABLE organizations ADD CONSTRAINT organizations_membership_type_check
    CHECK (membership_type IN ('open', 'request', 'invitation'));
EXCEPTION WHEN others THEN NULL; END $$;

-- Unique 8-char invite code (e.g. SKL-TECH-4591)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_code     text UNIQUE;
-- Auto-join anyone whose email ends with this domain (e.g. "mit.edu")
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email_domain text;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verification_level text DEFAULT 'none';
DO $$ BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_verification_level_check;
  ALTER TABLE organizations ADD CONSTRAINT organizations_verification_level_check
    CHECK (verification_level IN ('none', 'basic', 'standard'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 2. Extend organization_members roles ──────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
  ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'moderator', 'instructor', 'member'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 3. Join requests table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_join_requests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  message         text,
  skills          text,
  experience      text,
  status          text DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'declined')),
  reviewed_by     uuid REFERENCES profiles ON DELETE SET NULL,
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE organization_join_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_join_requests' AND policyname = 'Users can view own join requests') THEN
    CREATE POLICY "Users can view own join requests" ON organization_join_requests
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_join_requests' AND policyname = 'Users can submit join requests') THEN
    CREATE POLICY "Users can submit join requests" ON organization_join_requests
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_join_requests' AND policyname = 'Org admins can view join requests') THEN
    CREATE POLICY "Org admins can view join requests" ON organization_join_requests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_id = organization_join_requests.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_join_requests' AND policyname = 'Org admins can update join requests') THEN
    CREATE POLICY "Org admins can update join requests" ON organization_join_requests
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM organization_members
          WHERE organization_id = organization_join_requests.organization_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_join_requests' AND policyname = 'Users can cancel own requests') THEN
    CREATE POLICY "Users can cancel own requests" ON organization_join_requests
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Helper: generate a random org code ────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_org_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'SKL-' ||
    UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4)) || '-' ||
    LPAD(FLOOR(RANDOM() * 9999 + 1000)::text, 4, '0');
$$;

-- Back-fill existing orgs that have no org_code
UPDATE organizations SET org_code = generate_org_code() WHERE org_code IS NULL;

-- ── 5. Ensure INSERT RLS for organization_members allows join ─────────────────
-- (idempotent: checks by policyname before creating)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Users can join orgs') THEN
    CREATE POLICY "Users can join orgs" ON organization_members
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
