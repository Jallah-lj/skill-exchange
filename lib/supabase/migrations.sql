-- Run this in Supabase SQL Editor (safe to run multiple times)

-- ── Verification applications ───────────────────────────────
-- Stores user-submitted KYC applications (one row per user, upserted on re-apply)
CREATE TABLE IF NOT EXISTS kyc_applications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL UNIQUE,
  full_name       text NOT NULL,
  id_type         text NOT NULL CHECK (id_type IN ('passport', 'national_id', 'drivers_license', 'school_id', 'other')),
  document_url    text,
  reason          text NOT NULL,
  notable_work    text,
  social_links    jsonb DEFAULT '{}'::jsonb,
  status          text DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  auto_approved   boolean DEFAULT false,
  reviewed_by     uuid REFERENCES profiles,
  reviewed_at     timestamptz,
  rejection_reason text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE kyc_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_applications' AND policyname = 'Users can view own application') THEN
    CREATE POLICY "Users can view own application" ON kyc_applications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_applications' AND policyname = 'Users can submit application') THEN
    CREATE POLICY "Users can submit application" ON kyc_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_applications' AND policyname = 'Admins can view all applications') THEN
    CREATE POLICY "Admins can view all applications" ON kyc_applications FOR SELECT
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyc_applications' AND policyname = 'Admins can update applications') THEN
    CREATE POLICY "Admins can update applications" ON kyc_applications FOR UPDATE
      USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

-- If kyc_applications already existed without school_id in the CHECK, run this to add it:
DO $$ BEGIN
  ALTER TABLE kyc_applications DROP CONSTRAINT IF EXISTS kyc_applications_id_type_check;
  ALTER TABLE kyc_applications ADD CONSTRAINT kyc_applications_id_type_check
    CHECK (id_type IN ('passport', 'national_id', 'drivers_license', 'school_id', 'other'));
EXCEPTION WHEN others THEN NULL; END $$;

-- Also create the kyc-docs storage bucket (run manually in Supabase dashboard if preferred):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-docs', 'kyc-docs', false) ON CONFLICT DO NOTHING;

-- Storage policies for kyc-docs (private bucket)
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can upload own KYC document') THEN
--     CREATE POLICY "Users can upload own KYC document" ON storage.objects FOR INSERT
--       WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
--   END IF;
--   IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can read KYC documents') THEN
--     CREATE POLICY "Admins can read KYC documents" ON storage.objects FOR SELECT
--       USING (bucket_id = 'kyc-docs' AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
--   END IF;
-- END $$;

-- Feature 1: Read receipts
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Recipients can mark messages read'
  ) THEN
    CREATE POLICY "Recipients can mark messages read" ON messages FOR UPDATE
      USING (
        auth.uid() != sender_id AND
        EXISTS (
          SELECT 1 FROM match_requests mr
          WHERE mr.id = match_id
          AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
        )
      )
      WITH CHECK (true);
  END IF;
END $$;

-- Feature 6: Skill endorsements
CREATE TABLE IF NOT EXISTS endorsements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endorser_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  endorsee_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  skill_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (endorser_id, endorsee_id, skill_name)
);

ALTER TABLE endorsements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'endorsements' AND policyname = 'Endorsements are public') THEN
    CREATE POLICY "Endorsements are public" ON endorsements FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'endorsements' AND policyname = 'Users can endorse others') THEN
    CREATE POLICY "Users can endorse others" ON endorsements FOR INSERT WITH CHECK (auth.uid() = endorser_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'endorsements' AND policyname = 'Users can remove own endorsements') THEN
    CREATE POLICY "Users can remove own endorsements" ON endorsements FOR DELETE USING (auth.uid() = endorser_id);
  END IF;
END $$;

-- Feature 7: Reports and blocks
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  reported_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can create reports') THEN
    CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can view own reports') THEN
    CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blocks' AND policyname = 'Users can manage own blocks') THEN
    CREATE POLICY "Users can manage own blocks" ON blocks FOR ALL USING (auth.uid() = blocker_id);
  END IF;
END $$;

-- Phone verification columns (safe to run if already exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- ── Organizations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  bio                   text,
  avatar_url            text,
  website               text,
  is_verified           boolean DEFAULT false,
  internal_only_swapping boolean DEFAULT false,
  owner_id              uuid REFERENCES profiles ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  role            text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by      uuid REFERENCES profiles ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  email           text NOT NULL,
  inviter_id      uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  role            text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status          text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at      timestamptz DEFAULT now() + interval '7 days',
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, email)
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is owner/admin of an org WITHOUT triggering RLS recursion.
-- SECURITY DEFINER means it runs as the function owner (bypasses RLS on organization_members).
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

DO $$ BEGIN
  -- Organizations: anyone can read, members can update, owner creates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Organizations are public') THEN
    CREATE POLICY "Organizations are public" ON organizations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Authenticated users can create organizations') THEN
    CREATE POLICY "Authenticated users can create organizations" ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Org admins can update') THEN
    CREATE POLICY "Org admins can update" ON organizations FOR UPDATE
      USING (is_org_admin(id));
  END IF;

  -- Members: public read, admins manage (use helper to avoid self-referencing recursion)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Members are public') THEN
    CREATE POLICY "Members are public" ON organization_members FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Org admins can manage members') THEN
    CREATE POLICY "Org admins can manage members" ON organization_members FOR ALL
      USING (is_org_admin(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_members' AND policyname = 'Users can join orgs') THEN
    CREATE POLICY "Users can join orgs" ON organization_members FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Invites: org admins manage
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_invites' AND policyname = 'Org admins can manage invites') THEN
    CREATE POLICY "Org admins can manage invites" ON organization_invites FOR ALL
      USING (is_org_admin(organization_invites.organization_id));
  END IF;
END $$;
