-- ============================================================
-- Comment threads: replies, pinning, editing
-- Idempotent (safe to re-run). Requires post_comments to exist.
-- ============================================================

alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments on delete cascade,
  add column if not exists is_pinned boolean default false,
  add column if not exists updated_at timestamptz,
  add column if not exists as_organization boolean default false;

-- Authors can edit their own comments
drop policy if exists "Users can edit own comments" on public.post_comments;
create policy "Users can edit own comments"
  on public.post_comments for update
  using (auth.uid() = user_id);

-- Org managers can pin/unpin (and moderate) comments on their posts
drop policy if exists "Managers can update comments" on public.post_comments;
create policy "Managers can update comments"
  on public.post_comments for update
  using (
    exists (
      select 1 from organization_posts p
      where p.id = post_id
        and has_org_role(p.organization_id, array['owner','admin','moderator'])
    )
  );

notify pgrst, 'reload schema';
