const DEAD_GET_STATUSES = new Set([400, 401, 403, 404, 410]);

export function previewUrlForValidation(ad) {
  const creativeUrl = ad.creative_url || null;
  const isVideo = /video/i.test(ad.format || "") || /\.(mp4|webm|mov)(?:\?|$)/i.test(creativeUrl || "");
  return isVideo && creativeUrl ? creativeUrl : creativeUrl || ad.thumbnail_url || null;
}

function responseStatus(response) {
  if (response.ok) return "alive";
  return DEAD_GET_STATUSES.has(response.status) ? "dead" : "unresolved";
}

export async function creativeUrlStatus(url, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  if (!url || !/^https:\/\//i.test(url)) return "dead";

  const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
  const headers = {
    Referer: "https://www.facebook.com/",
    "User-Agent": "IndiaFoodAdLibrary/1.0 (creative-health-check)",
  };

  try {
    const head = await fetchImpl(url, { method: "HEAD", headers, redirect: "follow", ...(signal ? { signal } : {}) });
    if (head.ok || [404, 410].includes(head.status)) return responseStatus(head);
  } catch {
    // Some CDNs reject or time out HEAD requests even when a ranged GET works.
  }

  try {
    const get = await fetchImpl(url, {
      headers: { ...headers, Range: "bytes=0-0" },
      redirect: "follow",
      ...(signal ? { signal } : {}),
    });
    return responseStatus(get);
  } catch {
    return "unresolved";
  }
}
