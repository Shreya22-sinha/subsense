-- SubSense database setup.
-- Paste the whole file into Supabase > SQL Editor and press Run. Safe to run more than once.
--
-- Who can see what:
--   * Signed-in users: only their own profile and data (enforced by Row Level Security).
--   * Visitors who are not signed in: nothing. They can only add 1 to the demo counter.
--   * You, in the Supabase dashboard: everything, including admin.stats below.

-- ---------------------------------------------------------------- Tables

-- One row per account. The email lives in Supabase's own auth.users table.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  -- Tick this in the Table Editor for your own test accounts, so they aren't counted.
  is_test boolean not null default false
);

-- Everything a user saves in the app, as one document (subscriptions, quiz, history...).
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000
  ),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- The days each user opened the app (date only, Indian time).
create table if not exists public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- Anonymous count of "Use demo account" taps per day.
create table if not exists public.demo_visits (
  day date primary key,
  visits integer not null default 0
);

-- ---------------------------------------------------------------- Safety locks (RLS)

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.activity_days enable row level security;
alter table public.demo_visits enable row level security;

revoke all on public.profiles, public.user_data, public.activity_days, public.demo_visits
  from public, anon, authenticated;

-- Users may read their profile and change only their name (not is_test).
grant select, update (name) on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;

drop policy if exists "own profile: read" on public.profiles;
create policy "own profile: read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "own profile: rename" on public.profiles;
create policy "own profile: rename" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own data: read" on public.user_data;
create policy "own data: read" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own data: create" on public.user_data;
create policy "own data: create" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own data: change" on public.user_data;
create policy "own data: change" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- activity_days and demo_visits have no policies on purpose: the app can only write to them
-- through the functions below, so dates and counts can't be made up.

-- ---------------------------------------------------------------- Automatic steps

-- Create a profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        'SubSense user'
      ),
      80
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for anyone who signed up before this file was run.
insert into public.profiles (id, name, created_at)
select id, left(coalesce(nullif(trim(raw_user_meta_data ->> 'name'), ''), 'SubSense user'), 80), created_at
from auth.users
on conflict (id) do nothing;

-- The server, not the browser, decides when data was last saved.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch
  before insert or update on public.user_data
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Functions the app calls

-- "I opened the app today."
create or replace function public.record_open()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.activity_days (user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Kolkata')::date)
  on conflict do nothing;
end;
$$;

-- "Someone tapped Use demo account." Nothing about the visitor is stored.
create or replace function public.record_demo_visit()
returns void language sql security definer set search_path = '' as $$
  insert into public.demo_visits (day, visits)
  values ((now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (day) do update set visits = public.demo_visits.visits + 1;
$$;

-- "Delete account": removes the login and, through cascades, everything saved.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.record_open() from public, anon, authenticated;
revoke execute on function public.record_demo_visit() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.record_open() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.record_demo_visit() to anon, authenticated;

-- ---------------------------------------------------------------- Your numbers

-- A private area the app can't reach. Run:  select * from admin.stats;
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace view admin.stats as
with real_users as (
  select id, created_at from public.profiles where not is_test
),
today as (
  select (now() at time zone 'Asia/Kolkata')::date as day
)
select
  (select count(*) from real_users) as total_users,
  (select count(*) from real_users where created_at >= now() - interval '30 days')
    as new_users_last_30_days,
  (
    select count(*) from real_users r
    join public.user_data u on u.user_id = r.id
    where jsonb_typeof(u.data -> 'subscriptions') = 'array'
      and u.data -> 'subscriptions' <> '[]'::jsonb
  ) as users_with_a_subscription,
  (
    select count(distinct a.user_id) from public.activity_days a
    join real_users r on r.id = a.user_id, today
    where a.day > today.day - 7
  ) as active_last_7_days,
  (
    select count(distinct a.user_id) from public.activity_days a
    join real_users r on r.id = a.user_id, today
    where a.day > today.day - 30
  ) as active_last_30_days,
  (
    select count(*) from (
      select a.user_id from public.activity_days a
      join real_users r on r.id = a.user_id
      group by a.user_id having count(*) >= 2
    ) returning_users
  ) as came_back_another_day,
  (select coalesce(sum(visits), 0) from public.demo_visits) as demo_taps;

revoke all on admin.stats from public, anon, authenticated;

select 'SubSense database is ready' as result;
