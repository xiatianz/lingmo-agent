create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  github_username text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists private.user_model_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_label text not null default 'OpenAI Compatible',
  base_url text not null,
  model text not null,
  encrypted_api_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.user_model_keys enable row level security;

create table if not exists private.user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_request_limit integer,
  daily_token_limit integer,
  byok_bypass_limit boolean,
  updated_at timestamptz not null default now()
);

alter table private.user_limits enable row level security;

create table if not exists private.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table private.usage_daily enable row level security;

create table if not exists private.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table private.app_settings enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists user_model_keys_touch_updated_at on private.user_model_keys;
create trigger user_model_keys_touch_updated_at
  before update on private.user_model_keys
  for each row execute function public.touch_updated_at();

drop trigger if exists user_limits_touch_updated_at on private.user_limits;
create trigger user_limits_touch_updated_at
  before update on private.user_limits
  for each row execute function public.touch_updated_at();

drop trigger if exists usage_daily_touch_updated_at on private.usage_daily;
create trigger usage_daily_touch_updated_at
  before update on private.usage_daily
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch_updated_at on private.app_settings;
create trigger app_settings_touch_updated_at
  before update on private.app_settings
  for each row execute function public.touch_updated_at();
