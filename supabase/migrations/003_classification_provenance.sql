alter table public.ads
  add column if not exists classification_source text,
  add column if not exists classified_at timestamptz;

create index if not exists ads_classification_source_index
  on public.ads (classification_source, classified_at desc);

comment on column public.ads.classification_source is
  'Origin of the curated classification. Null means the labels came from import heuristics.';

comment on column public.ads.classified_at is
  'Timestamp of the most recent curated classification.';
