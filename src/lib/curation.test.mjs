import assert from "node:assert/strict";
import test from "node:test";
import { isFoodCreative } from "./curation.ts";

test("public curation excludes explicit beauty products without excluding food brands", () => {
  for (const headline of ["POV - Messy Hair Mask", "Try our face serum", "Daily sunscreen", "New shampoo"]) {
    assert.equal(isFoodCreative({ headline }), false, headline);
  }
  for (const headline of ["Cold pressed coconut oil for cooking", "Protein for healthy hair and skin", "Milk conditioner: shampoo", "Almond butter for breakfast"]) {
    assert.equal(isFoodCreative({ headline }), !headline.includes("shampoo"), headline);
  }
  assert.equal(isFoodCreative({ category: "Skin care", headline: "Daily essentials" }), false);
  assert.equal(isFoodCreative({ headline: null, body_copy: null }), true);
});
