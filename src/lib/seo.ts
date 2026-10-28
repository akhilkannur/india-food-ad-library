import type { Ad } from "@/lib/types";
import { getLandingDefinitions, type CollectionDefinition, type LandingField } from "@/lib/collections";
import { isVideoCreative } from "@/lib/media";

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
    heading: (name) => `${name} ads from Indian brands`,
    title: (name, total, brands) => `${name} Ads in India — ${total} Meta Ad Examples${brands > 1 ? ` from ${brands} Brands` : ""}`,
    noun: (name) => `${name.toLowerCase()} ads`,
  },
  selling_angle: {
    heading: (name) => `${name}-led food & beverage ads`,
    title: (name, total) => `${name} Angle Food Ads — ${total} Indian Meta Ad Examples`,
    noun: (name) => `food and beverage ads selling on ${name.toLowerCase()}`,
  },
  creative_style: {
    heading: (name) => `${name} food ads`,
    title: (name, total) => `${name} Food Ads — ${total} Indian Meta Ad Examples`,
    noun: (name) => `${name.toLowerCase()} creatives`,
  },
  format: {
    heading: (name) => `${name} food & beverage ads`,
    title: (name, total) => `${name} Food & Beverage Ads — ${total} Indian Meta Ad Examples`,
    noun: (name) => `${name.toLowerCase()} ads`,
  },
  language: {
    heading: (name) => `${name} food & beverage ads`,
    title: (name, total) => `${name} Food Ads — ${total} Indian Meta Ad Examples`,
    noun: (name) => `${name}-language food and beverage ads`,
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

export function browseGroups(ads: Ad[], { exclude }: { exclude?: string } = {}) {
  const definitions = getLandingDefinitions(ads).filter((definition) => definition.slug !== exclude);
  const fields = Object.keys(GROUP_TITLES) as LandingField[];
  const brands = summarizeAds(ads).brands.filter((brand) => brand.count >= MIN_INDEXABLE_BRAND_ADS);
  return [
    ...fields.map((field) => ({
      title: GROUP_TITLES[field],
      links: definitions
        .filter((definition) => definition.field === field)
        .map((definition) => ({ href: `/collections/${definition.slug}`, label: landingLabel(definition) })),
    })),
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
