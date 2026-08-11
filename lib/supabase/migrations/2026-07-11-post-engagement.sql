-- ============================================================
-- Post engagement: likes, bookmarks, comments
-- The feed UI and /api/posts/* routes already use these tables.
-- Idempotent (safe to re-run).
-- ============================================================

create table if not exists public.post_likes (
  id         uuid default gen_random_uuid() primary key,
  post_id    uuid references public.organization_posts on delete cascade not null,
  user_id    uuid references public.profiles on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
alter table public.post_likes enable row level security;

drop policy if exists "Likes are viewable by everyone" on public.post_likes;
create policy "Likes are viewable by everyone"
  on public.post_likes for select using (true);

drop policy if exists "Users can like posts" on public.post_likes;
create policy "Users can like posts"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike posts" on public.post_likes;
create policy "Users can unlike posts"
  on public.post_likes for delete
  using (auth.uid() = user_id);

create table if not exists public.post_bookmarks (
  id         uuid default gen_random_uuid() primary key,
  post_id    uuid references public.organization_posts on delete cascade not null,
  user_id    uuid references public.profiles on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
alter table public.post_bookmarks enable row level security;

drop policy if exists "Users can view own bookmarks" on public.post_bookmarks;
create policy "Users can view own bookmarks"
  on public.post_bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can bookmark posts" on public.post_bookmarks;
create policy "Users can bookmark posts"
  on public.post_bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove bookmarks" on public.post_bookmarks;
create policy "Users can remove bookmarks"
  on public.post_bookmarks for delete
  using (auth.uid() = user_id);

create table if not exists public.post_comments (
  id         uuid default gen_random_uuid() primary key,
  post_id    uuid references public.organization_posts on delete cascade not null,
  user_id    uuid references public.profiles on delete cascade not null,
  content    text not null,
  created_at timestamptz default now()
);
alter table public.post_comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.post_comments;
create policy "Comments are viewable by everyone"
  on public.post_comments for select using (true);

drop policy if exists "Users can comment" on public.post_comments;
create policy "Users can comment"
  on public.post_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on public.post_comments;
create policy "Users can delete own comments"
  on public.post_comments for delete
  using (auth.uid() = user_id);

-- Org managers can moderate comments on their org's posts
drop policy if exists "Managers can moderate comments" on public.post_comments;
create policy "Managers can moderate comments"
  on public.post_comments for delete
  using (
    exists (
      select 1 from organization_posts p
      where p.id = post_id
        and has_org_role(p.organization_id, array['owner','admin','moderator'])
    )
  );

notify pgrst, 'reload schema';
