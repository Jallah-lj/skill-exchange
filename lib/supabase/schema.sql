-- ============================================================
-- SkillSwap — Complete Database Schema
-- Safe to paste into Supabase SQL Editor (fresh setup)
-- Drops everything first, then recreates clean
-- ============================================================


-- ── 1. Drop existing objects ─────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

DROP TABLE IF EXISTS organization_invites CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations          CASCADE;
DROP TABLE IF EXISTS user_badges    CASCADE;
DROP TABLE IF EXISTS notifications  CASCADE;
DROP TABLE IF EXISTS blocks         CASCADE;
DROP TABLE IF EXISTS reports        CASCADE;
DROP TABLE IF EXISTS endorsements   CASCADE;
DROP TABLE IF EXISTS reviews        CASCADE;
DROP TABLE IF EXISTS session_notes  CASCADE;
DROP TABLE IF EXISTS sessions       CASCADE;
DROP TABLE IF EXISTS messages       CASCADE;
DROP TABLE IF EXISTS match_requests CASCADE;
DROP TABLE IF EXISTS user_skills    CASCADE;
DROP TABLE IF EXISTS profiles       CASCADE;


-- ── 2. Core tables ───────────────────────────────────────────

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id                      uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name                    text NOT NULL,
  bio                     text,
  avatar_url              text,
  location                text,
  phone                   text,

  -- Onboarding
  onboarding_completed    boolean DEFAULT false,

  -- Roles & account status
  role                    text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  suspended               boolean DEFAULT false,
  disabled                boolean DEFAULT false,
  banned                  boolean DEFAULT false,
  banned_reason           text,
  banned_at               timestamptz,
  locked_until            timestamptz,
  lock_reason             text,

  -- Verification
  phone_verified          boolean DEFAULT false,
  identity_verified       boolean DEFAULT false,
  kyc_status              text DEFAULT 'unverified'
                            CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  kyc_rejection_reason    text,

  -- Privacy & notification preferences
  hide_location           boolean DEFAULT false,
  appear_offline          boolean DEFAULT false,
  profile_visibility      text DEFAULT 'public' CHECK (profile_visibility IN ('public', 'matched_only')),
  notify_match_request    boolean DEFAULT true,
  notify_new_message      boolean DEFAULT true,
  notify_session_reminder boolean DEFAULT true,

  created_at              timestamptz DEFAULT now()
);


-- Skills
CREATE TABLE user_skills (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  skill_name  text NOT NULL,
  category    text NOT NULL,
  type        text CHECK (type IN ('teach', 'learn')) NOT NULL,
  level       text CHECK (level IN ('Beginner', 'Intermediate', 'Expert')),
  description text,
  created_at  timestamptz DEFAULT now()
);


-- Match requests
CREATE TABLE match_requests (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id  uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  to_user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  status        text CHECK (status IN ('pending', 'accepted', 'declined', 'unmatched')) DEFAULT 'pending',
  unmatched_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);


-- Messages (supports attachments + soft delete)
CREATE TABLE messages (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id         uuid REFERENCES match_requests ON DELETE CASCADE NOT NULL,
  sender_id        uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content          text,
  attachment_url   text,
  attachment_type  text CHECK (attachment_type IN ('image', 'file', 'audio')),
  attachment_name  text,
  read_at          timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz DEFAULT now()
);


-- Sessions
CREATE TABLE sessions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id         uuid REFERENCES match_requests ON DELETE CASCADE NOT NULL,
  scheduled_at     timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  skill_focus      text NOT NULL,
  notes            text,
  status           text CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at       timestamptz DEFAULT now()
);


-- Session notes (shared notepad per session)
CREATE TABLE session_notes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions ON DELETE CASCADE NOT NULL,
  author_id  uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);


-- Reviews
CREATE TABLE reviews (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid REFERENCES sessions ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  reviewee_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  rating      int CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment     text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (session_id, reviewer_id)
);


-- Skill endorsements
CREATE TABLE endorsements (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endorser_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  endorsee_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  skill_name  text NOT NULL,
  pinned      boolean DEFAULT false,
  hidden      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (endorser_id, endorsee_id, skill_name)
);


-- Reports (moderation)
CREATE TABLE reports (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id  uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  reported_id  uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  reason       text NOT NULL,
  resolved_at  timestamptz,
  action_taken text,
  created_at   timestamptz DEFAULT now()
);


-- Blocks
CREATE TABLE blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);


-- Notifications (in-app + announcements)
CREATE TABLE notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  entity_id  uuid,
  href       text,
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);


-- Admin-assigned user badges
CREATE TABLE user_badges (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  badge_type  text NOT NULL CHECK (badge_type IN (
                'verified', 'top_teacher', 'top_learner',
                'trusted', 'community_star', 'early_adopter'
              )),
  awarded_by  uuid REFERENCES profiles,
  awarded_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, badge_type)
);


