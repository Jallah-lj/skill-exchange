-- ============================================================
-- Organization communication tables — run this whole block once
-- Creates everything the org dashboard/pages query that is
-- missing from the live DB. Idempotent (safe to re-run).
-- ============================================================

-- ── 0. Defensive: columns the org pages expect on organizations ──
alter table public.organizations
  add column if not exists category text,
  add column if not exists phone text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists visibility text default 'public',
  add column if not exists membership_type text default 'open',
  add column if not exists email_domain text,
  add column if not exists owner_id uuid references public.profiles,
  add column if not exists org_code text default upper(substring(md5(random()::text) from 1 for 8)),
  add column if not exists cover_image_url text;

-- Widen member roles to match the app (moderator/instructor)
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'moderator', 'instructor', 'member'));

-- ── 1. Helper: role check used by the policies below ─────────
create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and role = any(p_roles)
  ) or exists (
    select 1 from organizations where id = p_org and owner_id = auth.uid()
  );
$$;

-- ── 2. Join requests ─────────────────────────────────────────
create table if not exists public.organization_join_requests (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  user_id         uuid references public.profiles on delete cascade not null,
  message         text,
  skills          text,
  experience      text,
  status          text check (status in ('pending', 'approved', 'declined')) default 'pending',
  reviewed_by     uuid references public.profiles,
  reviewed_at     timestamptz,
  created_at      timestamptz default now(),
  unique (organization_id, user_id)
);
alter table public.organization_join_requests enable row level security;

drop policy if exists "Users can create join requests" on public.organization_join_requests;
create policy "Users can create join requests"
  on public.organization_join_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Requesters and managers can view requests" on public.organization_join_requests;
