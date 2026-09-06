import assert from "node:assert/strict";
import test from "node:test";
import { isVideoCreative } from "./media.ts";

test("media toggle and player share the same video classification", () => {
  assert.equal(isVideoCreative({ format: "Video", creative_url: null }), true);
  assert.equal(isVideoCreative({ format: "Reel video", creative_url: "https://example.test/creative" }), true);
  assert.equal(isVideoCreative({ format: "Unknown", creative_url: "https://example.test/ad.mp4?token=x" }), true);
  assert.equal(isVideoCreative({ format: "Unknown", creative_url: "https://example.test/ad.webm" }), true);
  assert.equal(isVideoCreative({ format: "Image", creative_url: "https://example.test/ad.jpg" }), false);
  assert.equal(isVideoCreative({ format: "Image", creative_url: null }), false);
});
