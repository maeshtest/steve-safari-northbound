create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text not null default '',
  bio text not null default '',
  photo_url text,
  email text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.team_members to anon;
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
create policy "Public reads visible team" on public.team_members for select to anon, authenticated using (is_visible);
create policy "Staff read team" on public.team_members for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff add team" on public.team_members for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff edit team" on public.team_members for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete team" on public.team_members for delete to authenticated using (public.is_staff(auth.uid()));
create trigger team_members_touch before update on public.team_members for each row execute function public.touch_updated_at();

alter table public.applications add column is_demo boolean not null default false;

create table public.bridge_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.bridge_keys to service_role;
alter table public.bridge_keys enable row level security;