insert into public.brands (name, slug, category)
values
  ('Mitti Pantry', 'mitti-pantry', 'Staples'),
  ('Nimboo Club', 'nimboo-club', 'Beverages'),
  ('Good Grain Co.', 'good-grain', 'Breakfast')
on conflict (slug) do nothing;

insert into public.ads (
  brand_id,
  source_url,
  headline,
  body_copy,
  cta,
  format,
  language,
  category,
  hook,
  funnel_stage,
  creative_theme,
  status
)
select
  id,
  'https://www.facebook.com/ads/library/',
  'Seed record awaiting review',
  'Replace this seed content with a verified ad-library record.',
  'Shop now',
  'Studio shot',
  'English',
  category,
  'Product-first',
  'Consideration',
  'turmeric',
  'pending'
from public.brands
where slug = 'mitti-pantry'
and not exists (
  select 1 from public.ads where headline = 'Seed record awaiting review'
);
