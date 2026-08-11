-- ── Trash / Soft Delete for Posts & Content ──────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Adds a recoverable "Trash" for the three content surfaces that were
-- previously hard-deleted with no way back: personal/org posts
-- (organization_posts), post comments (post_comments), and admin-authored
-- site content (posts). Deleting now sets deleted_at instead of removing the
-- row; the Settings > Trash page (and, for site content, the admin Content
-- Management Trash filter) lets the owner restore or permanently delete
-- within a 30-day retention window.

-- 1. Add the column to each content table.
ALTER TABLE organization_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE post_comments      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE posts              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_organization_posts_deleted_at ON organization_posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_post_comments_deleted_at ON post_comments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at);

-- 2. RLS: public SELECT policies must also hide soft-deleted rows — the app
--    already filters client-side, but RLS is the real boundary, so a
--    soft-deleted "published" row must not be readable via the public policy.
DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON organization_posts;
CREATE POLICY "Published posts are viewable by everyone"
  ON organization_posts FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON posts;
CREATE POLICY "Published posts are viewable by everyone"
  ON posts FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- 3. post_comments never had an UPDATE policy (only SELECT/INSERT/DELETE),
--    so soft-deleting a comment (an UPDATE) would have been silently
--    rejected by RLS. Allow the comment's own author, or an org
--    owner/admin/moderator moderating comments on their org's post, to
--    update it (covers soft-delete and the pin/unpin feature).
DROP POLICY IF EXISTS "Users can update own comments" ON post_comments;
CREATE POLICY "Users can update own comments"
  ON post_comments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM organization_posts p
      WHERE p.id = post_comments.post_id
        AND p.organization_id IS NOT NULL
        AND has_org_role(p.organization_id, ARRAY['owner', 'admin', 'moderator'])
    )
  );

-- 4. Retention: permanently purge anything that has sat in Trash for 30+
--    days. Callable by any authenticated user (it only ever removes rows
--    already past the public retention rule, so it can't expose or affect
--    live content) — the Settings Trash page calls this on load so expired
--    items are actually cleared out even without a cron job configured. If
--    you have pg_cron available, you can instead schedule this to run daily:
--      select cron.schedule('purge-trash', '0 3 * * *', 'select purge_expired_trash()');
CREATE OR REPLACE FUNCTION purge_expired_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM organization_posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM post_comments      WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM posts              WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;

GRANT EXECUTE ON FUNCTION purge_expired_trash() TO authenticated;
