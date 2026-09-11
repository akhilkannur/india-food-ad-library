"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { CreativePreview } from "@/components/creative-preview";
import type { Ad } from "@/lib/types";
import { isVideoCreative } from "@/lib/media";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdCard({
  ad,
  priority,
  onOpen,
  onUnavailable,
}: {
  ad: Ad;
  priority: boolean;
  onOpen?: () => void;
  onUnavailable?: () => void;
}) {
  return (
    <article className="ad-card">
      <div className="ad-card__media">
        <CreativePreview ad={ad} compact inlinePlayback priority={priority} onUnavailable={onUnavailable} />
        {!isVideoCreative(ad) && onOpen && <button className="ad-card__trigger" type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`Inspect ${ad.brand.name} ad: ${ad.headline || ad.format}`} />}
      </div>

      <div className="ad-card__content">
        <div className="ad-card__identity">
          {ad.brand.logo_url ? (
            // Dynamic advertiser logos are supplied by approved brand records.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.brand.logo_url} alt="" className="ad-card__logo" loading="lazy" />
          ) : (
            <span className="ad-card__monogram" aria-hidden="true">{ad.brand.name.charAt(0)}</span>
          )}
          <Link className="ad-card__brand" href={`/brands/${ad.brand.slug}`}>{ad.brand.name}</Link>
          <time dateTime={ad.first_seen_at}>{formatDate(ad.first_seen_at)}</time>
        </div>

        <h2 className="ad-card__headline">{ad.headline || ad.hook || "Headline not available"}</h2>

        {onOpen && (
          <div className="ad-card__meta">
            <button className="ad-card__inspect" type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={`Details for ${ad.brand.name} ad`}>Details <Eye aria-hidden="true" size={15} /></button>
          </div>
        )}
      </div>

    </article>
  );
}
