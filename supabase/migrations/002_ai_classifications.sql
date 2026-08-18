alter table public.ads
  add column if not exists creative_style text,
  add column if not exists selling_angle text;

comment on column public.ads.creative_style is 'AI-assisted creative format label, reviewed by an administrator.';
comment on column public.ads.selling_angle is 'AI-assisted customer-facing message label, reviewed by an administrator.';
