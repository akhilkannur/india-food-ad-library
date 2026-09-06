import type { Ad } from "./types";

/** Exclude explicit non-food product promotions, not whole multi-category brands.
 * This only affects the public catalogue; moderation retains every record. */
export function isFoodCreative(ad: Pick<Ad, "headline" | "body_copy" | "hook" | "category">) {
  const text = [ad.headline, ad.body_copy, ad.hook, ad.category].filter(Boolean).join(" ");
  return !/\b(?:hair[ -]?(?:mask|serum|oil|care)|shampoo|conditioner|skin[ -]?care|face[ -]?(?:wash|serum|cream)|sunscreen|lipstick|moisturi[sz]er|body[ -]?lotion|perfume)\b/i.test(text);
}
