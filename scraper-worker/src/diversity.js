const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "our", "the", "this", "to", "with", "your",
]);

export function normalizeCreativeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[₹$€£]?\s*\d+(?:[.,]\d+)*(?:\s*%?\s*(?:off|rs))?/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentTokens(ad) {
  return new Set(
    normalizeCreativeText([ad.headline, ad.body_copy || ad.body].filter(Boolean).join(" "))
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function similarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function mediaKey(ad) {
  const raw = ad.creative_url || ad.thumbnail_url || ad.video || ad.image;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return String(raw).split("?")[0].toLowerCase();
  }
}

export function creativeClusterKey(ad) {
  return [
    ad.format || "unknown",
    ad.creative_style || "unclassified",
    ad.selling_angle || "unclassified",
    ad.hook || "unclassified",
  ].map(normalizeCreativeText).join("|");
}

function isNearDuplicate(candidate, comparison) {
  const candidateMedia = mediaKey(candidate);
  const comparisonMedia = mediaKey(comparison);
  if (candidateMedia && comparisonMedia && candidateMedia === comparisonMedia) return true;

  const candidateTokens = contentTokens(candidate);
  const comparisonTokens = contentTokens(comparison);
  return candidateTokens.size >= 5 && comparisonTokens.size >= 5 && similarity(candidateTokens, comparisonTokens) >= 0.82;
}

export function selectDiverseCandidates(candidates, existing = [], options = {}) {
  const maxSelected = options.maxSelected ?? 24;
  const maxPerCluster = options.maxPerCluster ?? Number.POSITIVE_INFINITY;
  const unique = [];
  let skippedSimilar = 0;

  for (const candidate of candidates) {
    if ([...existing, ...unique].some((item) => isNearDuplicate(candidate, item))) {
      skippedSimilar += 1;
      continue;
    }
    unique.push(candidate);
  }

  const clusterCounts = new Map();

  const groups = new Map();
  for (const candidate of unique) {
    const key = creativeClusterKey(candidate);
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  }

  const selected = [];
  let skippedCluster = 0;
  let skippedCapacity = 0;
  let madeSelection = true;
  while (selected.length < maxSelected && madeSelection) {
    madeSelection = false;
    for (const [key, group] of groups) {
      if (!group.length || selected.length >= maxSelected) continue;
      if ((clusterCounts.get(key) || 0) >= maxPerCluster) {
        skippedCluster += group.length;
        group.length = 0;
        continue;
      }
      selected.push(group.shift());
      clusterCounts.set(key, (clusterCounts.get(key) || 0) + 1);
      madeSelection = true;
    }
  }

  for (const group of groups.values()) {
    if (selected.length >= maxSelected) skippedCapacity += group.length;
    else skippedCluster += group.length;
  }
  return { selected, skippedSimilar, skippedCluster, skippedCapacity };
}
