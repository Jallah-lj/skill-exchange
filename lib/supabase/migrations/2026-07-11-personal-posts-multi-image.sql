-- ── Personal Posts + Multiple Images ────────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Lets any signed-in user publish a post without belonging to an organization
-- (organization_id becomes optional), and lets a post carry more than one photo.

-- 1. Organization is now optional on a post
ALTER TABLE organization_posts ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Multiple images per post
ALTER TABLE organization_posts ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

-- Backfill: carry any existing single image_url into the new array
UPDATE organization_posts
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_urls = '{}';

-- 3. RLS: allow a user to create/update/delete their own personal post
--    (organization_id IS NULL), in addition to the existing org-manager rules.
DROP POLICY IF EXISTS "Managers can create posts" ON organization_posts;
DROP POLICY IF EXISTS "Org admins can create all posts" ON organization_posts;
CREATE POLICY "Users can create posts"
  ON organization_posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      organization_id IS NULL
      OR has_org_role(organization_id, ARRAY['owner', 'admin', 'moderator'])
    )
  );

DROP POLICY IF EXISTS "Managers can update posts" ON organization_posts;
CREATE POLICY "Users can update posts"
  ON organization_posts FOR UPDATE
  USING (
    (organization_id IS NULL AND author_id = auth.uid())
    OR (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['owner', 'admin', 'moderator']))
  );

DROP POLICY IF EXISTS "Managers can delete posts" ON organization_posts;
CREATE POLICY "Users can delete posts"
  ON organization_posts FOR DELETE
  USING (
    (organization_id IS NULL AND author_id = auth.uid())
    OR (organization_id IS NOT NULL AND has_org_role(organization_id, ARRAY['owner', 'admin', 'moderator']))
  );
