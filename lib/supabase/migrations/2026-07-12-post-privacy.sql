-- ── Post Privacy / Audience ───────────────────────────────────────────────────
-- Run this in Supabase SQL Editor.
-- Lets a personal post's author choose who can see it: everyone (public),
-- only their accepted connections, only themselves (private), or a
-- hand-picked list of specific people. Org-authored posts are unaffected —
-- the composer only exposes this choice for personal posts, and org posts
-- default to 'public' as before.

ALTER TABLE organization_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'connections', 'private', 'specific'));

CREATE INDEX IF NOT EXISTS idx_organization_posts_visibility ON organization_posts(visibility);

-- 1. Specific-audience list — only populated when visibility = 'specific'.
CREATE TABLE IF NOT EXISTS post_audience (
  post_id    uuid REFERENCES organization_posts ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_audience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post author manages their post's audience"
  ON post_audience FOR ALL
  USING (EXISTS (SELECT 1 FROM organization_posts WHERE id = post_audience.post_id AND author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_posts WHERE id = post_audience.post_id AND author_id = auth.uid()));

CREATE POLICY "A listed user can see their own audience entries"
  ON post_audience FOR SELECT
  USING (user_id = auth.uid());

-- 2. RLS is the real boundary here, not client-side filtering: replace the
--    blanket "published posts are viewable by everyone" SELECT policy with
--    one that also checks visibility. Org-managed access (the separate
--    "Org admins can manage all posts" ALL policy) is untouched, so org
--    managers keep full visibility into their own org's posts regardless.
DROP POLICY IF EXISTS "Posts are viewable per their visibility" ON organization_posts;
DROP POLICY IF EXISTS "Published posts are viewable by everyone" ON organization_posts;
CREATE POLICY "Posts are viewable per their visibility"
  ON organization_posts FOR SELECT
  USING (
    is_published = true
    AND deleted_at IS NULL
    AND (
      visibility = 'public'
      OR author_id = auth.uid()
      OR (
        visibility = 'connections'
        AND EXISTS (
          SELECT 1 FROM match_requests
          WHERE status = 'accepted'
            AND (
              (from_user_id = auth.uid() AND to_user_id = organization_posts.author_id)
              OR (to_user_id = auth.uid() AND from_user_id = organization_posts.author_id)
            )
        )
      )
      OR (
        visibility = 'specific'
        AND EXISTS (SELECT 1 FROM post_audience WHERE post_id = organization_posts.id AND user_id = auth.uid())
      )
    )
  );
