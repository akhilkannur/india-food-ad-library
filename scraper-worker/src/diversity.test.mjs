import test from "node:test";
import assert from "node:assert/strict";
import { creativeClusterKey, normalizeCreativeText, selectDiverseCandidates } from "./diversity.js";

function ad(overrides = {}) {
  return {
    source_ad_id: crypto.randomUUID(),
    format: "Image",
    creative_style: "Product shot",
    selling_angle: "Taste/craving",
    hook: "Product-first",
    headline: "Try our crunchy snack today",
    body_copy: "Made for evening cravings",
    creative_url: `https://cdn.example.com/${crypto.randomUUID()}.jpg?token=signed`,
    ...overrides,
  };
}

test("normalization removes offer numbers so price variants can match", () => {
  assert.equal(normalizeCreativeText("Save ₹299 — get 20% off"), "save get");
});

test("cluster key describes the creative concept rather than the product", () => {
  assert.equal(
    creativeClusterKey(ad()),
    "image|product shot|taste craving|product first",
  );
});

test("near-identical copy variants keep one representative", () => {
  const first = ad({ headline: "Crunchy chips for every evening", body_copy: "Order today and save ₹100" });
  const variant = ad({ headline: "Crunchy chips for every evening", body_copy: "Order today and save ₹200" });
  const result = selectDiverseCandidates([first, variant], [], { maxSelected: 10, maxPerCluster: 2 });
  assert.equal(result.selected.length, 1);
  assert.equal(result.skippedSimilar, 1);
});

test("same media with different signed query strings is deduplicated", () => {
  const first = ad({ creative_url: "https://cdn.example.com/creative.jpg?token=one" });
  const variant = ad({ creative_url: "https://cdn.example.com/creative.jpg?token=two", headline: "Different product" });
  const result = selectDiverseCandidates([first, variant]);
  assert.equal(result.selected.length, 1);
});

test("round-robin selection favours different concepts", () => {
  const productOne = ad({ source_ad_id: "product-1" });
  const productTwo = ad({ source_ad_id: "product-2", headline: "A completely different flavour for lunch" });
  const ugc = ad({ source_ad_id: "ugc-1", format: "Video", creative_style: "UGC", headline: "Watch my honest taste test" });
  const recipe = ad({ source_ad_id: "recipe-1", format: "Video", creative_style: "Recipe/how-to", hook: "Education", headline: "Three steps to a quick breakfast" });
  const result = selectDiverseCandidates([productOne, productTwo, ugc, recipe], [], { maxSelected: 3, maxPerCluster: 2 });
  assert.deepEqual(result.selected.map((item) => item.source_ad_id), ["product-1", "ugc-1", "recipe-1"]);
  assert.equal(result.skippedCapacity, 1);
});

test("clusters are ordered for variety without dropping valid inventory", () => {
  const candidates = [
    ad({ source_ad_id: "one", headline: "Crunchy millet bites for movie night" }),
    ad({ source_ad_id: "two", headline: "Spicy potato chips made for parties" }),
    ad({ source_ad_id: "three", headline: "Tangy banana crisps in a sharing pack" }),
  ];
  const result = selectDiverseCandidates(candidates, [], { maxSelected: 10 });
  assert.equal(result.selected.length, 3);
  assert.equal(result.skippedCluster, 0);
  assert.equal(result.skippedCapacity, 0);
});

test("an explicit cluster cap is still available", () => {
  const candidates = [
    ad({ source_ad_id: "one", headline: "Crunchy millet bites for movie night" }),
    ad({ source_ad_id: "two", headline: "Spicy potato chips made for parties" }),
    ad({ source_ad_id: "three", headline: "Tangy banana crisps in a sharing pack" }),
  ];
  const result = selectDiverseCandidates(candidates, [], { maxSelected: 10, maxPerCluster: 2 });
  assert.equal(result.selected.length, 2);
  assert.equal(result.skippedCluster, 1);
});

test("existing near-duplicates are not queued again", () => {
  const existing = [ad({ source_ad_id: "old-1", creative_url: "https://cdn.example.com/existing.jpg?old=one" })];
  const candidate = ad({ source_ad_id: "new-1", creative_url: "https://cdn.example.com/existing.jpg?new=two", headline: "A newly launched product for parties" });
  const result = selectDiverseCandidates([candidate], existing, { maxPerCluster: 2 });
  assert.equal(result.selected.length, 0);
  assert.equal(result.skippedSimilar, 1);
});
