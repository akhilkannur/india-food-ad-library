"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { CreativePreview } from "@/components/creative-preview";
import type { Ad } from "@/lib/types";

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
  onUnavailable: () => void;
}) {
  const format = ad.creative_style || ad.format;
  const secondaryTag = ad.selling_angle;

  return (
    <article className="ad-card">
      <div className="ad-card__media">
        <CreativePreview ad={ad} compact priority={priority} onUnavailable={onUnavailable} />
        <span className="ad-card__format">{format}</span>
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

        <div className="ad-card__meta">
          <span>{ad.language}</span>
          {secondaryTag && <span>{secondaryTag}</span>}
          <span className="ad-card__inspect">View details <Eye aria-hidden="true" size={15} /></span>
        </div>
      </div>

      {onOpen && (
        <button
          className="ad-card__trigger"
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`Inspect ${ad.brand.name} ad: ${ad.headline || ad.format}`}
        >
          <span className="visually-hidden">View ad details</span>
        </button>
      )}
    </article>
  );
}
