-- ── Fix: infinite recursion in organization_posts / post_audience RLS ────────
-- Run this in Supabase SQL Editor (after 2026-07-12-post-privacy.sql).
--
-- Bug: organization_posts' SELECT policy checks `EXISTS (... FROM
-- post_audience ...)`, and post_audience's "author manages" policy checks
-- `EXISTS (... FROM organization_posts ...)`. Postgres evaluates each row's
-- policy by re-running the other table's policy, which re-runs the first
-- table's policy, forever — every read AND write to organization_posts
-- errors with "infinite recursion detected in policy for relation
-- organization_posts" (42P17). This is why newly created posts (and
-- everything else touching organization_posts) stopped showing up.
--
-- Fix: move the "is this user the post's author" check into a SECURITY
-- DEFINER function (same pattern as has_org_role below). A function owned by
-- a privileged role bypasses RLS on the tables it queries internally, so
-- calling it from post_audience's policy no longer re-triggers
-- organization_posts' policy — breaking the cycle.

CREATE OR REPLACE FUNCTION public.is_post_author(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_posts WHERE id = p_post_id AND author_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Post author manages their post's audience" ON post_audience;
CREATE POLICY "Post author manages their post's audience"
  ON post_audience FOR ALL
  USING (is_post_author(post_id))
  WITH CHECK (is_post_author(post_id));
