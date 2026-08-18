"""Collect Indian food ads from Meta and queue new records in Supabase."""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from meta_ads_collector import MetaAdsCollector


ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
BRANDS = json.loads((ROOT / "data" / "brands.json").read_text(encoding="utf-8"))
DRY_RUN = os.environ.get("DRY_RUN") == "1"
BRAND_LIMIT = int(os.environ.get("BRAND_LIMIT", "0"))
BRAND_SLUG = os.environ.get("BRAND_SLUG", "").strip()
MAX_ADS_PER_BRAND = int(os.environ.get("MAX_ADS_PER_BRAND", "24"))
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not DRY_RUN and (not SUPABASE_URL or not SERVICE_KEY):
    raise RuntimeError(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless DRY_RUN=1."
    )

if BRAND_SLUG:
    SELECTED_BRANDS = [brand for brand in BRANDS if brand["slug"] == BRAND_SLUG]
elif BRAND_LIMIT > 0:
    SELECTED_BRANDS = BRANDS[:BRAND_LIMIT]
else:
    SELECTED_BRANDS = BRANDS

if not SELECTED_BRANDS:
    raise RuntimeError(f"No configured brand matched BRAND_SLUG={BRAND_SLUG!r}.")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(value: Any, limit: int = 1600) -> str | None:
    if not isinstance(value, str):
        return None
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit] or None


def language_for(text: str) -> str:
    if re.search(r"[\u0900-\u097F]", text):
        return "Hindi"
    if re.search(r"\b(kya|hai|hain|ka|ki|ke|se|aur|nahi|ab|apna|swad|swaad)\b", text, re.I):
        return "Hinglish"
    return "English"


def hook_for(text: str) -> str:
    if re.search(r"\b(save|off|discount|deal|offer|free|rs\.?\s?\d|% off)\b|₹", text, re.I):
        return "Offer-led"
    if re.search(r"\b(how to|ways|tips|recipe|did you know)\b", text, re.I):
        return "Education"
    if re.search(r"\b(why|problem|tired of|struggling|instead of)\b", text, re.I):
        return "Problem / solution"
    if re.search(r"\b(review|customer|loved by|testimonial|people love)\b", text, re.I):
        return "Social proof"
    return "Product-first"


def page_matches_brand(page_name: str | None, brand: dict[str, Any]) -> bool:
    if not page_name:
        return False
    haystack = re.sub(r"[^a-z0-9]+", " ", page_name.lower()).strip()
    candidates = [brand["name"], brand["slug"], *brand.get("queries", [])]
    needles = [re.sub(r"[^a-z0-9]+", " ", value.lower()).strip() for value in candidates]
    return any(needle in haystack or haystack in needle for needle in needles if len(needle) > 2)


def candidate_from_ad(ad: Any, brand: dict[str, Any]) -> dict[str, Any] | None:
    if not ad.id or not page_matches_brand(ad.page.name if ad.page else None, brand):
        return None

    creatives = ad.creatives or []
    primary = next(
        (
            creative
            for creative in creatives
            if creative.body
            or creative.title
            or creative.image_url
            or creative.video_url
            or creative.video_hd_url
            or creative.video_sd_url
        ),
        creatives[0] if creatives else None,
    )
    body = clean(primary.body if primary else None)
    headline = clean(primary.title if primary else None, 300)
    description = clean(primary.description if primary else None)
    combined = " ".join(value for value in [headline, body, description] if value)
    video = (
        (primary.video_hd_url or primary.video_sd_url or primary.video_url)
        if primary
        else None
    )
    image = primary.image_url if primary else None
    thumbnail = primary.thumbnail_url if primary else None
    if len(creatives) > 1:
        ad_format = "Carousel"
    elif video:
        ad_format = "Video"
    elif image:
        ad_format = "Image"
    else:
        ad_format = "Unknown"

    started_at = ad.delivery_start_time.isoformat() if ad.delivery_start_time else None
    source_url = ad.ad_snapshot_url or ad.snapshot_url
    if not source_url or "facebook.com" not in source_url:
        source_url = f"https://www.facebook.com/ads/library/?id={ad.id}"

    record = {
        "platform": "meta",
        "source_ad_id": str(ad.id),
        "source_url": source_url,
        "headline": headline,
        "body_copy": body,
        "cta": clean(primary.cta_text if primary else None, 120),
        "format": ad_format,
        "language": language_for(combined),
        "category": brand["category"],
        "hook": hook_for(combined),
        "funnel_stage": (
            "Conversion"
            if re.search(r"shop now|buy now|order now|get offer", combined, re.I)
            else "Consideration"
        ),
        "creative_url": video or image,
        "thumbnail_url": thumbnail or image,
        "creative_theme": "auto-imported",
        "started_at": started_at,
        "first_seen_at": now(),
        "last_seen_at": now(),
    }
    return {"brand": brand, "page_name": ad.page.name if ad.page else None, "ad": record}


