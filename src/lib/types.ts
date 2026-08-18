export const AD_STATUSES = ["pending", "approved", "rejected"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export type Brand = {
  id: string;
  name: string;
  slug: string;
  category: string;
  logo_url?: string | null;
  website_url?: string | null;
};

export type Ad = {
  id: string;
  brand_id: string;
  brand: Brand;
  platform: "meta";
  source_ad_id?: string | null;
  source_url: string;
  headline?: string | null;
  body_copy?: string | null;
  cta?: string | null;
  format: string;
  language: string;
  category: string;
  hook?: string | null;
  funnel_stage?: string | null;
  occasion?: string | null;
  offer?: string | null;
  creative_url?: string | null;
  thumbnail_url?: string | null;
  creative_theme?: string | null;
  creative_style?: string | null;
  selling_angle?: string | null;
  status: AdStatus;
  started_at?: string | null;
  first_seen_at: string;
  last_seen_at?: string | null;
  submitted_at: string;
  approved_at?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
};

export type AdInsert = Omit<Ad, "id" | "brand" | "approved_at" | "reviewed_at"> & {
  id?: string;
};
