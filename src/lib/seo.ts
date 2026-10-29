import type { Ad } from "@/lib/types";
import { getLandingDefinitions, type CollectionDefinition, type LandingField } from "@/lib/collections";
import { isVideoCreative } from "@/lib/media";
import { getBrandCategoryDefinitions } from "@/lib/brand-categories";

/** "Taste/craving" → "Taste & craving" so labels read naturally in titles. */
export function displayLabel(value: string) {
  return value.replace(/\s*\/\s*/g, " & ");
}

/** Trim to a word boundary so search titles stay inside ~60 characters. */
export function clampText(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}

function titleCase(value: string) {
  return value.replace(/(^|[\s-])([a-z])/g, (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function ranked(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export type AdSummary = {
  total: number;
  videoShare: number;
  brands: Array<{ name: string; slug: string; count: number }>;
  styles: Array<[string, number]>;
  angles: Array<[string, number]>;
  categories: Array<[string, number]>;
  languages: Array<[string, number]>;
};

export function summarizeAds(ads: Ad[]): AdSummary {
  const brandCounts = new Map<string, { name: string; slug: string; count: number }>();
  ads.forEach((ad) => {
    const entry = brandCounts.get(ad.brand.slug) || { name: ad.brand.name, slug: ad.brand.slug, count: 0 };
    entry.count += 1;
    brandCounts.set(ad.brand.slug, entry);
  });
  return {
    total: ads.length,
    videoShare: ads.length ? Math.round((ads.filter(isVideoCreative).length / ads.length) * 100) : 0,
    brands: Array.from(brandCounts.values()).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    styles: ranked(ads.map((ad) => ad.creative_style)),
    angles: ranked(ads.map((ad) => ad.selling_angle)),
    categories: ranked(ads.map((ad) => ad.category)),
    languages: ranked(ads.map((ad) => ad.language)),
  };
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const FIELD_COPY: Record<LandingField, {
  heading: (name: string) => string;
  title: (name: string, total: number, brands: number) => string;
  noun: (name: string) => string;
}> = {
  category: {
    heading: (name) => `${name} Facebook ad examples from Indian brands`,
    title: (name, total, brands) => `${name} Facebook Ad Examples — ${total} Indian Meta Creatives${brands > 1 ? ` (${brands} Brands)` : ""}`,
    noun: (name) => `${name.toLowerCase()} ad examples`,
  },
  selling_angle: {
    heading: (name) => `${name}-angle Facebook ad examples`,
    title: (name, total) => `${name} Angle Facebook Ad Examples — ${total} Indian Food Ads`,
    noun: (name) => `food and beverage ad examples selling on ${name.toLowerCase()}`,
  },
  creative_style: {
    heading: (name) => `${name} Facebook ad examples`,
    title: (name, total) => `${name} Facebook Ad Examples — ${total} Indian Food & Beverage Ads`,
    noun: (name) => `${name.toLowerCase()} ad examples`,
  },
  format: {
    heading: (name) => `${name} ad creative examples`,
    title: (name, total) => `${name} Facebook Ad Examples — ${total} Indian Food Creatives`,
    noun: (name) => `${name.toLowerCase()} ad examples`,
  },
  language: {
    heading: (name) => `${name} Facebook ad examples`,
    title: (name, total) => `${name} Facebook Ad Examples — ${total} Indian Creatives`,
    noun: (name) => `${name}-language ad examples`,
  },
};

export function landingCopy(definition: CollectionDefinition, ads: Ad[]) {
  const summary = summarizeAds(ads);
  const name = displayLabel(definition.name);
  const copy = FIELD_COPY[definition.field];
  const topBrands = summary.brands.slice(0, 3).map((brand) => brand.name);
  const source = summary.brands.length === 1
    ? `from ${topBrands[0]}`
    : `from ${summary.brands.length} Indian brands, including ${listNames(topBrands)}`;

  const sentences = [`${summary.total} ${copy.noun(name)} ${source}.`];
  if (summary.videoShare > 0 && summary.videoShare < 100) sentences.push(`${summary.videoShare}% are video creatives.`);
  const topStyle = summary.styles[0];
  if (definition.field !== "creative_style" && topStyle) {
    sentences.push(`The most common execution is ${displayLabel(topStyle[0]).toLowerCase()} (${topStyle[1]} ads).`);
  }
  const topAngle = summary.angles[0];
  if (definition.field !== "selling_angle" && topAngle) {
    sentences.push(`Most lead with a ${displayLabel(topAngle[0]).toLowerCase()} message (${topAngle[1]} ads).`);
  }
  const topCategory = summary.categories[0];
  if (definition.field !== "category" && topCategory) {
    sentences.push(`${topCategory[0]} brands contribute the most examples.`);
  }
  sentences.push("Compare hooks, offers and CTAs side by side before your next brief.");

  return {
    heading: copy.heading(name),
    title: copy.title(titleCase(name), summary.total, summary.brands.length),
    description: clampText(
      `Browse ${summary.total} ${copy.noun(name)} from ${listNames(topBrands) || "Indian brands"}. Real Meta creatives with hooks, angles and CTAs for D2C teams.`,
      158,
    ),
    intro: sentences.join(" "),
    summary,
  };
}

export function brandCopy(ads: Ad[]) {
  const summary = summarizeAds(ads);
  const brand = ads[0].brand;
  const sentences = [
    `${plural(summary.total, "Meta ad")} from ${brand.name}, a ${brand.category.toLowerCase()} brand.`,
    `${summary.videoShare}% are video.`,
  ];
  if (summary.styles[0]) sentences.push(`Their go-to execution is ${displayLabel(summary.styles[0][0]).toLowerCase()} (${summary.styles[0][1]} ads).`);
  if (summary.angles[0]) {
    const angles = summary.angles.slice(0, 2).map(([angle]) => displayLabel(angle).toLowerCase());
    sentences.push(`Messaging leans on ${listNames(angles)}.`);
  }
  if (summary.videoShare === 0 || summary.videoShare === 100) sentences.splice(1, 1, summary.videoShare ? "All are video." : "All are static images.");
  if (summary.languages.length > 1) sentences.push(`Ads run in ${listNames(summary.languages.map(([language]) => language))}.`);
  return {
    intro: sentences.join(" "),
    description: clampText(
      `See ${summary.total} ${brand.name} Meta ads — ${summary.styles[0] ? `${displayLabel(summary.styles[0][0]).toLowerCase()} creatives, ` : ""}hooks, angles and CTAs from this Indian ${brand.category.toLowerCase()} brand.`,
      158,
    ),
    summary,
  };
}

/** Brand pages below this size are kept out of the index as thin content. */
export const MIN_INDEXABLE_BRAND_ADS = 3;

/** Brand-category hub pages below this size are noindex. */
export const MIN_INDEXABLE_BRAND_CATEGORY_ADS = 15;

/** SEO copy for a brand-category hub page (e.g. /brands/category/coffee). */
export function brandCategoryCopy(categoryName: string, ads: Ad[]) {
  const summary = summarizeAds(ads);
  const topBrands = summary.brands.slice(0, 3).map((b) => b.name);
  const title = `${categoryName} Facebook Ad Examples — ${summary.total} Meta Creatives from ${summary.brands.length} Indian Brands`;
  const topStyle = summary.styles[0];
  const topAngle = summary.angles[0];
  const sentences = [
    `${summary.total} Meta ads from ${summary.brands.length} Indian ${categoryName.toLowerCase()} brands, including ${listNames(topBrands)}.`,
    summary.videoShare > 0 && summary.videoShare < 100 ? `${summary.videoShare}% are video creatives.` : null,
    topStyle ? `The most common format is ${displayLabel(topStyle[0]).toLowerCase()} (${topStyle[1]} ads).` : null,
    topAngle ? `Most ads lead with a ${displayLabel(topAngle[0]).toLowerCase()} message.` : null,
    "Browse hooks, formats and CTAs side by side before your next brief.",
  ].filter(Boolean) as string[];

  return {
    title,
    description: clampText(
      `Browse ${summary.total} Indian ${categoryName.toLowerCase()} brand Meta ads from ${listNames(topBrands)}. Real creatives with hooks, angles and CTAs for DTC teams.`,
      158,
    ),
    intro: sentences.join(" "),
  };
}

const GROUP_TITLES: Record<LandingField, string> = {
  category: "By category",
  selling_angle: "By message angle",
  creative_style: "By creative style",
  format: "By media type",
  language: "By language",
};

function landingLabel(definition: CollectionDefinition) {
  const name = displayLabel(definition.name);
  return definition.field === "selling_angle" ? `${name} angle ads` : `${name} ads`;
}

export function browseGroups(ads: Ad[], { exclude, excludeCategorySlug }: { exclude?: string; excludeCategorySlug?: string } = {}) {
  const definitions = getLandingDefinitions(ads).filter((definition) => definition.slug !== exclude);
  const fields = Object.keys(GROUP_TITLES) as LandingField[];
  const brands = summarizeAds(ads).brands.filter((brand) => brand.count >= MIN_INDEXABLE_BRAND_ADS);
  const brandCategories = getBrandCategoryDefinitions(ads).filter((c) => c.slug !== excludeCategorySlug);
  return [
    ...fields.map((field) => ({
      title: GROUP_TITLES[field],
      links: definitions
        .filter((definition) => definition.field === field)
        .map((definition) => ({ href: `/collections/${definition.slug}`, label: landingLabel(definition) })),
    })),
    {
      title: "By brand category",
      links: brandCategories.map((c) => ({ href: `/brands/category/${c.slug}`, label: `${c.name} ads` })),
    },
    {
      title: "By brand",
      links: brands.map((brand) => ({ href: `/brands/${brand.slug}`, label: `${brand.name} ads` })),
    },
  ];
}

/** Landing pages an ad belongs to, for contextual internal links. */
export function adLandingLinks(ad: Ad, ads: Ad[]) {
  return getLandingDefinitions(ads)
    .filter((definition) => definition.field !== "format" && definition.match(ad))
    .map((definition) => ({ href: `/collections/${definition.slug}`, label: landingLabel(definition) }));
}