def supabase(path: str, method: str = "GET", payload: Any = None, prefer: str | None = None) -> Any:
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    request = Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        method=method,
        headers=headers,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
    )
    try:
        with urlopen(request, timeout=45) as response:
            body = response.read()
            return json.loads(body) if body else None
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {error.code}: {detail}") from error


def queue_candidate(candidate: dict[str, Any]) -> bool:
    brand_payload = {
        "name": candidate["brand"]["name"],
        "slug": candidate["brand"]["slug"],
        "category": candidate["brand"]["category"],
    }
    brand_rows = supabase(
        "brands?on_conflict=slug&select=id",
        "POST",
        brand_payload,
        "resolution=merge-duplicates,return=representation",
    )
    ad_payload = {
        **candidate["ad"],
        "brand_id": brand_rows[0]["id"],
        "status": "pending",
        "submitted_at": now(),
    }
    ad_rows = supabase(
        "ads?on_conflict=platform,source_ad_id&select=id",
        "POST",
        ad_payload,
        "resolution=ignore-duplicates,return=representation",
    )
    return bool(ad_rows)


def main() -> int:
    discovered: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []

    with MetaAdsCollector(rate_limit_delay=2.0, jitter=1.0, max_retries=3) as collector:
        for brand in SELECTED_BRANDS:
            before = len(discovered)
            for query in brand.get("queries", [brand["name"]]):
                try:
                    for ad in collector.search(
                        query=query,
                        country="IN",
                        status=collector.STATUS_ACTIVE,
                        search_type=collector.SEARCH_KEYWORD,
                        sort_by=collector.SORT_RELEVANCY,
                        max_results=MAX_ADS_PER_BRAND,
                        page_size=min(MAX_ADS_PER_BRAND, 30),
                    ):
                        candidate = candidate_from_ad(ad, brand)
                        if candidate:
                            discovered.setdefault(candidate["ad"]["source_ad_id"], candidate)
                        if len(discovered) - before >= MAX_ADS_PER_BRAND:
                            break
                except Exception as error:  # A failed brand must not discard the rest of the run.
                    failures.append({"brand": brand["name"], "query": query, "error": str(error)})
                    print(f"{brand['name']} ({query}): {error}", file=sys.stderr)
            print(f"{brand['name']}: {len(discovered) - before} candidate(s)")

    queued = 0
    duplicates = 0
    if not DRY_RUN:
        for candidate in discovered.values():
            if queue_candidate(candidate):
                queued += 1
            else:
                duplicates += 1

    report = {
        "ran_at": now(),
        "collector": "meta-ads-collector@1.4.0",
        "brands_attempted": len(SELECTED_BRANDS),
        "discovered": len(discovered),
        "queued": queued,
        "duplicates": duplicates,
        "failures": failures,
        "records": list(discovered.values()),
    }
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACT_DIR / "run.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str) + "\n",
        encoding="utf-8",
    )
    print(
        f"Discovered {len(discovered)}; queued {queued}; "
        f"duplicates {duplicates}; failures {len(failures)}."
    )

    if not discovered:
        raise RuntimeError(
            "No matching ads were discovered. Meta may have changed its response or blocked the runner."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
