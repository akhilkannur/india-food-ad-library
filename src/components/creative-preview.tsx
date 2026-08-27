"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Ad } from "@/lib/types";

const themes = new Set(["turmeric", "lime", "oat", "sea", "chilli", "cacao"]);

type CreativePreviewProps = {
  ad: Ad;
  compact?: boolean;
  priority?: boolean;
  onUnavailable?: () => void;
};

function isVideoCreative(ad: Ad) {
  return ad.format.toLowerCase().includes("video")
    || /\.mp4(?:\?|$)/i.test(ad.creative_url || "");
}

function isUsablePoster(url: string | null) {
  return Boolean(url && !/[?/_-]s?\d{1,3}x\d{1,3}(?:[?/_&.-]|$)/i.test(url));
}

export function CreativePreview({ ad, compact = false, priority = false, onUnavailable }: CreativePreviewProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const theme = themes.has(ad.creative_theme ?? "") ? ad.creative_theme : "oat";
  const video = isVideoCreative(ad) && Boolean(ad.creative_url);
  const imageUrl = video ? null : ad.creative_url || ad.thumbnail_url;
  const mediaUrl = video ? ad.creative_url! : imageUrl;
  const failed = Boolean(mediaUrl && failedUrl === mediaUrl);
  const poster = video && ad.thumbnail_url && ad.thumbnail_url !== ad.creative_url && isUsablePoster(ad.thumbnail_url)
    ? ad.thumbnail_url
    : undefined;
  const label = video ? "Video creative" : "Image creative";

  if (!failed && video) {
    return (
      <figure className={`creative creative--media creative--video creative--${theme}`} aria-label={`${label} for ${ad.brand.name}`}>
        <video
          className="creative__media"
          src={ad.creative_url!}
          poster={poster}
          controls
          playsInline
          preload={priority ? "auto" : "metadata"}
          onError={() => {
            setFailedUrl(ad.creative_url!);
            onUnavailable?.();
          }}
        >
          Your browser does not support embedded video.
        </video>
        <figcaption className="creative__format">Video</figcaption>
      </figure>
    );
  }

  if (!failed && imageUrl) {
    return (
      <figure className={`creative creative--media creative--image creative--${theme}`} aria-label={`${label} for ${ad.brand.name}`}>
        {/* Dynamic advertiser media is rendered as-is; production URLs come from the approved record. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="creative__media"
          src={imageUrl}
          alt={`${ad.brand.name} advertising creative`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => {
            setFailedUrl(imageUrl);
            onUnavailable?.();
          }}
        />
        <figcaption className="creative__format">Image</figcaption>
      </figure>
    );
  }

  return (
    <div className={`creative creative--empty creative--${theme}`} role="img" aria-label={`Creative unavailable for ${ad.brand.name}`}>
      <ImageOff aria-hidden="true" size={compact ? 22 : 28} strokeWidth={1.6} />
      <strong>{failed ? "Creative unavailable" : "No media captured"}</strong>
      {!compact && <span>Open the source from details.</span>}
    </div>
  );
}
