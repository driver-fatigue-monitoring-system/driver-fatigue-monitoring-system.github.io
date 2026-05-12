create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  role text not null default 'driver' check (role in ('admin', 'driver')),
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text unique not null,
  device_token_hash text not null,
  driver_id uuid references public.drivers(id) on delete set null,
  activated_at timestamptz,
  status text not null default 'registered' check (status in ('registered', 'active', 'disabled', 'reset_required')),
  created_at timestamptz not null default now()
);

create table if not exists public.driving_sessions (
  id text primary key,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_drowsy_events integer not null default 0,
  total_yawn_events integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.detection_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  timestamp timestamptz not null,
  event_type text not null check (event_type in ('Awake', 'Drowsy', 'Yawn')),
  confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
  status text not null check (status in ('Awake', 'Drowsy', 'Yawn')),
  frame_url text,
  session_id text references public.driving_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists drivers_email_idx on public.drivers (email);
create index if not exists devices_serial_idx on public.devices (serial_number);
create index if not exists devices_driver_idx on public.devices (driver_id);
create index if not exists detection_logs_driver_time_idx on public.detection_logs (driver_id, timestamp desc);
create index if not exists detection_logs_device_time_idx on public.detection_logs (device_id, timestamp desc);
create index if not exists driving_sessions_driver_time_idx on public.driving_sessions (driver_id, started_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.devices enable row level security;
alter table public.detection_logs enable row level security;
alter table public.driving_sessions enable row level security;

drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "Drivers read own driver row" on public.drivers;
create policy "Drivers read own driver row"
on public.drivers
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage drivers" on public.drivers;
create policy "Admins manage drivers"
on public.drivers
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers read assigned devices" on public.devices;
create policy "Drivers read assigned devices"
on public.devices
for select
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage devices" on public.devices;
create policy "Admins manage devices"
on public.devices
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers read own logs" on public.detection_logs;
create policy "Drivers read own logs"
on public.detection_logs
for select
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage logs" on public.detection_logs;
create policy "Admins manage logs"
on public.detection_logs
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers read own sessions" on public.driving_sessions;
create policy "Drivers read own sessions"
on public.driving_sessions
for select
using (driver_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage sessions" on public.driving_sessions;
create policy "Admins manage sessions"
on public.driving_sessions
for all
using (public.is_admin())
with check (public.is_admin());

-- Create a Supabase Auth user for your administrator, then run:
-- insert into public.profiles (id, email, role)
-- values ('AUTH_USER_UUID_HERE', 'admin@example.com', 'admin')
-- on conflict (id) do update set role = 'admin', email = excluded.email;
