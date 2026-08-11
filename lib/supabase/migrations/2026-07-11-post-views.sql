-- ============================================================
-- Post view tracking (unique viewers per post)
-- Idempotent (safe to re-run).
-- ============================================================

create table if not exists public.post_views (
  id         uuid default gen_random_uuid() primary key,
  post_id    uuid references public.organization_posts on delete cascade not null,
  user_id    uuid references public.profiles on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);
alter table public.post_views enable row level security;

drop policy if exists "Views are countable by everyone" on public.post_views;
create policy "Views are countable by everyone"
  on public.post_views for select using (true);

drop policy if exists "Users record their own views" on public.post_views;
create policy "Users record their own views"
  on public.post_views for insert
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
