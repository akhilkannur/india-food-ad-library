import assert from "node:assert/strict";
import test from "node:test";
import {
  creativeUrlStatus,
  previewUrlForValidation,
  shouldTripCircuitBreaker,
} from "./creative-validation.js";

test("validation checks the same asset selected by the preview", () => {
  assert.equal(
    previewUrlForValidation({ format: "Video", creative_url: "https://cdn.example/video.mp4", thumbnail_url: "https://cdn.example/poster.jpg" }),
    "https://cdn.example/video.mp4",
  );
  assert.equal(
    previewUrlForValidation({ format: "Image", creative_url: "https://cdn.example/creative.jpg", thumbnail_url: "https://cdn.example/fallback.jpg" }),
    "https://cdn.example/creative.jpg",
  );
  assert.equal(
    previewUrlForValidation({ format: "Image", creative_url: null, thumbnail_url: "https://cdn.example/fallback.jpg" }),
    "https://cdn.example/fallback.jpg",
  );
});

test("a range GET can validate a CDN that rejects HEAD", async () => {
  const calls = [];
  const status = await creativeUrlStatus("https://cdn.example/creative.jpg", {
    fetchImpl: async (_url, options) => {
      calls.push(options);
      return new Response(null, { status: calls.length === 1 ? 405 : 206 });
    },
  });

  assert.equal(status, "alive");
  assert.equal(calls[1].headers.Range, "bytes=0-0");
});

test("a signed URL rejected by the CDN is dead", async () => {
  const status = await creativeUrlStatus("https://cdn.example/expired.jpg", {
    fetchImpl: async () => new Response(null, { status: 403 }),
  });
  assert.equal(status, "dead");
});

test("network and CDN availability failures are not treated as deletable", async () => {
  const status = await creativeUrlStatus("https://cdn.example/temporary.jpg", {
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
  });
  assert.equal(status, "unresolved");
});

test("circuit breaker does not trip below minimum sample threshold", () => {
  assert.equal(shouldTripCircuitBreaker(10, 15), false);
  assert.equal(shouldTripCircuitBreaker(1, 1), false);
});

test("circuit breaker does not trip when broken percentage is within acceptable limit", () => {
  assert.equal(shouldTripCircuitBreaker(10, 100), false);
  assert.equal(shouldTripCircuitBreaker(20, 100), false);
});

test("circuit breaker trips when broken percentage exceeds threshold", () => {
  assert.equal(shouldTripCircuitBreaker(21, 100), true);
  assert.equal(shouldTripCircuitBreaker(688, 688), true);
});
