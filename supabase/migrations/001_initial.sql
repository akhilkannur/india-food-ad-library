create extension if not exists pgcrypto;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  logo_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null default 'meta' check (platform in ('meta')),
  source_ad_id text,
  source_url text not null,
  headline text,
  body_copy text,
  cta text,
  format text not null,
  language text not null default 'English',
  category text not null,
  hook text,
  funnel_stage text,
  occasion text,
  offer text,
  creative_url text,
  thumbnail_url text,
  creative_theme text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  started_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, source_ad_id)
);

create index if not exists ads_public_index
  on public.ads (status, first_seen_at desc);

create index if not exists ads_review_queue_index
  on public.ads (status, submitted_at desc);

alter table public.brands enable row level security;
alter table public.ads enable row level security;

drop policy if exists "Anyone can read brands" on public.brands;
create policy "Anyone can read brands"
  on public.brands for select
  using (true);

drop policy if exists "Anyone can read approved ads" on public.ads;
create policy "Anyone can read approved ads"
  on public.ads for select
  using (status = 'approved');

comment on table public.ads is 'Curated food-ad records. Server routes use the service-role key for moderation; public clients can select approved rows only.';
