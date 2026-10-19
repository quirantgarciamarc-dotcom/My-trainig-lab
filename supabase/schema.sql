-- My Training Lab: multi-user auth and cloud data.
-- Run this in Supabase SQL Editor before enabling public sign-up.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_app_data enable row level security;

-- A signed-in person can access only their own profile and personal app state.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "read own app data" on public.user_app_data;
create policy "read own app data" on public.user_app_data for select to authenticated using (auth.uid() = user_id);
drop policy if exists "insert own app data" on public.user_app_data;
create policy "insert own app data" on public.user_app_data for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "update own app data" on public.user_app_data;
create policy "update own app data" on public.user_app_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_app_data to authenticated;

create or replace function public.handle_new_mtl_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  username_value text;
begin
  username_value := lower(coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)));
  insert into public.profiles (user_id, username, display_name)
  values (new.id, username_value, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), username_value));
  return new;
exception when unique_violation then
  raise exception 'Ese nombre de usuario ya está en uso. Elige otro.';
end;
$$;

drop trigger if exists on_auth_user_created_mtl on auth.users;
create trigger on_auth_user_created_mtl
after insert on auth.users
for each row execute procedure public.handle_new_mtl_user();

-- Do not add an anon select policy. User records are private.


-- Persistent server-side quota for Anthropic calls. Only Netlify Functions should use the service-role key.
create table if not exists public.coach_usage_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quota_key text not null check (quota_key in ('general','pdf')),
  created_at timestamptz not null default now()
);
create index if not exists coach_usage_log_user_key_date_idx on public.coach_usage_log (user_id, quota_key, created_at desc);
alter table public.coach_usage_log enable row level security;
revoke all on public.coach_usage_log from anon, authenticated;
grant select, insert, delete on public.coach_usage_log to service_role;
grant usage, select on sequence public.coach_usage_log_id_seq to service_role;

create or replace function public.consume_mtl_coach_quota(
  p_user_id uuid,
  p_quota_key text,
  p_window_seconds integer,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_quota_key not in ('general','pdf') or p_window_seconds < 1 or p_max_requests < 1 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_quota_key, 0));
  delete from public.coach_usage_log where user_id = p_user_id and created_at < now() - interval '1 day';
  select count(*) into current_count
  from public.coach_usage_log
  where user_id = p_user_id and quota_key = p_quota_key and created_at > now() - make_interval(secs => p_window_seconds);
  if current_count >= p_max_requests then
    return false;
  end if;
  insert into public.coach_usage_log(user_id, quota_key) values (p_user_id, p_quota_key);
  return true;
end;
$$;
revoke all on function public.consume_mtl_coach_quota(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_mtl_coach_quota(uuid, text, integer, integer) to service_role;
