-- ── Post Likes and Bookmarks Migration ───────────────────────────────────────
-- Run this in Supabase SQL Editor to add post engagement features.

-- 1. Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES organization_posts ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 2. Post Bookmarks (Save posts)
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES organization_posts ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for post_likes
CREATE POLICY "Users can view all likes"
  ON post_likes FOR SELECT USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their likes"
  ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- 5. RLS Policies for post_bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON post_bookmarks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can bookmark posts"
  ON post_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their bookmarks"
  ON post_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post_id ON post_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user_id ON post_bookmarks(user_id);
