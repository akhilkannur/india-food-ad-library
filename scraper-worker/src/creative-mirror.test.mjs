import assert from "node:assert/strict";
import test from "node:test";
import {
  extensionFor,
  isMirroredUrl,
  isSourceUrl,
  planMirror,
  preserveMirroredUrls,
  VIDEO_SOURCE_ONLY_NOTE,
} from "./creative-mirror.js";

const SUPABASE = "https://project.supabase.co";
const stored = (path) => `${SUPABASE}/storage/v1/object/public/creatives/${path}`;
const cdn = (name) => `https://scontent-atl3-2.xx.fbcdn.net/v/t39/${name}?oe=6720A1B2`;

test("recognises stored copies and Meta CDN sources", () => {
  assert.equal(isMirroredUrl(stored("a/image.jpg"), SUPABASE), true);
  assert.equal(isMirroredUrl(stored("a/image.jpg"), `${SUPABASE}/`), true);
  assert.equal(isMirroredUrl(cdn("a.jpg"), SUPABASE), false);
  assert.equal(isSourceUrl(cdn("a.jpg")), true);
  assert.equal(isSourceUrl(stored("a/image.jpg")), false);
  assert.equal(isSourceUrl(null), false);
});

test("picks file extensions from content type, then URL", () => {
  assert.equal(extensionFor("image/jpeg", ""), "jpg");
  assert.equal(extensionFor("video/mp4; codecs=avc1", ""), "mp4");
  assert.equal(extensionFor("application/octet-stream", "https://x/y.webp?z=1"), "webp");
  assert.equal(extensionFor("video/x-unknown", "https://x/y"), "mp4");
});

test("plans one copy for image ads sharing a URL", () => {
  const plan = planMirror({ format: "Image", creative_url: cdn("a.jpg"), thumbnail_url: cdn("a.jpg") });
  assert.deepEqual(plan, { poster: cdn("a.jpg"), creative: null, sharedImage: true, video: false });
});

test("plans poster and video copies, skipping videos marked source-only", () => {
  const ad = { format: "Video", creative_url: cdn("v.mp4"), thumbnail_url: cdn("p.jpg") };
  assert.deepEqual(planMirror(ad), { poster: cdn("p.jpg"), creative: cdn("v.mp4"), sharedImage: false, video: true });
  assert.equal(planMirror({ ...ad, thumbnail_url: stored("x/poster.jpg"), reviewer_notes: VIDEO_SOURCE_ONLY_NOTE }), null);
});

test("returns null once everything is stored", () => {
  assert.equal(planMirror({ format: "Video", creative_url: stored("x/creative.mp4"), thumbnail_url: stored("x/poster.jpg") }), null);
});

test("refreshes keep stored URLs instead of fresh expiring ones", () => {
  const fresh = { creative_url: cdn("v2.mp4"), thumbnail_url: cdn("p2.jpg") };
  assert.deepEqual(
    preserveMirroredUrls(fresh, { creative_url: stored("x/creative.mp4"), thumbnail_url: stored("x/poster.jpg") }, SUPABASE),
    { creative_url: stored("x/creative.mp4"), thumbnail_url: stored("x/poster.jpg") },
  );
  assert.deepEqual(
    preserveMirroredUrls(fresh, { creative_url: null, thumbnail_url: stored("x/poster.jpg") }, SUPABASE),
    { creative_url: null, thumbnail_url: stored("x/poster.jpg") },
  );
  assert.deepEqual(preserveMirroredUrls(fresh, { creative_url: cdn("v.mp4"), thumbnail_url: cdn("p.jpg") }, SUPABASE), fresh);
});
