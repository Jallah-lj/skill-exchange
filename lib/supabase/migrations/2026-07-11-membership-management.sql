-- ============================================================
-- Enterprise membership management — run this whole block once
-- Reapply cooldowns, request history, invite codes, direct user
-- invitations, and organization membership settings.
-- Idempotent (safe to re-run).
-- Requires: 2026-07-11-org-communication.sql (has_org_role, tables)
-- ============================================================

-- ── 1. Organization membership settings ──────────────────────
alter table public.organizations
  add column if not exists reapply_cooldown_days int default 30,
  add column if not exists max_members int,
  add column if not exists default_member_role text default 'member',
  add column if not exists auto_expire_requests_days int;

-- ── 2. Join requests: decline reason + cooldown + history ────
alter table public.organization_join_requests
  add column if not exists decline_reason text,
  add column if not exists cooldown_days int,
  add column if not exists cooldown_until timestamptz,
  add column if not exists cooldown_waived_at timestamptz,
  add column if not exists cooldown_waived_by uuid references public.profiles;

-- History requires multiple rows per user+org. Replace the hard
-- unique constraint with "only one PENDING request at a time".
alter table public.organization_join_requests
  drop constraint if exists organization_join_requests_organization_id_user_id_key;
create unique index if not exists org_join_requests_one_pending
  on public.organization_join_requests (organization_id, user_id)
  where status = 'pending';

-- ── 3. Invite codes (code / link / QR) ───────────────────────
create table if not exists public.organization_invite_codes (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  code            text not null unique,
  role            text check (role in ('admin', 'moderator', 'instructor', 'member')) default 'member',
  label           text,
  max_uses        int,
  use_count       int default 0,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_by      uuid references public.profiles,
  created_at      timestamptz default now()
);
alter table public.organization_invite_codes enable row level security;

-- Anyone signed in can look up a code to redeem it; managers see their org's codes.
drop policy if exists "Authenticated users can look up codes" on public.organization_invite_codes;
create policy "Authenticated users can look up codes"
  on public.organization_invite_codes for select
  using (auth.role() = 'authenticated');

drop policy if exists "Managers can create codes" on public.organization_invite_codes;
create policy "Managers can create codes"
  on public.organization_invite_codes for insert
  with check (has_org_role(organization_id, array['owner','admin']));

drop policy if exists "Managers can update codes" on public.organization_invite_codes;
create policy "Managers can update codes"
  on public.organization_invite_codes for update
  using (has_org_role(organization_id, array['owner','admin']));

drop policy if exists "Managers can delete codes" on public.organization_invite_codes;
create policy "Managers can delete codes"
  on public.organization_invite_codes for delete
  using (has_org_role(organization_id, array['owner','admin']));

-- Usage history
create table if not exists public.organization_invite_code_uses (
  id       uuid default gen_random_uuid() primary key,
  code_id  uuid references public.organization_invite_codes on delete cascade not null,
  user_id  uuid references public.profiles on delete cascade not null,
  used_at  timestamptz default now(),
  unique (code_id, user_id)
);
alter table public.organization_invite_code_uses enable row level security;

drop policy if exists "Users record their own code use" on public.organization_invite_code_uses;
create policy "Users record their own code use"
  on public.organization_invite_code_uses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Managers and users can view code uses" on public.organization_invite_code_uses;
create policy "Managers and users can view code uses"
  on public.organization_invite_code_uses for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from organization_invite_codes c
      where c.id = code_id and has_org_role(c.organization_id, array['owner','admin'])
    )
  );

-- Atomic redemption: validates and increments use_count, adds membership.
create or replace function public.redeem_org_invite_code(p_code text)
returns table (org_slug text, org_name text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_code organization_invite_codes%rowtype;
  v_org organizations%rowtype;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_code from organization_invite_codes
  where upper(code) = upper(p_code)
  for update;

  if not found then raise exception 'Invalid invite code'; end if;
  if v_code.revoked_at is not null then raise exception 'This invite code has been revoked'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then raise exception 'This invite code has expired'; end if;
  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then raise exception 'This invite code has reached its usage limit'; end if;

  select * into v_org from organizations where id = v_code.organization_id;

  if exists (select 1 from organization_members where organization_id = v_org.id and user_id = auth.uid()) then
    raise exception 'You are already a member of %', v_org.name;
  end if;

  if v_org.max_members is not null then
    select count(*) into v_member_count from organization_members where organization_id = v_org.id;
    if v_member_count >= v_org.max_members then
      raise exception 'This organization has reached its member limit';
    end if;
  end if;

  insert into organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), v_code.role);

  update organization_invite_codes set use_count = use_count + 1 where id = v_code.id;

  insert into organization_invite_code_uses (code_id, user_id)
  values (v_code.id, auth.uid())
  on conflict do nothing;

  return query select v_org.slug, v_org.name;
end;
$$;

-- ── 4. Direct user invitations ───────────────────────────────
create table if not exists public.organization_user_invites (
  id              uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  user_id         uuid references public.profiles on delete cascade not null,
  invited_by      uuid references public.profiles,
  role            text check (role in ('admin', 'moderator', 'instructor', 'member')) default 'member',
  message         text,
  status          text check (status in ('pending', 'accepted', 'declined', 'revoked')) default 'pending',
  created_at      timestamptz default now(),
  responded_at    timestamptz
);
alter table public.organization_user_invites enable row level security;

create unique index if not exists org_user_invites_one_pending
  on public.organization_user_invites (organization_id, user_id)
  where status = 'pending';

drop policy if exists "Invitee and managers can view invites" on public.organization_user_invites;
create policy "Invitee and managers can view invites"
  on public.organization_user_invites for select
  using (auth.uid() = user_id or has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Managers can invite users" on public.organization_user_invites;
create policy "Managers can invite users"
  on public.organization_user_invites for insert
  with check (has_org_role(organization_id, array['owner','admin','moderator']));

drop policy if exists "Invitee and managers can respond" on public.organization_user_invites;
create policy "Invitee and managers can respond"
  on public.organization_user_invites for update
  using (auth.uid() = user_id or has_org_role(organization_id, array['owner','admin','moderator']));

-- ── 5. Managers can open inbox threads with applicants ───────
drop policy if exists "Managers can open threads with users" on public.organization_threads;
create policy "Managers can open threads with users"
  on public.organization_threads for insert
  with check (has_org_role(organization_id, array['owner','admin','moderator']));
