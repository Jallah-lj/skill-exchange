-- ── Post Comments Migration ────────────────────────────────────────────────
-- Run this in Supabase SQL Editor to enable comments on public posts.

CREATE TABLE IF NOT EXISTS post_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES organization_posts ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Comments are public') THEN
    CREATE POLICY "Comments are public"
      ON post_comments FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Authenticated users can create comments') THEN
    CREATE POLICY "Authenticated users can create comments"
      ON post_comments FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can delete own comments') THEN
    CREATE POLICY "Users can delete own comments"
      ON post_comments FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);
