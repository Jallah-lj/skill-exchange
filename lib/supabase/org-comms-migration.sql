-- ── Organization Communication & Workshops Migration ───────────────────────────
-- Run this in Supabase SQL Editor.

-- 1. Organization Announcements (Feed)
CREATE TABLE IF NOT EXISTS organization_announcements (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  author_id       uuid REFERENCES profiles ON DELETE SET NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  type            text DEFAULT 'news' CHECK (type IN ('news', 'event', 'alert', 'milestone')),
  is_pinned       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. Workshops (Group Sessions)
CREATE TABLE IF NOT EXISTS workshops (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  instructor_id   uuid REFERENCES profiles ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  scheduled_at    timestamptz NOT NULL,
  duration_minutes int DEFAULT 60,
  max_participants int, -- NULL means unlimited
  location        text, -- URL or physical address
  status          text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 3. Workshop Attendees
CREATE TABLE IF NOT EXISTS workshop_attendees (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id     uuid REFERENCES workshops ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  status          text DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (workshop_id, user_id)
);

-- 4. Organization Messaging Threads
CREATE TABLE IF NOT EXISTS organization_threads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  subject         text,
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 5. Organization Messages
CREATE TABLE IF NOT EXISTS organization_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id       uuid REFERENCES organization_threads ON DELETE CASCADE NOT NULL,
  sender_id       uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content         text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops                ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_attendees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_messages    ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──

-- Announcements: Everyone can read, only org admins can manage
CREATE POLICY "Announcements are viewable by everyone"
  ON organization_announcements FOR SELECT USING (true);

CREATE POLICY "Org admins can manage announcements"
  ON organization_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_announcements.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );

-- Workshops: Everyone can read, only org admins can manage
CREATE POLICY "Workshops are viewable by everyone"
  ON workshops FOR SELECT USING (true);

CREATE POLICY "Org admins can manage workshops"
  ON workshops FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = workshops.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator', 'instructor')
    )
  );

-- Workshop Attendees: Users can manage own registration, org admins can view all
CREATE POLICY "Users can manage own workshop registration"
  ON workshop_attendees FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins can view workshop attendees"
  ON workshop_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workshops w
      JOIN organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workshop_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'moderator', 'instructor')
    )
  );

-- Org Threads: Users can see their own threads, org admins can see all org threads
CREATE POLICY "Users can see their own org threads"
  ON organization_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins can manage org threads"
  ON organization_threads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_threads.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );

-- Org Messages: Participants and org admins can see messages
CREATE POLICY "Participants can see org messages"
  ON organization_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_threads t
      WHERE t.id = thread_id
        AND (
          t.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = t.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'moderator')
          )
        )
    )
  );

CREATE POLICY "Participants can send org messages"
  ON organization_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM organization_threads t
      WHERE t.id = thread_id
        AND (
          t.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = t.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'moderator')
          )
        )
    )
  );
