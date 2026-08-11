-- ── Public Organization Posts Migration ───────────────────────────────────────
-- Run this in Supabase SQL Editor.

-- 1. Organization Posts
CREATE TABLE IF NOT EXISTS organization_posts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  author_id       uuid REFERENCES profiles ON DELETE SET NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  category        text DEFAULT 'news' CHECK (category IN ('opportunity', 'news', 'project', 'help_wanted', 'event')),
  image_url       text,
  is_published    boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. Add is_public to workshops to allow global discovery
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Enable RLS
ALTER TABLE organization_posts ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ──

-- Posts: Everyone can see published posts, admins can manage all
CREATE POLICY "Published posts are viewable by everyone"
  ON organization_posts FOR SELECT
  USING (is_published = true);

CREATE POLICY "Org admins can manage all posts"
  ON organization_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_posts.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );

-- Update Workshop Policy: Everyone can see public workshops (already mostly true, but explicit for clarity)
-- Note: The existing "Workshops are viewable by everyone" policy already handles discovery.
-- But we'll add is_public to facilitate filtering on the browse page.