-- Organizations
CREATE TABLE organizations (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    text NOT NULL,
  slug                    text NOT NULL UNIQUE,
  bio                     text,
  avatar_url              text,
  website                 text,
  is_verified             boolean DEFAULT false,
  internal_only_swapping  boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);


-- Organization Members
CREATE TABLE organization_members (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);


-- Organization Invites
CREATE TABLE organization_invites (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  email           text NOT NULL,
  inviter_id      uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + interval '7 days'),
  UNIQUE (organization_id, email)
);


-- ── 3. Auto-create profile on sign-up ────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- ── 4. Enable Row Level Security ─────────────────────────────

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills    ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE endorsements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites   ENABLE ROW LEVEL SECURITY;


-- ── 5. RLS Policies ──────────────────────────────────────────

-- profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- user_skills
CREATE POLICY "Skills are viewable by everyone"
  ON user_skills FOR SELECT USING (true);

CREATE POLICY "Users can manage own skills"
  ON user_skills FOR ALL USING (auth.uid() = user_id);


-- match_requests
CREATE POLICY "Users can view their match requests"
  ON match_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send match requests"
  ON match_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Match participants can update status"
  ON match_requests FOR UPDATE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);


-- messages
CREATE POLICY "Match participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM match_requests mr
      WHERE mr.id = match_id
        AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Match participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM match_requests mr
      WHERE mr.id = match_id
        AND mr.status = 'accepted'
        AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM match_requests mr
      WHERE mr.id = match_id
        AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
    )
  )
  WITH CHECK (true);


-- sessions
CREATE POLICY "Match participants can manage sessions"
  ON sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM match_requests mr
      WHERE mr.id = match_id
        AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
    )
  );


-- session_notes
CREATE POLICY "Session participants can manage notes"
  ON session_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN match_requests mr ON mr.id = s.match_id
      WHERE s.id = session_id
        AND (mr.from_user_id = auth.uid() OR mr.to_user_id = auth.uid())
    )
  );


-- reviews
CREATE POLICY "Reviews are publicly viewable"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Users can write reviews for own sessions"
  ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);


-- endorsements
CREATE POLICY "Endorsements are publicly viewable"
  ON endorsements FOR SELECT USING (true);

CREATE POLICY "Users can endorse others"
  ON endorsements FOR INSERT WITH CHECK (auth.uid() = endorser_id);

CREATE POLICY "Endorsees can manage their endorsements"
  ON endorsements FOR UPDATE USING (auth.uid() = endorsee_id);

CREATE POLICY "Endorsers can remove own endorsements"
  ON endorsements FOR DELETE USING (auth.uid() = endorser_id);


-- reports
CREATE POLICY "Users can file reports"
  ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own filed reports"
  ON reports FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON reports FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can resolve reports"
  ON reports FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- blocks
CREATE POLICY "Users can manage own blocks"
  ON blocks FOR ALL USING (auth.uid() = blocker_id);

CREATE POLICY "Users can see if they are blocked"
  ON blocks FOR SELECT USING (auth.uid() = blocked_id);


-- notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Server can insert notifications"
  ON notifications FOR INSERT WITH CHECK (true);


-- user_badges
CREATE POLICY "Badges are publicly viewable"
  ON user_badges FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges"
  ON user_badges FOR ALL
  USING   ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');


-- organizations
CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Owners and admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- organization_members
CREATE POLICY "Organization members are viewable by everyone"
  ON organization_members FOR SELECT USING (true);

CREATE POLICY "Owners can manage organization members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

CREATE POLICY "Admins can manage non-owner members"
  ON organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (role != 'owner');


-- organization_invites
CREATE POLICY "Invites are viewable by org admins and the invited user"
  ON organization_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_invites.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
    OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Org admins can manage invites"
  ON organization_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_invites.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );


-- ── 6. Storage Policies ──────────────────────────────────────
-- Create these two buckets first in Supabase Dashboard → Storage:
--   • "avatars"     — Public: ON
--   • "attachments" — Public: OFF
-- Then uncomment and run:

-- CREATE POLICY "Avatars are publicly accessible"
--   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can upload own avatar"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can update own avatar"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own avatar"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Authenticated users can view attachments"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');
-- CREATE POLICY "Authenticated users can upload attachments"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'attachments' AND auth.role() = 'authenticated');
-- CREATE POLICY "Users can delete own attachments"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ── 7. Re-sync profiles for existing auth users ──────────────
-- REQUIRED if you already have users — re-creates their profile
-- rows after the DROP/CREATE above wiped them.
INSERT INTO profiles (id, name, avatar_url)
SELECT
  id,
  COALESCE(
    NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(email, '@', 1)
  ),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ── 8. Set yourself as admin ─────────────────────────────────
-- Replace the email with yours then run:
UPDATE profiles
SET role = 'admin', onboarding_completed = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'lawuobahjallah79@gmail.com');
