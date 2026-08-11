-- ── Site Content (Articles / Resources / Announcements) ─────────────────────
-- Run this in Supabase SQL Editor.
-- Backs the admin Content Management page (app/admin/content/page.tsx), which
-- was querying a `posts` table that was never created by any prior migration —
-- every read/write there has been silently failing.

CREATE TABLE IF NOT EXISTS posts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  content      text NOT NULL,
  type         text NOT NULL DEFAULT 'article' CHECK (type IN ('article', 'resource', 'announcement')),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'archived')),
  category     text,
  author_id    uuid REFERENCES profiles ON DELETE SET NULL,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Everyone (including anonymous visitors) can read published content
CREATE POLICY "Published posts are viewable by everyone"
  ON posts FOR SELECT
  USING (status = 'published');

-- Admins can do everything, including seeing drafts/archived posts
CREATE POLICY "Admins can manage posts"
  ON posts FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