create policy "Requesters and managers can view requests"
  on public.organization_join_requests for select
  using (auth.uid() = user_id or has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can review requests" on public.organization_join_requests;
create policy "Managers can review requests"
  on public.organization_join_requests for update
  using (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Requesters can withdraw" on public.organization_join_requests;
create policy "Requesters can withdraw"
  on public.organization_join_requests for delete
  using (auth.uid() = user_id);

-- ── 3. Announcements ─────────────────────────────────────────
create table if not exists public.organization_announcements (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  author_id       uuid references public.profiles on delete set null,
  title           text not null,
  content         text not null,
  type            text check (type in ('news', 'event', 'alert', 'milestone')) default 'news',
  is_pinned       boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.organization_announcements enable row level security;

drop policy if exists "Announcements are viewable by everyone" on public.organization_announcements;
create policy "Announcements are viewable by everyone"
  on public.organization_announcements for select using (true);

drop policy if exists "Managers can create announcements" on public.organization_announcements;
create policy "Managers can create announcements"
  on public.organization_announcements for insert
  with check (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can update announcements" on public.organization_announcements;
create policy "Managers can update announcements"
  on public.organization_announcements for update
  using (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can delete announcements" on public.organization_announcements;
create policy "Managers can delete announcements"
  on public.organization_announcements for delete
  using (has_org_role(organization_id, array['owner','admin','moderator']));

-- ── 4. Public posts ──────────────────────────────────────────
create table if not exists public.organization_posts (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  author_id       uuid references public.profiles on delete set null,
  title           text not null,
  content         text not null,
  category        text check (category in ('opportunity', 'news', 'project', 'help_wanted', 'event')) default 'news',
  image_url       text,
  is_published    boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.organization_posts enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.organization_posts;
create policy "Posts are viewable by everyone"
  on public.organization_posts for select using (true);

drop policy if exists "Managers can create posts" on public.organization_posts;
create policy "Managers can create posts"
  on public.organization_posts for insert
  with check (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can update posts" on public.organization_posts;
create policy "Managers can update posts"
  on public.organization_posts for update
  using (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can delete posts" on public.organization_posts;
create policy "Managers can delete posts"
  on public.organization_posts for delete
  using (has_org_role(organization_id, array['owner','admin','moderator']));

-- ── 5. Workshops + attendees ─────────────────────────────────
create table if not exists public.workshops (
  id               uuid default gen_random_uuid() primary key,
  organization_id  uuid references public.organizations on delete cascade not null,
  instructor_id    uuid references public.profiles on delete set null,
  title            text not null,
  description      text,
  scheduled_at     timestamptz not null,
  duration_minutes int default 60,
  max_participants int,
  location         text,
  status           text check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')) default 'scheduled',
  is_public        boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.workshops enable row level security;

drop policy if exists "Workshops are viewable by everyone" on public.workshops;
create policy "Workshops are viewable by everyone"
  on public.workshops for select using (true);

drop policy if exists "Org staff can manage workshops" on public.workshops;
create policy "Org staff can manage workshops"
  on public.workshops for all
  using (has_org_role(organization_id, array['owner','admin','moderator','instructor']));

create table if not exists public.workshop_attendees (
  id          uuid default gen_random_uuid() primary key,
  workshop_id uuid references public.workshops on delete cascade not null,
  user_id     uuid references public.profiles on delete cascade not null,
  status      text check (status in ('registered', 'attended', 'cancelled')) default 'registered',
  created_at  timestamptz default now(),
  unique (workshop_id, user_id)
);
alter table public.workshop_attendees enable row level security;

drop policy if exists "Attendees are viewable by everyone" on public.workshop_attendees;
create policy "Attendees are viewable by everyone"
  on public.workshop_attendees for select using (true);

drop policy if exists "Users can register themselves" on public.workshop_attendees;
create policy "Users can register themselves"
  on public.workshop_attendees for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users and org staff can update attendance" on public.workshop_attendees;
create policy "Users and org staff can update attendance"
  on public.workshop_attendees for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from workshops w
      where w.id = workshop_id
        and has_org_role(w.organization_id, array['owner','admin','moderator','instructor'])
    )
  );

drop policy if exists "Users can cancel own registration" on public.workshop_attendees;
create policy "Users can cancel own registration"
  on public.workshop_attendees for delete
  using (auth.uid() = user_id);

-- ── 6. Message threads (member ↔ organization inbox) ────────
create table if not exists public.organization_threads (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  user_id         uuid references public.profiles on delete cascade not null,
  subject         text,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now(),
  unique (organization_id, user_id)
);
alter table public.organization_threads enable row level security;

drop policy if exists "Participants and managers can view threads" on public.organization_threads;
create policy "Participants and managers can view threads"
  on public.organization_threads for select
  using (auth.uid() = user_id or has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Users can start threads" on public.organization_threads;
create policy "Users can start threads"
  on public.organization_threads for insert
  with check (auth.uid() = user_id);

drop policy if exists "Participants and managers can update threads" on public.organization_threads;
create policy "Participants and managers can update threads"
  on public.organization_threads for update
  using (auth.uid() = user_id or has_org_role(organization_id, array['owner','admin','moderator']));

create table if not exists public.organization_messages (
  id         uuid default gen_random_uuid() primary key,
  thread_id  uuid references public.organization_threads on delete cascade not null,
  sender_id  uuid references public.profiles on delete cascade not null,
  content    text not null,
  read_at    timestamptz,
  created_at timestamptz default now()
);
alter table public.organization_messages enable row level security;

drop policy if exists "Thread participants can view messages" on public.organization_messages;
create policy "Thread participants can view messages"
  on public.organization_messages for select
  using (
    exists (
      select 1 from organization_threads t
      where t.id = thread_id
        and (t.user_id = auth.uid() or has_org_role(t.organization_id, array['owner','admin','moderator']))
    )
  );

drop policy if exists "Thread participants can send messages" on public.organization_messages;
create policy "Thread participants can send messages"
  on public.organization_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from organization_threads t
      where t.id = thread_id
        and (t.user_id = auth.uid() or has_org_role(t.organization_id, array['owner','admin','moderator']))
    )
  );

drop policy if exists "Participants can mark messages read" on public.organization_messages;
create policy "Participants can mark messages read"
  on public.organization_messages for update
  using (
    exists (
      select 1 from organization_threads t
      where t.id = thread_id
        and (t.user_id = auth.uid() or has_org_role(t.organization_id, array['owner','admin','moderator']))
    )
  );

-- ── 7. Realtime for the dashboard inbox ──────────────────────
do $$
begin
  alter publication supabase_realtime add table public.organization_messages;
exception when duplicate_object then null;
end $$;

-- ── 8. Org deletion policy (used by the new Danger Zone) ─────
drop policy if exists "Owners can delete their organization" on public.organizations;
create policy "Owners can delete their organization"
  on public.organizations for delete
  using (owner_id = auth.uid());
